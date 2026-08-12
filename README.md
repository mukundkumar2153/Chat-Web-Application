# WaveChat 🌊

> A WhatsApp-inspired real-time chat application built with **React + Vite + Supabase**  
> Fully responsive — works seamlessly on both **Desktop** and **Mobile** devices.

![WaveChat Banner](https://img.shields.io/badge/WaveChat-Live-7C5CFC?style=for-the-badge&logo=vercel&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

---

## ✨ Features

### 💬 Messaging
- ✅ Real-time text messaging with end-to-end encryption
- ✅ Reply / quote messages
- ✅ Emoji reactions (quick bar + full picker)
- ✅ Delete messages
- ✅ Star / bookmark messages
- ✅ Message search within conversations
- ✅ Typing indicator (real-time broadcast)
- ✅ Read receipts (double tick ✓✓)

### 📎 Media
- ✅ Send photos, videos, documents
- ✅ Voice notes (record + send)
- ✅ Drag & drop file upload
- ✅ Image lightbox / full-screen preview

### 👥 Conversations
- ✅ 1-on-1 private chats
- ✅ Group chats (create, add members)
- ✅ Online presence indicator (green dot)
- ✅ Last seen timestamp
- ✅ Unread message count badges
- ✅ Pin / mute conversations
- ✅ Context menu on chat items

### 📞 Calls
- ✅ Voice & video call UI (WebRTC based)
- ✅ Call history log

### 🎨 Themes & UI
- ✅ 6 built-in themes: Default, Emerald, Cyberpunk, AMOLED, Nord, Light
- ✅ WhatsApp-style mobile single-pane navigation
- ✅ Responsive desktop dual-pane layout
- ✅ Glassmorphism design with smooth animations

### 🔐 Auth & Security
- ✅ Email OTP authentication (magic link)
- ✅ Profile setup (avatar, name, bio)
- ✅ App lock (PIN protection)
- ✅ End-to-end encrypted messages

### ⚙️ Settings
- ✅ Edit profile (name, bio, avatar)
- ✅ Privacy settings
- ✅ Notification preferences
- ✅ Theme selector
- ✅ Starred messages view
- ✅ Sign out

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Vanilla CSS (Design Tokens System) |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (Email OTP) |
| Storage | Supabase Storage (media files) |
| Encryption | Web Crypto API (AES-GCM) |
| Icons | Lucide React |
| Fonts | Inter + Space Grotesk (Google Fonts) |
| Deployment | Vercel |

---

## 🚀 Local Setup

### 1. Clone & Install
```bash
git clone https://github.com/mukundkumar2153/Chat-Web-Application.git
cd Chat-Web-Application
npm install
```

### 2. Supabase Setup
1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **SQL Editor**, run the contents of `supabase_schema.sql`
3. Go to **Authentication → Email** → enable "Email OTP"
4. Copy your **Project URL** and **anon key** from **Project Settings → API**

### 3. Environment Variables
```bash
cp .env.example .env
```
Fill in your Supabase credentials in `.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Dev Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## 📁 Project Structure

```
src/
├── context/
│   ├── AuthContext.jsx        # Auth state, profile management
│   ├── ChatContext.jsx        # Conversations, messages, real-time subscriptions
│   └── CallContext.jsx        # WebRTC call state
├── pages/
│   ├── LoginPage.jsx          # OTP auth flow
│   ├── ProfileSetupPage.jsx   # First-time profile creation
│   └── MainLayout.jsx         # Root layout (sidebar + chat pane)
├── components/
│   ├── ui/
│   │   └── Avatar.jsx         # Reusable avatar with initials fallback
│   └── chat/
│       ├── Sidebar.jsx        # Chat list, calls tab, nav
│       ├── ChatWindow.jsx     # Message view + input area
│       ├── SettingsPage.jsx   # Full settings with theme picker
│       ├── ContactInfoPanel.jsx
│       ├── MediaBubble.jsx
│       ├── CallModal.jsx
│       ├── NewChatModal.jsx
│       ├── NewGroupModal.jsx
│       ├── StarredMessagesModal.jsx
│       ├── AppLockScreen.jsx
│       └── Lightbox.jsx
├── lib/
│   ├── supabase.js            # Supabase client
│   ├── crypto.js              # AES-GCM encrypt/decrypt
│   ├── encryption.js          # Conversation key management
│   ├── media.js               # File upload helpers
│   └── appLock.js             # PIN lock helpers
└── index.css                  # Full design system (CSS variables + themes)
```

---

## 📱 Mobile Support

WaveChat is fully optimized for mobile browsers:
- **Single-pane navigation** (WhatsApp style) on screens ≤ 768px
- **Dynamic Viewport Height** (`dvh`) — layout stays correct when keyboard opens
- **Safe Area Insets** — notch and home-bar support for iPhone
- **Touch Actions** — long press to reveal message actions, tap to dismiss
- **No 300ms tap delay** — `touch-action: manipulation` on all interactive elements

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT License © 2025 Mukund Kumar

---

## 🌐 Live Demo

> **Try WaveChat live:**

## 🔗 [https://chat-web-application-dun.vercel.app](https://chat-web-application-dun.vercel.app)
