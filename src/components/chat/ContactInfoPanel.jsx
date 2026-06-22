import { useState, useEffect } from 'react'
import { X, Phone, Video, Search, Star, Bell, BellOff, Shield, Clock, Trash2, Ban, Flag, ChevronRight, Image as ImageIcon, FileText, Film } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

export default function ContactInfoPanel({ conversation, onClose, onOpenSearch }) {
  const { user } = useAuth()
  const [mediaFiles, setMediaFiles] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [muted, setMuted] = useState(false)
  const [disappearing, setDisappearing] = useState('off')
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false)

  const otherUser = conversation?.other_user
  const isGroup = conversation?.is_group
  const name = isGroup ? conversation?.name : otherUser?.display_name || 'Unknown'
  const avatarUrl = isGroup ? conversation?.group_avatar_url : otherUser?.avatar_url

  useEffect(() => {
    if (!conversation?.id) return
    fetchMedia()
  }, [conversation?.id])

  async function fetchMedia() {
    setLoadingMedia(true)
    const { data } = await supabase
      .from('messages')
      .select('id, message_type, thumbnail_ciphertext, storage_path, created_at, content, mime_type')
      .eq('conversation_id', conversation.id)
      .in('message_type', ['image', 'video', 'document'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(12)
    setMediaFiles(data || [])
    setLoadingMedia(false)
  }

  const imageCount = mediaFiles.filter(m => m.message_type === 'image' || m.message_type === 'video').length
  const docCount = mediaFiles.filter(m => m.message_type === 'document').length

  return (
    <div className="contact-info-panel">
      {/* Header */}
      <div className="contact-info-header">
        <button className="icon-btn" onClick={onClose}>
          <X size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: '16px' }}>Contact info</span>
        <button className="icon-btn" title="Edit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      <div className="contact-info-body">
        {/* Profile Section */}
        <div className="contact-info-profile">
          <Avatar src={avatarUrl} name={name} size={20} />
          <div className="contact-info-name">{name}</div>
          {!isGroup && otherUser?.phone_number && (
            <div className="contact-info-phone">{otherUser.phone_number}</div>
          )}
          {isGroup && (
            <div className="contact-info-phone">{conversation?.members_count || ''} members</div>
          )}

          {/* Action Buttons */}
          <div className="contact-info-actions">
            <div className="contact-action-btn">
              <div className="contact-action-icon"><Phone size={20} /></div>
              <span>Voice</span>
            </div>
            <div className="contact-action-btn">
              <div className="contact-action-icon"><Video size={20} /></div>
              <span>Video</span>
            </div>
            <div className="contact-action-btn" onClick={onOpenSearch}>
              <div className="contact-action-icon"><Search size={20} /></div>
              <span>Search</span>
            </div>
          </div>
        </div>

        {/* About/Status */}
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
          <div
            className="contact-info-row"
            style={{ cursor: 'pointer' }}
          >
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: 'var(--accent)' }}>
                <ImageIcon size={18} />
              </div>
              <span>Media, links and docs</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              {imageCount + docCount}
              <ChevronRight size={16} />
            </div>
          </div>

          {/* Media Grid Preview */}
          {mediaFiles.length > 0 && (
            <div className="media-grid-preview">
              {mediaFiles.slice(0, 4).map(m => (
                <div key={m.id} className="media-grid-item">
                  {m.message_type === 'document' ? (
                    <div className="media-grid-doc">
                      <FileText size={20} color="var(--text-muted)" />
                    </div>
                  ) : m.message_type === 'video' ? (
                    <div className="media-grid-video">
                      <Film size={20} color="white" />
                    </div>
                  ) : (
                    <div className="media-grid-img">
                      <ImageIcon size={20} color="var(--text-muted)" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Starred Messages */}
        <div className="contact-info-section">
          <div className="contact-info-row">
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: '#FFAB2E' }}>
                <Star size={18} />
              </div>
              <span>Starred messages</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Chat Settings */}
        <div className="contact-info-section">
          {/* Disappearing Messages */}
          <div className="contact-info-row" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowDisappearingMenu(p => !p)}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon">
                <Clock size={18} />
              </div>
              <div>
                <div>Disappearing messages</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {disappearing === 'off' ? 'Off' : disappearing}
                </div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
            {showDisappearingMenu && (
              <div className="dropdown" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10 }}>
                {['off', '24 hours', '7 days', '90 days'].map(opt => (
                  <div key={opt} className={`dropdown-item ${disappearing === opt ? 'active' : ''}`}
                    onClick={e => { e.stopPropagation(); setDisappearing(opt); setShowDisappearingMenu(false) }}>
                    {opt === 'off' ? 'Off' : opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Chat Privacy */}
          <div className="contact-info-row">
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon">
                <Shield size={18} />
              </div>
              <div>
                <div>Advanced chat privacy</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Off</div>
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
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Messages are end-to-end encrypted. Click to verify.
                </div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Mute / Notification */}
        <div className="contact-info-section">
          <div className="contact-info-row" onClick={() => setMuted(p => !p)} style={{ cursor: 'pointer' }}>
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon">
                {muted ? <BellOff size={18} /> : <Bell size={18} />}
              </div>
              <span>Notification settings</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="contact-info-section">
          <div className="contact-info-row danger-row">
            <div className="contact-info-row-left">
              <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}>
                <Trash2 size={18} />
              </div>
              <span style={{ color: 'var(--danger)' }}>Clear chat</span>
            </div>
          </div>
          {!isGroup && (
            <>
              <div className="contact-info-row danger-row">
                <div className="contact-info-row-left">
                  <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}>
                    <Ban size={18} />
                  </div>
                  <span style={{ color: 'var(--danger)' }}>Block {name}</span>
                </div>
              </div>
              <div className="contact-info-row danger-row">
                <div className="contact-info-row-left">
                  <div className="contact-info-row-icon" style={{ color: 'var(--danger)' }}>
                    <Flag size={18} />
                  </div>
                  <span style={{ color: 'var(--danger)' }}>Report {name}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}