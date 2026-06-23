import { useState, useEffect } from 'react'
import { X, Star, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { decryptText } from '../../lib/crypto'
import { getConversationKey } from '../../lib/encryption'
import Avatar from '../ui/Avatar'
import { format } from 'date-fns'

export default function StarredMessagesModal({ onClose }) {
  const { user } = useAuth()
  const { setActiveConversation } = useChat()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStarred()
  }, [])

  async function fetchStarred() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select(`
        id, content, nonce, message_type, created_at, conversation_id,
        profiles:sender_id (display_name, avatar_url),
        conversations:conversation_id (id, name, is_group,
          conversation_members!inner(user_id)
        )
      `)
      .contains('starred_by', [user.id])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const decrypted = await Promise.all(data.map(async (msg) => {
        try {
          const key = await getConversationKey({ conversationId: msg.conversation_id, myUserId: user.id })
          if (key && msg.content && msg.nonce) {
            return { ...msg, content: decryptText(msg.content, msg.nonce, key) ?? msg.content }
          }
        } catch { /* ignore decrypt errors */ }
        return msg
      }))
      setMessages(decrypted)
    }
    setLoading(false)
  }

  function getPreview(msg) {
    if (msg.message_type === 'image') return '📷 Photo'
    if (msg.message_type === 'video') return '🎥 Video'
    if (msg.message_type === 'voice') return '🎙️ Voice note'
    if (msg.message_type === 'document') return '📄 Document'
    return msg.content || ''
  }

  async function jumpToConversation(msg) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(profiles:user_id(id, display_name, avatar_url, status_text, last_seen, is_online, public_key))')
      .eq('id', msg.conversation_id)
      .single()
    if (conv) {
      const otherMember = conv.conversation_members?.find(m => m.profiles?.id !== user.id)
      setActiveConversation({ ...conv, other_user: otherMember?.profiles || null })
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} color="#FFAB2E" fill="#FFAB2E" /> Starred Messages
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Star size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No starred messages</div>
              <div style={{ fontSize: 13 }}>Star important messages to find them here</div>
            </div>
          )}

          {!loading && messages.map(msg => (
            <div
              key={msg.id}
              className="user-result-item"
              onClick={() => jumpToConversation(msg)}
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '12px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Avatar
                  src={msg.profiles?.avatar_url}
                  name={msg.profiles?.display_name}
                  size={8}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{msg.profiles?.display_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {msg.conversations?.name || 'Direct message'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {format(new Date(msg.created_at), 'dd MMM, HH:mm')}
                </div>
              </div>
              <div style={{
                fontSize: 13, color: 'var(--text-secondary)', width: '100%',
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: '8px 12px', borderLeft: '3px solid var(--accent)'
              }}>
                {getPreview(msg)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                <MessageSquare size={11} /> Jump to message
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}