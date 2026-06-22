import { useState } from 'react'
import { Search, X, User, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { createAndDistributeConversationKey } from '../../lib/encryption'
import Avatar from '../ui/Avatar'

export default function NewChatModal({ onClose }) {
  const { user } = useAuth()
  const { setActiveConversation, fetchConversations } = useChat()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  async function handleSearch(q) {
    setQuery(q)
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, status_text, is_online, public_key')
      .ilike('display_name', `%${q}%`)
      .neq('id', user.id)
      .limit(10)
    setResults(data || [])
    setLoading(false)
  }

  async function startConversation(otherUser) {
    if (starting) return
    setStarting(true)
    try {
      // Check if DM already exists
      const { data: existing } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations!inner(id, is_group)')
        .eq('user_id', user.id)
        .eq('conversations.is_group', false)

      if (existing) {
        for (const cm of existing) {
          const { data: members } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', cm.conversation_id)
          if (members?.length === 2 && members.some(m => m.user_id === otherUser.id)) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', cm.conversation_id)
              .single()
            setActiveConversation({ ...conv, other_user: otherUser })
            onClose()
            return
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({ is_group: false, created_by: user.id })
        .select()
        .single()
      if (convErr) throw convErr

      await supabase.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUser.id },
      ])

      // Set up end-to-end encryption for this conversation right away
      await createAndDistributeConversationKey({
        conversationId: conv.id,
        memberUserIds: [user.id, otherUser.id],
        myUserId: user.id,
      })

      setActiveConversation({ ...conv, other_user: otherUser, unread_count: 0, last_message: null })
      fetchConversations()
      onClose()
    } catch (err) {
      console.error('Failed to start conversation:', err)
      setStartError(err.message || 'Could not start this chat')
      setTimeout(() => setStartError(''), 4000)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="modal-title">New Chat</div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="search-input-wrap">
          <Search size={15} color="var(--text-muted)" />
          <input
            placeholder="Search by name..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
            style={{ fontSize: '14px' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: '120px' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <div className="spinner" />
            </div>
          )}
          {!loading && results.length === 0 && query.length > 1 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No users found
            </div>
          )}
          {!loading && results.length === 0 && query.length <= 1 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <User size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              Type at least 2 characters to search
            </div>
          )}
          {results.map(u => (
            <div key={u.id} className="user-result-item" onClick={() => startConversation(u)} style={{ opacity: starting ? 0.6 : 1, pointerEvents: starting ? 'none' : 'auto' }}>
              <Avatar src={u.avatar_url} name={u.display_name} size={12} showOnline isOnline={u.is_online} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-display)' }}>{u.display_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.status_text || 'WaveChat user'}
                </div>
              </div>
              {u.public_key && <ShieldCheck size={15} color="var(--online)" title="Encryption ready" />}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', justifyContent: 'center' }}>
          <ShieldCheck size={12} /> Chats are end-to-end encrypted
        </div>
        {startError && (
          <div className="error-msg" style={{ justifyContent: 'center' }}>{startError}</div>
        )}
      </div>
    </div>
  )
}