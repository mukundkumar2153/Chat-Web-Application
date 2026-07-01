import { useState, useEffect } from 'react'
import { X, Phone, Video, Search, Star, Bell, BellOff, Shield, Clock, Trash2, Ban, Flag, ChevronRight, Image as ImageIcon, FileText, Film, Edit2, Check } from 'lucide-react'
import Avatar from '../ui/Avatar'
import EditContactPanel from './EditContactPanel'   // path apne folder ke mutaabik adjust karo
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { useCall } from '../../context/CallContext'
import { format } from 'date-fns'

export default function ContactInfoPanel({ conversation, onClose, onOpenSearch, onOpenStarred }) {
  const { user } = useAuth()
  const { fetchConversations, setActiveConversation, fetchMessages } = useChat()
  const { startCall } = useCall()

  const [mediaFiles, setMediaFiles] = useState([])
  const [showEditContact, setShowEditContact] = useState(false)
  const [nickname, setNickname] = useState(null)  
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [muted, setMuted] = useState(false)
  const [disappearing, setDisappearing] = useState('off')
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showReportConfirm, setShowReportConfirm] = useState(false)
  const [starredCount, setStarredCount] = useState(0)

  const otherUser = conversation?.other_user
  const isGroup = conversation?.is_group
  const name = isGroup ? conversation?.name : otherUser?.display_name || 'Unknown'
  const avatarUrl = isGroup ? conversation?.group_avatar_url : otherUser?.avatar_url

  useEffect(() => {
    if (!conversation?.id) return
    fetchMedia()
    checkBlocked()
    fetchStarredCount()
    fetchNickname()
  }, [conversation?.id])

  async function fetchNickname() {
    if (!otherUser?.id) return
    try {
      const { data } = await supabase
        .from('contact_nicknames')
        .select('first_name, last_name')
        .eq('owner_id', user.id)
        .eq('contact_id', otherUser.id)
        .maybeSingle()
      if (data && (data.first_name || data.last_name)) {
        setNickname(`${data.first_name || ''} ${data.last_name || ''}`.trim())
      } else {
        setNickname(null)
      }
    } catch (e) {
      setNickname(null)
    }
  }
  async function fetchMedia() {
    setLoadingMedia(true)
    const { data } = await supabase
      .from('messages')
      .select('id, message_type, storage_path, created_at, content, mime_type')
      .eq('conversation_id', conversation.id)
      .in('message_type', ['image', 'video', 'document'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8)
    setMediaFiles(data || [])
    setLoadingMedia(false)
  }

  async function fetchStarredCount() {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .contains('starred_by', [user.id])
      .is('deleted_at', null)
    setStarredCount(count || 0)
  }

  async function checkBlocked() {
    if (!otherUser) return
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', otherUser.id)
      .single()
    setIsBlocked(!!data)
  }

  // ── Clear Chat ──────────────────────────────────────
  async function handleClearChat() {
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
    fetchMessages(conversation.id)
    fetchConversations()
    setShowClearConfirm(false)
  }

  // ── Block / Unblock ─────────────────────────────────
  async function handleToggleBlock() {
    if (isBlocked) {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', otherUser.id)
      setIsBlocked(false)
    } else {
      await supabase
        .from('blocked_users')
        .insert({ blocker_id: user.id, blocked_id: otherUser.id })
      setIsBlocked(true)
    }
    setShowBlockConfirm(false)
  }

  // ── Report ──────────────────────────────────────────
  async function handleReport() {
    // Insert report record (simple)
    await supabase.from('blocked_users').upsert({
      blocker_id: user.id,
      blocked_id: otherUser.id,
    })
    setIsBlocked(true)
    setShowReportConfirm(false)
    alert(`${name} has been reported.`)
  }

  const imageCount = mediaFiles.filter(m => m.message_type === 'image' || m.message_type === 'video').length
  const docCount = mediaFiles.filter(m => m.message_type === 'document').length

  return (
    <div className="contact-info-panel">
      {/* Header */}
      <div className="contact-info-header">
        <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        <span style={{ fontWeight: 600, fontSize: '16px' }}>Contact info</span>
        <button className="icon-btn" title="Edit">
          <Edit2 size={18} />
        </button>
      </div>

      <div className="contact-info-body">
        {/* Profile */}
        <div className="contact-info-profile">
          <Avatar src={avatarUrl} name={name} size={20} />
          <div className="contact-info-name">{name}</div>
          {!isGroup && otherUser?.phone_number && (
            <div className="contact-info-phone">{otherUser.phone_number}</div>
          )}

          {/* Action Buttons */}
          <div className="contact-info-actions">
            <div className="contact-action-btn" onClick={() => {
              if (otherUser && conversation?.id) {
                startCall(otherUser, conversation.id, 'audio')
                onClose()
              }
            }}>
              <div className="contact-action-icon"><Phone size={20} /></div>
              <span>Voice</span>
            </div>
            <div className="contact-action-btn" onClick={() => {
              if (otherUser && conversation?.id) {
                startCall(otherUser, conversation.id, 'video')
                onClose()
              }
            }}>
              <div className="contact-action-icon"><Video size={20} /></div>
              <span>Video</span>
            </div>
            <div className="contact-action-btn" onClick={() => { onOpenSearch?.(); onClose() }}>
              <div className="contact-action-icon"><Search size={20} /></div>
              <span>Search</span>
            </div>
          </div>
        </div>

        {/* About / Status */}
        {!isGroup && (
          <div className="contact-info-section">
            <div className="contact-info-field">
              <div className="contact-info-field-label">About</div>
              <div className="contact-info-field-value">
                {otherUser?.status_text || 'Hey there! I am using WaveChat 👋'}
              </div>
            </div>
            {otherUser?.last_seen && (
              <div className="contact-info-field">
                <div className="contact-info-field-label">Last seen</div>
                <div className="contact-info-field-value">
                  {format(new Date(otherUser.last_seen), 'dd MMM yyyy, HH:mm')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Media, Links and Docs */}
        <div className="contact-info-section">
          <div className="contact-info-row" style={{ cursor: 'pointer' }}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: 'var(--accent)' }}>
                <ImageIcon size={18} />
              </div>
              <span>Media, links and docs</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              {imageCount + docCount}
              <ChevronRight size={16} />
            </div>
          </div>

          {mediaFiles.length > 0 && (
            <div className="media-grid-preview">
              {mediaFiles.slice(0, 4).map(m => (
                <div key={m.id} className="media-grid-item">
                  {m.message_type === 'document'
                    ? <div className="media-grid-doc"><FileText size={20} color="var(--text-muted)" /></div>
                    : m.message_type === 'video'
                      ? <div className="media-grid-video"><Film size={20} color="white" /></div>
                      : <div className="media-grid-img"><ImageIcon size={20} color="var(--text-muted)" /></div>
                  }
                </div>
              ))}
            </div>
          )}

          {mediaFiles.length === 0 && !loadingMedia && (
            <div style={{ padding: '8px 20px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
              No media shared yet
            </div>
          )}
        </div>

        {/* Starred Messages */}
        <div className="contact-info-section">
          <div className="contact-info-row" style={{ cursor: 'pointer' }}
            onClick={() => { onOpenStarred?.(); onClose() }}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: '#FFAB2E' }}>
                <Star size={18} />
              </div>
              <span>Starred messages</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              {starredCount > 0 && starredCount}
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Chat Settings */}
        <div className="contact-info-section">
          {/* Disappearing Messages */}
          <div className="contact-info-row" style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setShowDisappearingMenu(p => !p)}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon"><Clock size={18} /></div>
              <div>
                <div>Disappearing messages</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {disappearing === 'off' ? 'Off' : disappearing}
                </div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
            {showDisappearingMenu && (
              <div className="dropdown" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10 }}>
                {['off', '24 hours', '7 days', '90 days'].map(opt => (
                  <div key={opt}
                    className={`dropdown-item ${disappearing === opt ? 'active' : ''}`}
                    onClick={e => { e.stopPropagation(); setDisappearing(opt); setShowDisappearingMenu(false) }}>
                    {disappearing === opt && <Check size={13} />}
                    {opt === 'off' ? 'Off' : opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Chat Privacy */}
          <div className="contact-info-row">
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon"><Shield size={18} /></div>
              <div>
                <div>Advanced chat privacy</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Off</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>

          {/* Encryption */}
          <div className="contact-info-row">
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: 'var(--online)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div>Encryption</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Messages are end-to-end encrypted. Click to verify.
                </div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Notification */}
        <div className="contact-info-section">
          <div className="contact-info-row" style={{ cursor: 'pointer' }}
            onClick={() => setMuted(p => !p)}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon">
                {muted ? <BellOff size={18} /> : <Bell size={18} />}
              </div>
              <div>
                <div>Notification settings</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {muted ? 'Muted' : 'Unmuted'}
                </div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="contact-info-section">

          {/* Clear Chat */}
          {!showClearConfirm ? (
            <div className="contact-info-row danger-row" style={{ cursor: 'pointer' }}
              onClick={() => setShowClearConfirm(true)}>
              <div className="contact-info-row-left">
                <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}><Trash2 size={18} /></div>
                <span style={{ color: 'var(--danger)' }}>Clear chat</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 20px', background: 'rgba(255,84,112,0.08)', borderRadius: 8, margin: '4px 12px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                Clear all messages in this chat?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleClearChat} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}>Clear</button>
                <button onClick={() => setShowClearConfirm(false)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Block */}
          {!isGroup && (
            <>
              {!showBlockConfirm ? (
                <div className="contact-info-row danger-row" style={{ cursor: 'pointer' }}
                  onClick={() => setShowBlockConfirm(true)}>
                  <div className="contact-info-row-left">
                    <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}><Ban size={18} /></div>
                    <span style={{ color: 'var(--danger)' }}>
                      {isBlocked ? `Unblock ${name}` : `Block ${name}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', background: 'rgba(255,84,112,0.08)', borderRadius: 8, margin: '4px 12px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                    {isBlocked ? `Unblock ${name}?` : `Block ${name}? They won't be able to message you.`}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleToggleBlock} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                      background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600
                    }}>{isBlocked ? 'Unblock' : 'Block'}</button>
                    <button onClick={() => setShowBlockConfirm(false)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13
                    }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Report */}
              {!showReportConfirm ? (
                <div className="contact-info-row danger-row" style={{ cursor: 'pointer' }}
                  onClick={() => setShowReportConfirm(true)}>
                  <div className="contact-info-row-left">
                    <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}><Flag size={18} /></div>
                    <span style={{ color: 'var(--danger)' }}>Report {name}</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', background: 'rgba(255,84,112,0.08)', borderRadius: 8, margin: '4px 12px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                    Report {name} for inappropriate behavior?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleReport} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                      background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600
                    }}>Report</button>
                    <button onClick={() => setShowReportConfirm(false)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}