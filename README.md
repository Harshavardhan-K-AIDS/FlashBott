# 🤖 Gemini Personal Chatbot

A modern, interactive AI chatbot built with Gemini API, featuring personalized chat history, Firebase authentication, and a beautiful UI.

## Features

- ✨ **Modern UI/UX** - Beautiful, responsive design with smooth animations
- 🔐 **Firebase Authentication** - Secure user authentication and data storage
- 💬 **Chat History** - Persistent chat history stored in Firebase Firestore
- 🎯 **Personalized Responses** - AI uses conversation history for context-aware replies
- 📝 **Markdown Support** - Bot responses support markdown formatting
- ⚡ **Typing Indicators** - Visual feedback when the AI is thinking
- 🗑️ **Clear Chat** - Option to clear chat history
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (ES6 Modules)
- **Backend**: Node.js, Express
- **AI**: Google Gemini API
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Deployment**: Azure App Service ready

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))

## Setup Instructions

### 1. Clone and Install

```bash
# Install dependencies
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Authentication (Email/Password)
4. Enable Firestore Database
5. Copy your Firebase config from Project Settings
6. Update `public/firebase-config.js` with your Firebase configuration

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

You can copy from `.env.example`:
```bash
cp .env.example .env
# Then edit .env and add your API key
```

### 4. Run the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The app will be available at `http://localhost:3000`

## Firebase Firestore Rules

Make sure your Firestore security rules allow authenticated users to read/write their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/messages/{messageId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Azure Deployment

### Option 1: Azure App Service (Recommended)

1. **Create Azure App Service**:
   ```bash
   az webapp create --resource-group <resource-group> --plan <app-service-plan> --name <app-name> --runtime "NODE:18-lts"
   ```

2. **Set Environment Variables**:
   ```bash
   az webapp config appsettings set --resource-group <resource-group> --name <app-name> --settings GEMINI_API_KEY="your_api_key"
   ```

3. **Deploy**:
   ```bash
   # Using Azure CLI
   az webapp up --resource-group <resource-group> --name <app-name>
   
   # Or use VS Code Azure extension
   # Or use GitHub Actions / Azure DevOps
   ```

### Option 2: Azure Portal

1. Create a new App Service in Azure Portal
2. Go to Configuration → Application Settings
3. Add `GEMINI_API_KEY` with your API key value
4. Deploy your code using:
   - GitHub Actions
   - Azure DevOps
   - VS Code Azure Extension
   - FTP/SCM

### Important Notes for Azure

- Azure automatically sets the `PORT` environment variable, so your app will use it automatically
- Make sure to set `GEMINI_API_KEY` in Azure App Service Configuration
- The app uses port 3000 by default, but Azure will override this with its own PORT

## Project Structure

```
FlashBott/
├── public/
│   ├── index.html          # Main HTML file
│   ├── style.css           # Styles
│   ├── script.js           # Frontend JavaScript
│   └── firebase-config.js  # Firebase configuration
├── server.js               # Express server
├── package.json            # Dependencies
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore file
└── README.md               # This file
```

## Usage

1. **Sign Up/Login**: Create an account or login with existing credentials
2. **Start Chatting**: Type your message and press Enter or click Send
3. **View History**: Your chat history is automatically loaded when you login
4. **Clear Chat**: Use the "Clear Chat" button to delete all messages
5. **Logout**: Click the logout button in the header

## Features in Detail

### Personalized Chat History
- All conversations are stored in Firebase Firestore
- The AI uses the last 30 messages for context
- Each user has their own isolated chat history

### Markdown Support
- Bot responses support markdown formatting
- Code blocks, lists, headers, and more are properly rendered
- Uses Marked.js library for rendering

### Typing Indicators
- Shows animated typing indicator when AI is processing
- Provides visual feedback to users

## Troubleshooting

### "Gemini API key not configured"
- Make sure you've created a `.env` file with `GEMINI_API_KEY`
- For Azure, ensure the environment variable is set in App Service Configuration

### Firebase errors
- Verify your Firebase config in `public/firebase-config.js`
- Check that Authentication and Firestore are enabled
- Verify Firestore security rules

### Port already in use
- Change the PORT in `.env` file
- Or kill the process using port 3000

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues or questions, please open an issue on the repository.

