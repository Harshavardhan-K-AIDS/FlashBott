import { firebaseConfig } from "./firebase-config.js";

// Import Firebase SDKs
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- Firebase init ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM elements ---
const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("status");
const userInfoEl = document.getElementById("user-info");

// Local conversation history used for Gemini
let conversationHistory = []; // [{ sender: "user" | "bot", text: "..." }]
let currentUser = null;
let typingIndicator = null;
let messageDocs = []; // Store document IDs for deletion

// --- UI helpers ---
function removeEmptyState() {
  const emptyState = chatWindow.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
}

function addMessageToUI(text, sender) {
  removeEmptyState();
  
  const div = document.createElement("div");
  div.classList.add("message", sender);
  
  if (sender === "bot" && typeof marked !== "undefined") {
    // Render markdown for bot messages
    div.innerHTML = marked.parse(text);
  } else {
    // Plain text for user messages
    div.textContent = text;
  }
  
  chatWindow.appendChild(div);
  scrollToBottom();
  
  conversationHistory.push({ sender, text });
}

function showTypingIndicator() {
  if (typingIndicator) return;
  
  removeEmptyState();
  typingIndicator = document.createElement("div");
  typingIndicator.classList.add("typing-indicator");
  typingIndicator.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;
  chatWindow.appendChild(typingIndicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function loadHistoryFromFirestore(user) {
  conversationHistory = [];
  messageDocs = [];
  chatWindow.innerHTML = "";

  try {
    const msgsRef = collection(db, "users", user.uid, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), limit(100));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Show empty state
      chatWindow.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>Start a conversation</h3>
          <p>Your chat history will appear here</p>
        </div>
      `;
      return;
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      addMessageToUI(data.text, data.sender);
      messageDocs.push({ id: docSnap.id, data });
    });
    
    scrollToBottom();
  } catch (err) {
    console.error("Error loading history:", err);
    statusEl.textContent = "Error loading chat history";
  }
}

async function saveMessageToFirestore(user, sender, text) {
  try {
    const msgsRef = collection(db, "users", user.uid, "messages");
    const docRef = await addDoc(msgsRef, {
      sender,
      text,
      createdAt: Date.now(),
    });
    messageDocs.push({ id: docRef.id, data: { sender, text, createdAt: Date.now() } });
  } catch (err) {
    console.error("Error saving message:", err);
    throw err;
  }
}

async function clearChatHistory(user) {
  if (!confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
    return;
  }

  try {
    statusEl.textContent = "Clearing chat history...";
    const msgsRef = collection(db, "users", user.uid, "messages");
    const batch = writeBatch(db);
    
    // Delete all messages in batches
    for (const msgDoc of messageDocs) {
      const docRef = doc(db, "users", user.uid, "messages", msgDoc.id);
      batch.delete(docRef);
    }
    
    await batch.commit();
    
    conversationHistory = [];
    messageDocs = [];
    chatWindow.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>Start a conversation</h3>
        <p>Your chat history will appear here</p>
      </div>
    `;
    statusEl.textContent = "Chat history cleared";
    
    setTimeout(() => {
      statusEl.textContent = "Ready";
    }, 2000);
  } catch (err) {
    console.error("Error clearing chat:", err);
    statusEl.textContent = "Error clearing chat history";
  }
}

// --- Auth handlers ---
loginBtn.onclick = async () => {
  authError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";
  
  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value.trim()
    );
  } catch (err) {
    authError.textContent = err.message || "Login failed";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
};

signupBtn.onclick = async () => {
  authError.textContent = "";
  signupBtn.disabled = true;
  signupBtn.textContent = "Creating account...";
  
  try {
    await createUserWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value.trim()
    );
    authError.textContent = "Account created! You are now logged in.";
    authError.style.color = "#10b981";
  } catch (err) {
    authError.textContent = err.message || "Sign up failed";
    authError.style.color = "#e74c3c";
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = "Create Account";
  }
};

logoutBtn.onclick = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout error:", err);
  }
};

clearChatBtn.onclick = async () => {
  if (currentUser) {
    await clearChatHistory(currentUser);
  }
};

// React to login/logout
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userInfoEl.textContent = user.email;
    logoutBtn.classList.remove("hidden");
    authSection.style.display = "none";
    chatSection.classList.remove("hidden");
    statusEl.textContent = "Loading your chats...";
    await loadHistoryFromFirestore(user);
    statusEl.textContent = "Ready";
    userInput.focus();
  } else {
    currentUser = null;
    userInfoEl.textContent = "Not logged in";
    logoutBtn.classList.add("hidden");
    authSection.style.display = "flex";
    chatSection.classList.add("hidden");
    chatWindow.innerHTML = "";
    conversationHistory = [];
    messageDocs = [];
    emailInput.value = "";
    passwordInput.value = "";
    authError.textContent = "";
  }
});

// --- Chat logic ---
async function sendMessage(message) {
  if (!currentUser) return;

  sendBtn.disabled = true;
  userInput.disabled = true;
  statusEl.textContent = "Thinking...";
  showTypingIndicator();

  try {
    // Save user message first
    await saveMessageToFirestore(currentUser, "user", message);

    // Prepare trimmed history to send to backend (last 30 messages for better context)
    const historyToSend = conversationHistory.slice(-30);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: historyToSend,
        userId: currentUser.uid,
      }),
    });

    hideTypingIndicator();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Server error");
    }

    const data = await res.json();
    const botReply = data.reply || "I couldn't generate a reply.";

    addMessageToUI(botReply, "bot");
    await saveMessageToFirestore(currentUser, "bot", botReply);

    statusEl.textContent = "Ready";
  } catch (err) {
    console.error(err);
    hideTypingIndicator();
    statusEl.textContent = "Error: " + err.message;
    addMessageToUI("Sorry, I encountered an error: " + err.message, "bot");
  } finally {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || !currentUser) return;

  addMessageToUI(text, "user");
  userInput.value = "";
  sendMessage(text);
});

// Allow Enter key to send (Shift+Enter for new line)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event("submit"));
  }
});

// Initialize
statusEl.textContent = "Please log in to start chatting.";
