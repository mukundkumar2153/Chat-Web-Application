import { useState, useEffect } from 'react'
import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'
import SettingsPage from '../components/chat/SettingsPage'
import NewChatModal from '../components/chat/NewChatModal'
import NewGroupModal from '../components/chat/NewGroupModal'
import ContactInfoPanel from '../components/chat/ContactInfoPanel'
import StarredMessagesModal from '../components/chat/StarredMessagesModal'
import CallModal from '../components/chat/CallModal'
import { useChat } from '../context/ChatContext'

export default function MainLayout() {
  const { activeConversation, setActiveConversation, conversations, markAllAsRead } = useChat()
  const [activeTab, setActiveTab] = useState('chats')
  const [showSettings, setShowSettings] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Auto-close settings when a conversation is selected
  useEffect(() => {
    if (activeConversation) {
      setShowSettings(false)
    }
  }, [activeConversation])

  // ── Global keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      // Don't fire when typing in input fields
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable

      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewChat(true) }
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); setShowNewGroup(true) }
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setShowSettings(true); setActiveTab('settings') }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); markAllAsRead?.() }

      // Alt+↑/↓ navigate conversations
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = conversations.findIndex(c => c.id === activeConversation?.id)
        if (idx > 0) setActiveConversation(conversations[idx - 1])
        else if (conversations.length > 0 && idx === -1) setActiveConversation(conversations[0])
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = conversations.findIndex(c => c.id === activeConversation?.id)
        if (idx < conversations.length - 1) setActiveConversation(conversations[idx + 1])
        else if (conversations.length > 0 && idx === -1) setActiveConversation(conversations[0])
      }

      // Ctrl+Enter also sends message (handled inside ChatWindow textarea onKeyDown too)
      // Escape — close modals / settings
      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); setActiveTab('chats') }
        else if (showNewChat) setShowNewChat(false)
        else if (showNewGroup) setShowNewGroup(false)
        else if (showStarred) setShowStarred(false)
        else if (showContactInfo) setShowContactInfo(false)
        else if (activeConversation && !isInput) setActiveConversation(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [conversations, activeConversation, showSettings, showNewChat, showNewGroup, showStarred, showContactInfo, setActiveConversation, markAllAsRead])

  return (
    <div className={`app-layout ${activeConversation ? 'has-active-chat' : 'no-active-chat'} ${showSettings ? 'has-settings' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onOpenSettings={() => { setShowSettings(true); setActiveTab('settings') }}
        onOpenStarred={() => setShowStarred(true)}
      />

      {/* Main content area */}
      <div className="main-content">
        {showSettings ? (
          <SettingsPage onBack={() => { setShowSettings(false); setActiveTab('chats') }} />
        ) : (
          <ChatWindow
            onBack={() => setActiveConversation(null)}
            onOpenContactInfo={() => {
              if (activeConversation) setShowContactInfo(true)
            }}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
          />
        )}
      </div>

      {/* Contact Info Side Panel - only when conversation selected */}
      {showContactInfo && activeConversation && (
        <ContactInfoPanel
          conversation={activeConversation}
          onClose={() => setShowContactInfo(false)}
          onOpenSearch={() => { setShowContactInfo(false); setSearchOpen(true) }}
          onOpenStarred={() => { setShowContactInfo(false); setShowStarred(true) }}
        />
      )}

      {/* Modals (overlay) */}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
      {showStarred && <StarredMessagesModal onClose={() => setShowStarred(false)} />}

      {/* Call Modal - portal style, fixed overlay, only shows during active call */}
      <CallModal />
    </div>
  )
}