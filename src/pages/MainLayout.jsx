import { useState } from 'react'
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
  const { activeConversation } = useChat()
  const [activeTab, setActiveTab] = useState('chats')
  const [showSettings, setShowSettings] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Close contact info when conversation changes
  const handleSetConversation = () => setShowContactInfo(false)

  return (
    <div className="app-layout">
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
            onBack={() => {}}
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