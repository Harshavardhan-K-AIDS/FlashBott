import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Cache for the working model name
let cachedModelName = null;

// Helper: convert our simple history format into Gemini contents
function buildHistoryForGemini(history, newMessage) {
  const chatHistory = [];

  // Convert history to Gemini format
  for (const msg of history || []) {
    if (msg.sender === "user") {
      chatHistory.push({ role: "user", parts: [{ text: msg.text }] });
    } else if (msg.sender === "bot") {
      chatHistory.push({ role: "model", parts: [{ text: msg.text }] });
    }
  }

  // Add new user message
  chatHistory.push({ role: "user", parts: [{ text: newMessage }] });

  return chatHistory;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    // Limit history for efficiency (last 30 messages for better context)
    const trimmedHistory = Array.isArray(history)
      ? history.slice(-30)
      : [];

    // Build conversation history
    const conversationHistory = buildHistoryForGemini(trimmedHistory, message.trim());

    // Helper function to retry with exponential backoff
    async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          const isOverloaded = error.message?.includes("503") || 
                              error.message?.includes("overloaded") ||
                              error.message?.includes("Service Unavailable");
          
          if (isOverloaded && attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Request overloaded, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }
      }
    }
    
    // List of models to try in order (with fallbacks for overloaded models)
    const modelNames = [
      "gemini-2.5-flash",        // Stable, fast model
      "gemini-2.5-pro",          // Stable, more capable
      "gemini-flash-latest",     // Latest flash version
      "gemini-pro-latest",       // Latest pro version
      "gemini-2.0-flash-001",    // Stable fallback
      "gemini-2.0-flash"         // Alternative fallback
    ];
    
    // Try models with retry logic
    let model;
    let modelName = cachedModelName;
    let lastError;
    
    // If we have a cached model, try it first
    if (modelName) {
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        // Quick test with retry
        await retryWithBackoff(async () => {
          const testResult = await model.generateContent("test");
          await testResult.response;
        }, 2, 500);
        console.log(`✓ Using cached model: ${modelName}`);
      } catch (err) {
        // Cached model failed, clear it and try others
        console.warn(`Cached model ${modelName} failed, trying others...`);
        cachedModelName = null;
        modelName = null;
        model = null;
      }
    }
    
    // If no cached model or it failed, try all models
    if (!model || !modelName) {
      for (const name of modelNames) {
        try {
          model = genAI.getGenerativeModel({ model: name });
          
          // Test the model with retry logic
          await retryWithBackoff(async () => {
            const testResult = await model.generateContent("test");
            await testResult.response;
          }, 2, 500); // 2 retries with 500ms base delay
          
          modelName = name;
          cachedModelName = name; // Cache it for future requests
          console.log(`✓ Using model: ${modelName}`);
          break;
        } catch (err) {
          lastError = err;
          const isOverloaded = err.message?.includes("503") || 
                              err.message?.includes("overloaded");
          if (isOverloaded) {
            console.warn(`Model ${name} is overloaded, trying next model...`);
          } else {
            console.warn(`Model ${name} not available:`, err.message);
          }
          continue;
        }
      }
    }
    
    if (!model || !modelName) {
      throw new Error(`No available Gemini model found. All models are either unavailable or overloaded. Last error: ${lastError?.message || "Unknown"}. Please try again in a few moments.`);
    }
    
    // Try using startChat first (preferred method for conversations) with retry logic
    let replyText;
    try {
      const historyForChat = conversationHistory.slice(0, -1); // All except the last message
      const currentMessage = conversationHistory[conversationHistory.length - 1];
      
      if (historyForChat.length > 0) {
        // Start chat with history
        const chat = model.startChat({
          history: historyForChat
        });
        
        // Retry with backoff if overloaded
        const result = await retryWithBackoff(async () => {
          return await chat.sendMessage(currentMessage.parts[0].text);
        }, 3, 1000);
        
        const response = await result.response;
        replyText = response.text() || "I couldn't generate a reply.";
      } else {
        // No history, just send the message directly with retry
        const result = await retryWithBackoff(async () => {
          return await model.generateContent(message.trim());
        }, 3, 1000);
        
        const response = await result.response;
        replyText = response.text() || "I couldn't generate a reply.";
      }
    } catch (chatError) {
      // If still failing, try fallback with retry
      console.warn("Chat method failed, using simple generateContent:", chatError.message);
      const prompt = trimmedHistory.length > 0
        ? `Previous conversation:\n${trimmedHistory.map(m => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}\n\nUser: ${message.trim()}\nAssistant:`
        : message.trim();
      
      const result = await retryWithBackoff(async () => {
        return await model.generateContent(prompt);
      }, 3, 1000);
      
      const response = await result.response;
      replyText = response.text() || "I couldn't generate a reply.";
    }

    res.json({ reply: replyText });
  } catch (err) {
    console.error("Gemini error:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));
    
    // Provide more helpful error messages
    let errorMessage = "Error communicating with Gemini API";
    if (err.message) {
      errorMessage = err.message;
      // Check for common errors
      if (err.message.includes("503") || err.message.includes("overloaded") || err.message.includes("Service Unavailable")) {
        errorMessage = "The AI model is currently overloaded. Please try again in a few moments. The system will automatically retry with different models.";
      } else if (err.message.includes("404") || err.message.includes("not found")) {
        errorMessage = "Model not found. Please check your API key has access to the requested model.";
      } else if (err.message.includes("401") || err.message.includes("API key")) {
        errorMessage = "Invalid API key. Please check your GEMINI_API_KEY in .env file.";
      } else if (err.message.includes("403")) {
        errorMessage = "API key doesn't have permission to access this model.";
      } else if (err.message.includes("429") || err.message.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// List available models endpoint
app.get("/api/list-models", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not set" });
    }
    
    // Try to fetch available models using the REST API directly
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Try v1beta first
    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    let apiVersion = "v1beta";
    
    if (!response.ok) {
      // Try v1 API instead
      response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
      apiVersion = "v1";
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ 
        error: "Failed to fetch models",
        details: errorText,
        suggestion: "Please verify your API key is correct and has proper permissions"
      });
    }
    
    const data = await response.json();
    const modelNames = (data.models || []).map(m => {
      const name = m.name || "";
      return name.replace('models/', '');
    });
    
    res.json({ 
      apiVersion,
      totalModels: modelNames.length,
      models: data.models || [],
      modelNames: modelNames,
      suggestion: modelNames.length > 0 
        ? `Try using one of these models: ${modelNames.slice(0, 3).join(", ")}`
        : "No models found. Check your API key."
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Test endpoint to check available models
app.get("/api/test-models", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not set" });
    }
    
    // First, get available models from the API
    const apiKey = process.env.GEMINI_API_KEY;
    let availableModels = [];
    
    try {
      let listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!listResponse.ok) {
        listResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
      }
      if (listResponse.ok) {
        const listData = await listResponse.json();
        availableModels = (listData.models || []).map(m => {
          const name = m.name || "";
          return name.replace('models/', '');
        }).filter(name => name && name.includes('gemini'));
      }
    } catch (e) {
      console.warn("Could not fetch model list:", e.message);
    }
    
    // Use available models if found, otherwise try common names
    const modelsToTest = availableModels.length > 0 
      ? availableModels.slice(0, 5)
      : [
          "gemini-2.5-flash",
          "gemini-2.5-pro",
          "gemini-flash-latest",
          "gemini-pro-latest",
          "gemini-2.0-flash-001"
        ];
    
    const results = [];
    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi");
        const response = await result.response;
        const responseText = response.text();
        results.push({ 
          model: modelName, 
          status: "success", 
          response: responseText.substring(0, 100),
          message: "This model works! ✓"
        });
      } catch (err) {
        results.push({ 
          model: modelName, 
          status: "failed", 
          error: err.message,
          message: "This model is not available"
        });
      }
    }
    
    const workingModels = results.filter(r => r.status === "success");
    res.json({ 
      availableModelsFromAPI: availableModels,
      results,
      summary: {
        total: results.length,
        working: workingModels.length,
        workingModels: workingModels.map(r => r.model),
        recommendation: workingModels.length > 0 
          ? `Use model: ${workingModels[0].model}` 
          : availableModels.length > 0
            ? `Found ${availableModels.length} models from API but none worked. Try visiting /api/list-models to see details.`
            : "No working models found. Please check your API key. Visit /api/list-models to see available models."
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for Azure
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY not set in environment variables");
  }
});
