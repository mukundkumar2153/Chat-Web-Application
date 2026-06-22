import { useState, useRef, useEffect } from 'react'
import { Waves, Search, MoreVertical, Edit, MessageSquare, Phone, Settings, Pin, BellOff, Trash2, Plus, X, Star, CheckCheck, Lock, LogOut, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { supabase } from '../../lib/supabase'
import Avatar from '../ui/Avatar'
import { format, isToday, isYesterday } from 'date-fns'

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'dd/MM/yy')
}

function getPreview(msg) {
  if (!msg) return 'No messages yet'
  if (msg.deleted_at) return '🚫 This message was deleted'
  if (msg.message_type === 'image') return '📷 Photo'
  if (msg.message_type === 'video') return '🎥 Video'
  if (msg.message_type === 'voice') return '🎙️ Voice note'
  if (msg.message_type === 'document') return '📄 Document'
  return msg.content || ''
}

export default function Sidebar({ activeTab, setActiveTab, onNewChat, onOpenSettings }) {
  const { user, profile, signOut } = useAuth()
  const { conversations, activeConversation, setActiveConversation, searchQuery, setSearchQuery, togglePinConversation, fetchConversations, onlineUsers } = useChat()
  const [contextMenu, setContextMenu] = useState(null)
  const [headerMenu, setHeaderMenu] = useState(false)
  const contextMenuRef = useRef()
  const headerMenuRef = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) setContextMenu(null)
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setHeaderMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = conversations.filter(conv => {
    if (!searchQuery) return true
    const name = conv.is_group ? conv.name : conv.other_user?.display_name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.last_message?.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  async function handleDeleteConversation(convId) {
    await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', user.id)
    fetchConversations()
    if (activeConversation?.id === convId) setActiveConversation(null)
    setContextMenu(null)
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString()
    await Promise.all(conversations.map(conv =>
      supabase.from('conversation_members')
        .update({ last_read_at: now })
        .eq('conversation_id', conv.id)
        .eq('user_id', user.id)
    ))
    fetchConversations()
    setHeaderMenu(false)
  }

  const tabs = [
    { id: 'chats', icon: MessageSquare, label: 'Chats' },
    { id: 'calls', icon: Phone, label: 'Calls' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Waves size={20} color="white" />
          </div>
          <span className="sidebar-logo-text">WaveChat</span>
        </div>
        <div className="sidebar-header-actions">
          {activeTab === 'chats' && (
            <button className="icon-btn" onClick={onNewChat} title="New chat">
              <Edit size={18} />
            </button>
          )}
          {/* 3-dot Header Menu */}
          <div style={{ position: 'relative' }} ref={headerMenuRef}>
            <button className="icon-btn" onClick={() => setHeaderMenu(p => !p)} title="Menu">
              <MoreVertical size={18} />
            </button>
            {headerMenu && (
              <div className="dropdown" style={{ right: 0, top: '36px', minWidth: '200px' }}>
                <div className="dropdown-item" onClick={() => { onNewChat(); setHeaderMenu(false) }}>
                  <Users size={15} /> New group
                </div>
                <div className="dropdown-item" onClick={() => setHeaderMenu(false)}>
                  <Star size={15} /> Starred messages
                </div>
                <div className="dropdown-item" onClick={() => setHeaderMenu(false)}>
                  <CheckCheck size={15} /> Select chats
                </div>
                <div className="dropdown-item" onClick={handleMarkAllRead}>
                  <CheckCheck size={15} /> Mark all as read
                </div>
                <div className="dropdown-item" onClick={() => setHeaderMenu(false)}>
                  <Lock size={15} /> App lock
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-item danger" onClick={() => { signOut(); setHeaderMenu(false) }}>
                  <LogOut size={15} /> Log out
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="nav-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'settings') onOpenSettings()
            }}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'chats' && (
        <div className="search-container">
          <div className="search-input-wrap">
            <Search size={15} color="var(--text-muted)" />
            <input
              placeholder="Search chats or messages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="chat-list" style={{ position: 'relative' }}>
        {activeTab === 'chats' && (
          <>
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </div>
            )}
            {filtered.map(conv => {
              const name = conv.is_group ? conv.name : conv.other_user?.display_name || 'Unknown'
              const avatarUrl = conv.is_group ? conv.group_avatar_url : conv.other_user?.avatar_url
              const isOnline = onlineUsers.has(conv.other_user?.id)
              const isActive = activeConversation?.id === conv.id

              return (
                <div
                  key={conv.id}
                  className={`chat-item ${isActive ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}`}
                  onClick={() => setActiveConversation(conv)}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ conv, x: e.clientX, y: e.clientY }) }}
                >
                  <Avatar src={avatarUrl} name={name} size={12} showOnline={!conv.is_group} isOnline={isOnline} />
                  <div className="chat-item-info">
                    <div className="chat-item-top">
                      <span className="chat-item-name truncate">
                        {conv.pinned && <Pin size={11} style={{ display: 'inline', marginRight: 4, opacity: 0.5 }} />}
                        {name}
                      </span>
                      <span className="chat-item-time">
                        {formatTime(conv.last_message?.created_at || conv.created_at)}
                      </span>
                    </div>
                    <div className="chat-item-bottom">
                      <span className="chat-item-preview">{getPreview(conv.last_message)}</span>
                      {conv.unread_count > 0 && (
                        <span className="unread-badge">{conv.unread_count > 99 ? '99+' : conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* FAB */}
            <div className="fab" onClick={onNewChat} title="New chat">
              <Plus size={22} />
            </div>
          </>
        )}

        {activeTab === 'calls' && (
          <div className="empty-state" style={{ paddingTop: '60px' }}>
            <div className="empty-state-icon"><Phone size={32} /></div>
            <div className="empty-state-title">No recent calls</div>
            <div className="empty-state-sub">Call history will appear here</div>
          </div>
        )}
      </div>

      {/* Right-click Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="dropdown"
          style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
        >
          <div className="dropdown-item" onClick={() => { togglePinConversation(contextMenu.conv.id, contextMenu.conv.pinned); setContextMenu(null) }}>
            <Pin size={14} /> {contextMenu.conv.pinned ? 'Unpin' : 'Pin chat'}
          </div>
          <div className="dropdown-item" onClick={() => setContextMenu(null)}>
            <BellOff size={14} /> Mute notifications
          </div>
          <div className="dropdown-item" onClick={() => setContextMenu(null)}>
            <Star size={14} /> Starred messages
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item danger" onClick={() => handleDeleteConversation(contextMenu.conv.id)}>
            <Trash2 size={14} /> Delete chat
          </div>
        </div>
      )}
    </div>
  )
}