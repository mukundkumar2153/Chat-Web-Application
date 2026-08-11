# WaveChat 🌊

A WhatsApp-inspired real-time messaging web app built with React + Vite + Supabase.

## Phase 1 Features
- ✅ Email OTP authentication
- ✅ Profile setup (avatar, name, bio)
- ✅ Real-time chat list with unread counts, timestamps, pin chat
- ✅ Individual chat screen with text bubbles
- ✅ Reply/quote messages
- ✅ Emoji reactions (quick + picker)
- ✅ Delete messages
- ✅ Emoji picker in input
- ✅ File/media attach
- ✅ Typing indicator (real-time broadcast)
- ✅ Online presence indicator
- ✅ Search chats
- ✅ New chat modal (search users)
- ✅ Settings page (privacy, notifications, profile edit, logout)
- ✅ Context menu on chat items (pin, mute, delete)

## Setup

### 1. Clone & Install
```bash
npm install
```

### 2. Supabase Setup
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the entire contents of `supabase_schema.sql`
3. Go to **Authentication → Email** and enable "Email OTP" (disable email confirmation if you want instant login)
4. Copy your Project URL and anon key from **Project Settings → API**

### 3. Environment Variables
```bash
cp .env.example .env
```
Fill in your Supabase credentials in `.env`

### 4. Run
```bash
npm run dev
```

## Project Structure
```
src/
├── context/
│   ├── AuthContext.jsx     # Auth state, profile management
│   └── ChatContext.jsx     # Conversations, messages, real-time
├── pages/
│   ├── LoginPage.jsx       # OTP auth flow
│   ├── ProfileSetupPage.jsx
│   └── MainLayout.jsx      # Root layout
├── components/
│   ├── ui/
│   │   └── Avatar.jsx
│   └── chat/
│       ├── Sidebar.jsx     # Chat list + nav
│       ├── ChatWindow.jsx  # Message view + input
│       ├── NewChatModal.jsx
│       └── SettingsPage.jsx
├── lib/
│   └── supabase.js
└── index.css               # Full design system (CSS variables)
```

## Coming in Phase 2
- Group chats (create, add members, admin roles, @mentions)
- Status/Stories feed
- Voice notes (record + waveform)
- Media gallery in chat
- Message forward
- WebRTC voice & video calls
