import { useState } from 'react'
import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'
import SettingsPage from '../components/chat/SettingsPage'
import NewChatModal from '../components/chat/NewChatModal'
import { useChat } from '../context/ChatContext'

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState('chats')
  const [showSettings, setShowSettings] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const { activeConversation, setActiveConversation } = useChat()

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab !== 'settings') setShowSettings(false)
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onNewChat={() => setShowNewChat(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showSettings ? (
          <SettingsPage onBack={() => { setShowSettings(false); setActiveTab('chats') }} />
        ) : (
          <ChatWindow onBack={() => setActiveConversation(null)} />
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </div>
  )
}
