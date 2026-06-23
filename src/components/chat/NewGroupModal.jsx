import { useState } from 'react'
import { X, Search, Users, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { createAndDistributeConversationKey } from '../../lib/encryption'
import Avatar from '../ui/Avatar'

export default function NewGroupModal({ onClose }) {
  const { user } = useAuth()
  const { setActiveConversation, fetchConversations } = useChat()
  const [step, setStep] = useState('members') // members | name
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([]) // array of user objects
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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

  function toggleUser(u) {
    setSelected(prev =>
      prev.find(p => p.id === u.id)
        ? prev.filter(p => p.id !== u.id)
        : [...prev, u]
    )
  }

  async function createGroup() {
    if (!groupName.trim()) { setError('Enter a group name'); return }
    if (selected.length < 1) { setError('Add at least 1 member'); return }
    setCreating(true)
    setError('')

    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          is_group: true,
          name: groupName.trim(),
          created_by: user.id,
        })
        .select()
        .single()
      if (convErr) throw convErr

      const memberIds = [user.id, ...selected.map(u => u.id)]
      await supabase.from('conversation_members').insert(
        memberIds.map(uid => ({
          conversation_id: conv.id,
          user_id: uid,
          role: uid === user.id ? 'admin' : 'member',
        }))
      )

      await createAndDistributeConversationKey({
        conversationId: conv.id,
        memberUserIds: memberIds,
        myUserId: user.id,
      })

      setActiveConversation({ ...conv, other_user: null, unread_count: 0, last_message: null })
      fetchConversations()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step === 'name' && (
              <button className="icon-btn" onClick={() => setStep('members')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </button>
            )}
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} /> {step === 'members' ? 'Add Members' : 'Group Name'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {step === 'members' && (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selected.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'var(--accent)', color: 'white',
                    borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600
                  }}>
                    {u.display_name}
                    <button onClick={() => toggleUser(u)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="search-input-wrap" style={{ marginBottom: 12 }}>
              <Search size={15} color="var(--text-muted)" />
              <input
                placeholder="Search people..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ minHeight: 180, maxHeight: 300, overflowY: 'auto' }}>
              {loading && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" /></div>}
              {!loading && results.map(u => {
                const isSelected = selected.find(p => p.id === u.id)
                return (
                  <div key={u.id} className="user-result-item" onClick={() => toggleUser(u)}
                    style={{ background: isSelected ? 'var(--bg-elevated)' : 'transparent' }}>
                    <Avatar src={u.avatar_url} name={u.display_name} size={10} showOnline isOnline={u.is_online} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.display_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.status_text || 'WaveChat user'}</div>
                    </div>
                    {isSelected && (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} color="white" />
                      </div>
                    )}
                  </div>
                )
              })}
              {!loading && results.length === 0 && query.length > 1 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No users found</div>
              )}
            </div>

            <button
              className="btn-primary"
              style={{ marginTop: 12 }}
              disabled={selected.length === 0}
              onClick={() => setStep('name')}
            >
              Next ({selected.length} selected)
            </button>
          </>
        )}

        {step === 'name' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} color="white" />
              </div>
              <input
                className="form-input"
                placeholder="Group name (required)"
                value={groupName}
                onChange={e => { setGroupName(e.target.value); setError('') }}
                autoFocus
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selected.length + 1} members (including you)
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar src={u.avatar_url} name={u.display_name} size={8} />
                  <span style={{ fontSize: 12 }}>{u.display_name}</span>
                </div>
              ))}
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

            <button
              className="btn-primary"
              onClick={createGroup}
              disabled={creating || !groupName.trim()}
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}