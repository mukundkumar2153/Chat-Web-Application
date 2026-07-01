import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Trash2, Phone, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase' // apne path ke mutabik adjust karo

export default function EditContactPanel({ otherUser, onClose, onDeleted }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const debounceRef = useRef(null)

  // Current logged in user
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user)
    })
  }, [])

  // Load existing nickname on mount
  useEffect(() => {
    if (!currentUser?.id || !otherUser?.id) return
    fetchNickname()
  }, [currentUser?.id, otherUser?.id])

  async function fetchNickname() {
    setLoading(true)
    const { data } = await supabase
      .from('contact_nicknames')
      .select('first_name, last_name')
      .eq('owner_id', currentUser.id)
      .eq('contact_id', otherUser.id)
      .maybeSingle()

    if (data) {
      setFirstName(data.first_name || '')
      setLastName(data.last_name || '')
    } else {
      // Pre-fill with existing display_name as default
      const parts = (otherUser?.display_name || '').split(' ')
      setFirstName(parts[0] || '')
      setLastName(parts.slice(1).join(' ') || '')
    }
    setLoading(false)
  }

  // Auto-save with debounce (600ms)
  function handleChange(field, value) {
    if (field === 'first') setFirstName(value)
    else setLastName(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveNickname(
        field === 'first' ? value : firstName,
        field === 'last' ? value : lastName
      )
    }, 600)
  }

  async function saveNickname(fn, ln) {
    if (!currentUser?.id || !otherUser?.id) return
    setSaving(true)
    await supabase
      .from('contact_nicknames')
      .upsert(
        {
          owner_id: currentUser.id,
          contact_id: otherUser.id,
          first_name: fn.trim(),
          last_name: ln.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id,contact_id' }
      )
    setSaving(false)
  }

  async function handleDeleteContact() {
    if (!currentUser?.id || !otherUser?.id) return
    setDeleting(true)

    // Nickname bhi delete karo
    await supabase
      .from('contact_nicknames')
      .delete()
      .eq('owner_id', currentUser.id)
      .eq('contact_id', otherUser.id)

    // ⚠️ Apni contacts table ka naam/column yahan update karo
    // Example: agar table "contacts" hai owner_id + contact_id ke saath:
    await supabase
      .from('contacts')
      .delete()
      .eq('owner_id', currentUser.id)
      .eq('contact_id', otherUser.id)

    setDeleting(false)
    setShowDeleteConfirm(false)
    onDeleted() // parent ko signal do - panel band karo
  }

  const displayPhone = otherUser?.phone_number || 'No number'
  const avatarUrl = otherUser?.avatar_url
  const initials = ((firstName || otherUser?.display_name || '?')[0] || '?').toUpperCase()

  return (
    <div className="edit-contact-panel">
      {/* ── Header ── */}
      <div className="ecp-header">
        <button className="icon-btn" onClick={onClose} title="Back">
          <ArrowLeft size={20} />
        </button>
        <span className="ecp-title">Edit contact</span>
        <button
          className="icon-btn ecp-delete-btn"
          title="Delete contact"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* ── Avatar ── */}
      <div className="ecp-avatar-section">
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="ecp-avatar" />
        ) : (
          <div className="ecp-avatar ecp-avatar-fallback">{initials}</div>
        )}
        {saving && <span className="ecp-saving-badge">Saving…</span>}
      </div>

      {/* ── Name Fields ── */}
      {loading ? (
        <div className="ecp-loading">Loading…</div>
      ) : (
        <div className="ecp-fields">
          <div className="ecp-field-group">
            <label className="ecp-label">First name</label>
            <input
              className="ecp-input"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => handleChange('first', e.target.value)}
            />
          </div>
          <div className="ecp-field-group">
            <label className="ecp-label">Last name</label>
            <input
              className="ecp-input"
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => handleChange('last', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Phone Info (read-only) ── */}
      <div className="ecp-phone-section">
        <div className="ecp-phone-row">
          <div className="ecp-phone-icon-wrap">
            <Phone size={18} />
          </div>
          <div className="ecp-phone-details">
            <span className="ecp-phone-number">{displayPhone}</span>
            <span className="ecp-phone-sub">
              <Check size={12} className="ecp-check-icon" />
              This number is on WaveChat
            </span>
          </div>
        </div>
      </div>

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && (
        <div className="ecp-modal-overlay">
          <div className="ecp-modal">
            <h3 className="ecp-modal-title">Delete contact?</h3>
            <p className="ecp-modal-body">
              <strong>{firstName || otherUser?.display_name}</strong> ko apni contact list se hata doge.
              Ye sirf tumhari list se hatega.
            </p>
            <div className="ecp-modal-actions">
              <button
                className="ecp-btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="ecp-btn-delete"
                onClick={handleDeleteContact}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Styles ── */}
      <style>{`
        .edit-contact-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary, #111b21);
          color: var(--text-primary, #e9edef);
          font-family: inherit;
          position: relative;
          overflow-y: auto;
        }

        /* Header */
        .ecp-header {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          background: var(--bg-secondary, #202c33);
          gap: 12px;
          min-height: 56px;
        }
        .ecp-title {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #e9edef);
        }
        .ecp-delete-btn {
          color: var(--danger, #ef4444) !important;
        }
        .ecp-delete-btn:hover {
          background: rgba(239, 68, 68, 0.12) !important;
        }

        /* Avatar */
        .ecp-avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 28px 16px 16px;
          gap: 8px;
        }
        .ecp-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
        }
        .ecp-avatar-fallback {
          background: var(--accent, #00a884);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 600;
          color: #fff;
        }
        .ecp-saving-badge {
          font-size: 12px;
          color: var(--text-secondary, #8696a0);
          background: var(--bg-secondary, #202c33);
          padding: 2px 10px;
          border-radius: 10px;
        }

        /* Loading */
        .ecp-loading {
          text-align: center;
          padding: 24px;
          color: var(--text-secondary, #8696a0);
          font-size: 14px;
        }

        /* Name Fields */
        .ecp-fields {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin: 0 0 8px;
          background: var(--bg-secondary, #202c33);
          border-radius: 4px;
          overflow: hidden;
        }
        .ecp-field-group {
          display: flex;
          flex-direction: column;
          padding: 10px 20px 10px;
          border-bottom: 1px solid var(--border, #2a3942);
        }
        .ecp-field-group:last-child {
          border-bottom: none;
        }
        .ecp-label {
          font-size: 12px;
          color: var(--accent, #00a884);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .ecp-input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary, #e9edef);
          font-size: 16px;
          padding: 0;
          width: 100%;
          caret-color: var(--accent, #00a884);
        }
        .ecp-input::placeholder {
          color: var(--text-secondary, #8696a0);
        }

        /* Phone section */
        .ecp-phone-section {
          background: var(--bg-secondary, #202c33);
          margin-top: 8px;
          padding: 14px 20px;
        }
        .ecp-phone-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .ecp-phone-icon-wrap {
          color: var(--text-secondary, #8696a0);
          display: flex;
          align-items: center;
        }
        .ecp-phone-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ecp-phone-number {
          font-size: 16px;
          color: var(--text-primary, #e9edef);
        }
        .ecp-phone-sub {
          font-size: 12px;
          color: var(--text-secondary, #8696a0);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ecp-check-icon {
          color: var(--accent, #00a884);
        }

        /* Delete confirm modal */
        .ecp-modal-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          padding: 16px;
        }
        .ecp-modal {
          background: var(--bg-secondary, #202c33);
          border-radius: 12px;
          padding: 24px 20px 16px;
          width: 100%;
          max-width: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .ecp-modal-title {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-primary, #e9edef);
          margin: 0 0 10px;
        }
        .ecp-modal-body {
          font-size: 14px;
          color: var(--text-secondary, #8696a0);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .ecp-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .ecp-btn-cancel {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--accent, #00a884);
          font-size: 15px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
        }
        .ecp-btn-cancel:hover {
          background: rgba(0,168,132,0.1);
        }
        .ecp-btn-delete {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--danger, #ef4444);
          font-size: 15px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
        }
        .ecp-btn-delete:hover {
          background: rgba(239,68,68,0.12);
        }
        .ecp-btn-delete:disabled,
        .ecp-btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}