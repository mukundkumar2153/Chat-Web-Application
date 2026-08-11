import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Waves, Camera, User, AlertCircle } from 'lucide-react'

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [statusText, setStatusText] = useState('Hey there! I am using WaveChat 👋')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!displayName.trim()) { setError('Display name is required'); return }
    setLoading(true)
    setError('')

    let avatarUrl = null
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
      if (uploadError) { setError('Failed to upload avatar'); setLoading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = publicUrl
    }

    const { error } = await updateProfile({
      display_name: displayName.trim(),
      status_text: statusText.trim(),
      avatar_url: avatarUrl,
      phone_number: null,
      is_online: true,
      last_seen: new Date().toISOString(),
      privacy_last_seen: 'everyone',
      privacy_profile_photo: 'everyone',
      notifications_enabled: true,
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Waves size={26} color="white" />
          </div>
          <span className="auth-logo-name">WaveChat</span>
        </div>

        <div className="auth-title">Set up your profile</div>
        <div className="auth-sub">This is how others will see you on WaveChat</div>

        <form onSubmit={handleSubmit}>
          <div className="avatar-upload">
            <div className="avatar-upload-circle" onClick={() => fileRef.current?.click()}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" />
              ) : (
                <User size={32} color="var(--text-muted)" />
              )}
              <div className="avatar-upload-overlay">
                <Camera size={22} color="white" />
              </div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tap to add photo</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Display name *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status / Bio</label>
            <input
              className="form-input"
              type="text"
              placeholder="What's on your mind?"
              value={statusText}
              onChange={e => setStatusText(e.target.value)}
              maxLength={120}
            />
          </div>

          {error && (
            <div className="error-msg">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !displayName.trim()}
            style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Get Started →'}
          </button>
        </form>
      </div>
    </div>
  )
}
