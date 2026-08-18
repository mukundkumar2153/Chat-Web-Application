import {
  ArrowLeft, Camera, Bell, Lock, Shield, UserX, LogOut, Trash2,
  ChevronRight, Eye, ShieldCheck, AlertTriangle, KeyRound,
  Monitor, MessageSquare, Video, Keyboard, HelpCircle, Key,
  Mic, VideoIcon, Smartphone, QrCode, Cloud, Upload, Download, Plus, CheckCircle, RefreshCw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { supabase } from '../../lib/supabase'
import { fingerprint } from '../../lib/crypto'
import { isAppLockEnabled } from '../../lib/appLock'
import Avatar from '../ui/Avatar'
import PassphraseSetupModal from './PassphraseSetupModal'
import QRLinkModal from './QRLinkModal'
import { fetchKeyBackupFromSupabase } from '../../lib/keyBackup'
import { fetchLinkedDevices, revokeLinkedDevice } from '../../lib/qrLinking'
import { authenticateGoogleDrive, getGoogleAccessToken, uploadChatBackupToDrive, downloadChatBackupFromDrive, getStoredGoogleClientId, saveGoogleClientId } from '../../lib/googleDrive'

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle} style={{ cursor: 'pointer' }}>
      <div className="toggle-thumb" />
    </div>
  )
}

function SettingRow({ icon, label, sub, right, onClick, danger }) {
  return (
    <div className="settings-row" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="settings-row-left">
        <div className="settings-row-icon" style={danger ? { color: 'var(--danger)' } : {}}>{icon}</div>
        <div>
          <div className="settings-row-label" style={danger ? { color: 'var(--danger)' } : {}}>{label}</div>
          {sub && <div className="settings-row-sub">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

export default function SettingsPage({ onBack }) {
  const { user, profile, updateProfile, signOut, encryptionStatus, resetEncryptionKeys } = useAuth()
  const { messages, conversations } = useChat()
  const [section, setSection] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [editName, setEditName] = useState(false)
  const [editStatus, setEditStatus] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [statusText, setStatusText] = useState(profile?.status_text || '')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const [showPassphraseModal, setShowPassphraseModal] = useState(false)
  const [showQRLinkModal, setShowQRLinkModal] = useState(false)
  const [hasKeyBackup, setHasKeyBackup] = useState(false)
  const [linkedDevices, setLinkedDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  // Google Drive state
  const [gdriveClientId, setGdriveClientId] = useState(() => getStoredGoogleClientId())
  const [gdriveToken, setGdriveToken] = useState(() => getGoogleAccessToken())
  const [gdriveStatus, setGdriveStatus] = useState('')
  const [gdriveLoading, setGdriveLoading] = useState(false)
  const [passphrasePrompt, setPassphrasePrompt] = useState('')

  useEffect(() => {
    if (user?.id) {
      fetchKeyBackupFromSupabase(user.id).then(b => setHasKeyBackup(!!b)).catch(() => {})
      loadDevices()
    }
  }, [user])

  async function loadDevices() {
    if (!user?.id) return
    setLoadingDevices(true)
    try {
      const devs = await fetchLinkedDevices(user.id)
      setLinkedDevices(devs)
    } catch (e) { console.error(e) }
    finally { setLoadingDevices(false) }
  }

  async function handleUnlinkDevice(deviceId) {
    if (!window.confirm('Unlink this device from your WaveChat account?')) return
    await revokeLinkedDevice(user.id, deviceId)
    loadDevices()
  }

  async function handleGoogleDriveConnect() {
    if (!gdriveClientId.trim()) {
      alert('Please enter a valid Google OAuth Client ID first')
      return
    }
    saveGoogleClientId(gdriveClientId.trim())
    authenticateGoogleDrive({
      clientId: gdriveClientId.trim(),
      onSuccess: (authData) => {
        setGdriveToken(authData.token)
        setGdriveStatus('Connected to Google Drive!')
      },
      onError: (err) => {
        setGdriveStatus('Google Drive error: ' + err.message)
      }
    })
  }

  async function handleBackupToDrive() {
    if (!passphrasePrompt.trim()) {
      alert('Please enter your 12-word recovery passphrase to encrypt the backup before uploading')
      return
    }
    setGdriveLoading(true)
    setGdriveStatus('Preparing backup...')
    try {
      await uploadChatBackupToDrive({
        messagesData: { conversations, messagesCount: messages.length },
        passphrase: passphrasePrompt.trim(),
        onProgress: setGdriveStatus,
      })
    } catch (err) {
      setGdriveStatus('Backup failed: ' + err.message)
    } finally {
      setGdriveLoading(false)
    }
  }

  async function handleRestoreFromDrive() {
    if (!passphrasePrompt.trim()) {
      alert('Please enter your 12-word recovery passphrase to decrypt the cloud backup')
      return
    }
    setGdriveLoading(true)
    setGdriveStatus('Fetching backup from Google Drive...')
    try {
      const data = await downloadChatBackupFromDrive({
        passphrase: passphrasePrompt.trim(),
        onProgress: setGdriveStatus,
      })
      alert(`Restored cloud backup from ${data.exported_at}! Reloading...`)
      window.location.reload()
    } catch (err) {
      setGdriveStatus('Restore failed: ' + err.message)
    } finally {
      setGdriveLoading(false)
    }
  }

  const [notifs, setNotifs] = useState(profile?.notifications_enabled ?? true)
  const [privacyLastSeen, setPrivacyLastSeen] = useState(profile?.privacy_last_seen || 'everyone')
  const [privacyPhoto, setPrivacyPhoto] = useState(profile?.privacy_profile_photo || 'everyone')
  const [allowVoiceRec, setAllowVoiceRec] = useState(profile?.allow_voice_recording ?? false)
  const [allowVideoRec, setAllowVideoRec] = useState(profile?.allow_video_recording ?? false)
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('wavechat_theme') || 'default')

  function applyTheme(themeId) {
    setCurrentTheme(themeId)
    localStorage.setItem('wavechat_theme', themeId)
    document.documentElement.setAttribute('data-theme', themeId)
  }

  async function saveField(field, value) {
    setSaving(true)
    await updateProfile({ [field]: value })
    setSaving(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile({ avatar_url: publicUrl })
    }
  }

  const categories = [
    { id: 'general', icon: <Monitor size={20} />, label: 'General', sub: 'Startup and close' },
    { id: 'account', icon: <Key size={20} />, label: 'Account', sub: 'Security, encryption, passphrase backup' },
    { id: 'devices', icon: <Smartphone size={20} />, label: 'Linked Devices', sub: 'Multi-device pairing & QR' },
    { id: 'privacy', icon: <Shield size={20} />, label: 'Privacy', sub: 'Blocked contacts, recording, app lock' },
    { id: 'chats', icon: <MessageSquare size={20} />, label: 'Chats', sub: 'Theme, Google Drive backup' },
    { id: 'voice', icon: <Video size={20} />, label: 'Video & voice', sub: 'Camera, microphone & speakers' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Notifications', sub: 'Message notifications' },
    { id: 'keyboard', icon: <Keyboard size={20} />, label: 'Keyboard shortcuts', sub: 'Quick actions' },
    { id: 'help', icon: <HelpCircle size={20} />, label: 'Help and feedback', sub: 'Help centre, contact us, privacy policy' },
  ]

  // ── Sub-section render ─────────────────────────────────────────
  if (section) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <button className="icon-btn" onClick={() => setSection(null)}><ArrowLeft size={20} /></button>
          <div className="settings-header-title">{categories.find(c => c.id === section)?.label || section}</div>
        </div>
        <div className="settings-body">

          {/* ── ACCOUNT ── */}
          {section === 'account' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Profile</div>
                {/* Avatar */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar src={profile?.avatar_url} name={profile?.display_name} size={16} />
                    <div onClick={() => fileRef.current?.click()} style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', border: '2px solid var(--bg-surface)'
                    }}>
                      <Camera size={15} color="white" />
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </div>
                </div>
                {/* Name */}
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><UserX size={16} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="settings-row-label">Name</div>
                      {editName ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus style={{ flex: 1, padding: '5px 8px', fontSize: 13 }} />
                          <button className="btn-primary" style={{ width: 'auto', padding: '5px 12px', fontSize: 12 }} onClick={() => { saveField('display_name', displayName); setEditName(false) }}>Save</button>
                        </div>
                      ) : (
                        <div className="settings-row-sub" style={{ cursor: 'pointer' }} onClick={() => setEditName(true)}>{profile?.display_name}</div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Status */}
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><MessageSquare size={16} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="settings-row-label">About</div>
                      {editStatus ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input className="form-input" value={statusText} onChange={e => setStatusText(e.target.value)} autoFocus style={{ flex: 1, padding: '5px 8px', fontSize: 13 }} />
                          <button className="btn-primary" style={{ width: 'auto', padding: '5px 12px', fontSize: 12 }} onClick={() => { saveField('status_text', statusText); setEditStatus(false) }}>Save</button>
                        </div>
                      ) : (
                        <div className="settings-row-sub" style={{ cursor: 'pointer' }} onClick={() => setEditStatus(true)}>{profile?.status_text || 'Add status...'}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="settings-row" style={{ cursor: 'default' }}>
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><Key size={16} /></div>
                    <div>
                      <div className="settings-row-label">Email</div>
                      <div className="settings-row-sub">{user?.email}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Encryption */}
              <div className="settings-section">
                <div className="settings-section-title">Encryption</div>
                <div className="settings-row" style={{ cursor: 'default' }}>
                  <div className="settings-row-left">
                    <div className="settings-row-icon" style={{ color: encryptionStatus === 'ready' ? 'var(--online)' : 'var(--warning)' }}>
                      {encryptionStatus === 'ready' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div>
                      <div className="settings-row-label">{encryptionStatus === 'ready' ? 'E2E Encryption active' : 'Encryption key missing'}</div>
                      <div className="settings-row-sub">{encryptionStatus === 'ready' ? 'Messages encrypted before leaving device' : 'Reset keys to start fresh on this device'}</div>
                    </div>
                  </div>
                </div>
                {encryptionStatus === 'ready' && profile?.public_key && (
                  <div className="settings-row" style={{ cursor: 'default' }}>
                    <div className="settings-row-left">
                      <div className="settings-row-icon"><KeyRound size={16} /></div>
                      <div>
                        <div className="settings-row-label">Security code</div>
                        <div className="settings-row-sub" style={{ fontFamily: 'monospace' }}>{fingerprint(profile.public_key)}</div>
                      </div>
                    </div>
                  </div>
                )}
                {encryptionStatus === 'missing-local-key' && (
                  <div className="settings-row" onClick={async () => { if (resetting) return; setResetting(true); await resetEncryptionKeys(); setResetting(false) }}>
                    <div className="settings-row-left">
                      <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><KeyRound size={16} /></div>
                      <div>
                        <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Reset encryption keys</div>
                        <div className="settings-row-sub">Old chats will be unreadable</div>
                      </div>
                    </div>
                    {resetting && <div className="spinner" style={{ width: 16, height: 16 }} />}
                  </div>
                )}
                {/* Encrypted Key Backup */}
                <div className="settings-row" onClick={() => setShowPassphraseModal(true)} style={{ cursor: 'pointer' }}>
                  <div className="settings-row-left">
                    <div className="settings-row-icon" style={{ color: 'var(--accent)' }}><Key size={16} /></div>
                    <div>
                      <div className="settings-row-label">12-Word Recovery Passphrase</div>
                      <div className="settings-row-sub">
                        {hasKeyBackup ? '✓ Encrypted backup saved to cloud' : 'Create 12-word recovery backup'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>

              {/* Danger zone */}
              <div className="settings-section">
                <div className="settings-section-title">Account</div>
                <SettingRow icon={<LogOut size={16} />} label="Log Out" danger onClick={signOut} />
                <SettingRow icon={<Trash2 size={16} />} label="Delete Account" sub="Permanently delete your account and data" danger />
              </div>
            </>
          )}

          {/* ── LINKED DEVICES ── */}
          {section === 'devices' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Device Pairing</div>
                <div className="settings-row" onClick={() => setShowQRLinkModal(true)} style={{ cursor: 'pointer' }}>
                  <div className="settings-row-left">
                    <div className="settings-row-icon" style={{ color: 'var(--accent)' }}><QrCode size={18} /></div>
                    <div>
                      <div className="settings-row-label" style={{ fontWeight: 600 }}>Link a Device</div>
                      <div className="settings-row-sub">Scan QR code to pair another phone or browser</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Linked Devices</div>
                {loadingDevices ? (
                  <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Loading devices...</div>
                ) : linkedDevices.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                    No secondary devices linked yet.
                  </div>
                ) : (
                  linkedDevices.map(dev => (
                    <div key={dev.id} className="settings-row" style={{ cursor: 'default' }}>
                      <div className="settings-row-left">
                        <div className="settings-row-icon"><Smartphone size={16} /></div>
                        <div>
                          <div className="settings-row-label">{dev.device_name}</div>
                          <div className="settings-row-sub">Linked: {new Date(dev.linked_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnlinkDevice(dev.device_id)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--danger)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Unlink
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── PRIVACY ── */}
          {section === 'privacy' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Who can see my info</div>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><Eye size={16} /></div>
                    <div>
                      <div className="settings-row-label">Last Seen</div>
                      <div className="settings-row-sub">Who can see when you were last online</div>
                    </div>
                  </div>
                  <select value={privacyLastSeen}
                    onChange={e => { setPrivacyLastSeen(e.target.value); saveField('privacy_last_seen', e.target.value) }}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 13 }}>
                    <option value="everyone">Everyone</option>
                    <option value="contacts">Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><Camera size={16} /></div>
                    <div>
                      <div className="settings-row-label">Profile Photo</div>
                      <div className="settings-row-sub">Who can see your profile picture</div>
                    </div>
                  </div>
                  <select value={privacyPhoto}
                    onChange={e => { setPrivacyPhoto(e.target.value); saveField('privacy_profile_photo', e.target.value) }}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 13 }}>
                    <option value="everyone">Everyone</option>
                    <option value="contacts">Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
              </div>

              {/* Recording Permissions */}
              <div className="settings-section">
                <div className="settings-section-title">Recording Permissions</div>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><Mic size={16} /></div>
                    <div>
                      <div className="settings-row-label">Allow Voice Recording</div>
                      <div className="settings-row-sub">Others can record voice calls with you</div>
                    </div>
                  </div>
                  <Toggle on={allowVoiceRec} onToggle={() => {
                    const val = !allowVoiceRec
                    setAllowVoiceRec(val)
                    saveField('allow_voice_recording', val)
                  }} />
                </div>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><VideoIcon size={16} /></div>
                    <div>
                      <div className="settings-row-label">Allow Video Recording</div>
                      <div className="settings-row-sub">Others can record video calls with you</div>
                    </div>
                  </div>
                  <Toggle on={allowVideoRec} onToggle={() => {
                    const val = !allowVideoRec
                    setAllowVideoRec(val)
                    saveField('allow_video_recording', val)
                  }} />
                </div>
              </div>

              {/* App Lock */}
              <div className="settings-section">
                <div className="settings-section-title">App Lock</div>
                <div className="settings-row" style={{ cursor: 'default' }}>
                  <div className="settings-row-left">
                    <div className="settings-row-icon"><Lock size={16} /></div>
                    <div>
                      <div className="settings-row-label">PIN Lock</div>
                      <div className="settings-row-sub">{isAppLockEnabled() ? '🔒 App lock is enabled' : 'App lock is disabled'}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>

              <div className="settings-section">
                <SettingRow icon={<UserX size={16} />} label="Blocked Users" sub="Manage blocked contacts" right={<ChevronRight size={16} color="var(--text-muted)" />} />
              </div>
            </>
          )}

          {/* ── CHATS & THEMES ── */}
          {section === 'chats' && (
            <div className="settings-section">
              <div className="settings-section-title">App Theme</div>
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Select your preferred color theme
                </div>
                <div className="theme-picker-grid">
                  {[
                    { id: 'default', name: 'Dark Indigo', base: '#0D0E1A', accent: '#7C5CFC' },
                    { id: 'emerald', name: 'WhatsApp Dark', base: '#0B141A', accent: '#00A884' },
                    { id: 'cyberpunk', name: 'Cyber Neon', base: '#07070E', accent: '#00E5FF' },
                    { id: 'amoled', name: 'Midnight OLED', base: '#000000', accent: '#2979FF' },
                    { id: 'nord', name: 'Nordic Frost', base: '#2E3440', accent: '#88C0D0' },
                    { id: 'light', name: 'Clean Light', base: '#F0F2F5', accent: '#0066FF' },
                  ].map(t => (
                    <div
                      key={t.id}
                      className={`theme-card ${currentTheme === t.id ? 'active' : ''}`}
                      onClick={() => applyTheme(t.id)}
                    >
                      <div className="theme-preview-dots">
                        <div className="theme-dot" style={{ background: t.base }} />
                        <div className="theme-dot" style={{ background: t.accent }} />
                      </div>
                      <span className="theme-card-name">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {section === 'notifications' && (
            <div className="settings-section">
              <div className="settings-section-title">Notifications</div>
              <div className="settings-row" onClick={() => { const val = !notifs; setNotifs(val); saveField('notifications_enabled', val) }}>
                <div className="settings-row-left">
                  <div className="settings-row-icon"><Bell size={16} /></div>
                  <div>
                    <div className="settings-row-label">Push Notifications</div>
                    <div className="settings-row-sub">Receive message alerts</div>
                  </div>
                </div>
                <Toggle on={notifs} onToggle={() => { const val = !notifs; setNotifs(val); saveField('notifications_enabled', val) }} />
              </div>
            </div>
          )}

          {/* ── VIDEO & VOICE ── */}
          {section === 'voice' && (
            <div className="settings-section">
              <div className="settings-section-title">Camera & Microphone</div>
              <div className="settings-row" style={{ cursor: 'default' }}>
                <div className="settings-row-left">
                  <div className="settings-row-icon"><Mic size={16} /></div>
                  <div>
                    <div className="settings-row-label">Microphone</div>
                    <div className="settings-row-sub">Used for voice and video calls</div>
                  </div>
                </div>
              </div>
              <div className="settings-row" style={{ cursor: 'default' }}>
                <div className="settings-row-left">
                  <div className="settings-row-icon"><VideoIcon size={16} /></div>
                  <div>
                    <div className="settings-row-label">Camera</div>
                    <div className="settings-row-sub">Used for video calls</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                Allow microphone and camera access in browser settings for calls to work.
              </div>
            </div>
          )}

          {/* ── KEYBOARD SHORTCUTS ── */}
          {section === 'keyboard' && (
            <div className="settings-section">
              <div className="settings-section-title">Keyboard Shortcuts</div>
              {[
                ['Ctrl + N', 'New chat'],
                ['Ctrl + F', 'Search'],
                ['Ctrl + ,', 'Settings'],
                ['Esc', 'Close panel'],
                ['Enter', 'Send message'],
                ['Shift + Enter', 'New line'],
              ].map(([key, action]) => (
                <div key={key} className="settings-row" style={{ cursor: 'default' }}>
                  <div className="settings-row-left">
                    <div>
                      <div className="settings-row-label">{action}</div>
                    </div>
                  </div>
                  <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{key}</kbd>
                </div>
              ))}
            </div>
          )}

          {/* ── HELP ── */}
          {section === 'help' && (
            <div className="settings-section">
              <div className="settings-section-title">Help & Support</div>
              <SettingRow icon={<HelpCircle size={16} />} label="FAQ" sub="Frequently asked questions" right={<ChevronRight size={16} color="var(--text-muted)" />} />
              <SettingRow icon={<MessageSquare size={16} />} label="Contact Us" sub="Send feedback or report issues" right={<ChevronRight size={16} color="var(--text-muted)" />} />
              <SettingRow icon={<Shield size={16} />} label="Privacy Policy" right={<ChevronRight size={16} color="var(--text-muted)" />} />
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                WaveChat v2.0.0<br />Built with ❤️ using React + Supabase
              </div>
            </div>
          )}

          {/* ── GENERAL ── */}
          {section === 'general' && (
            <div className="settings-section">
              <div className="settings-section-title">General</div>
              <div className="settings-row" style={{ cursor: 'default' }}>
                <div className="settings-row-left">
                  <div className="settings-row-icon"><Monitor size={16} /></div>
                  <div>
                    <div className="settings-row-label">Theme</div>
                    <div className="settings-row-sub">Dark mode (default)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CHATS ── */}
          {section === 'chats' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Google Drive Chat Backup</div>
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                    Back up your encrypted chat history to your personal Google Drive hidden AppData folder.
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Google OAuth Client ID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                      value={gdriveClientId}
                      onChange={e => setGdriveClientId(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      onClick={handleGoogleDriveConnect}
                      className="secondary-btn"
                      style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Cloud size={14} color="var(--accent)" />
                      {gdriveToken ? 'Re-connect Google Drive' : 'Connect Google Drive'}
                    </button>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      12-Word Passphrase (for encrypting/decrypting Drive backup)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter 12-word passphrase"
                      value={passphrasePrompt}
                      onChange={e => setPassphrasePrompt(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleBackupToDrive}
                      disabled={gdriveLoading || !gdriveToken}
                      className="primary-btn"
                      style={{ fontSize: 12, padding: '8px 14px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Upload size={14} />
                      Back Up Now
                    </button>

                    <button
                      onClick={handleRestoreFromDrive}
                      disabled={gdriveLoading || !gdriveToken}
                      className="secondary-btn"
                      style={{ fontSize: 12, padding: '8px 14px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Download size={14} />
                      Restore Backup
                    </button>
                  </div>

                  {gdriveStatus && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)', background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 8 }}>
                      {gdriveStatus}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {/* Remaining content omitted for brevity */}
        </div>
      </div>
    )
  }

  // ── Main Settings List ─────────────────────────────────────────
  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="settings-header-title">Settings</div>
      </div>

      <div className="settings-body">
        {/* Profile Card */}
        <div className="settings-profile-card" onClick={() => setSection('account')} style={{ cursor: 'pointer' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={14} />
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '2px solid var(--bg-surface)'
            }} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
              <Camera size={12} color="white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{profile?.display_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{profile?.status_text || 'Add status...'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </div>

        {/* Category list */}
        <div className="settings-section">
          {categories.map(cat => (
            <div key={cat.id} className="settings-row" onClick={() => setSection(cat.id)} style={{ cursor: 'pointer' }}>
              <div className="settings-row-left">
                <div className="settings-row-icon" style={{ color: 'var(--accent)' }}>{cat.icon}</div>
                <div>
                  <div className="settings-row-label">{cat.label}</div>
                  {cat.sub && <div className="settings-row-sub">{cat.sub}</div>}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          ))}
        </div>

        {/* Log out */}
        <div className="settings-section">
          <div className="settings-row" onClick={signOut} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><LogOut size={18} /></div>
              <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Log Out</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 0 20px' }}>
          WaveChat v2.0.0 · Made with ❤️
        </div>
      </div>

      {showPassphraseModal && (
        <PassphraseSetupModal
          userId={user?.id}
          onClose={() => setShowPassphraseModal(false)}
          onComplete={() => setHasKeyBackup(true)}
        />
      )}

      {showQRLinkModal && (
        <QRLinkModal
          user={user}
          onClose={() => setShowQRLinkModal(false)}
        />
      )}
    </div>
  )
}