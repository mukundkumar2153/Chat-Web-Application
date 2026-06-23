import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft, Camera, Bell, Lock, Shield, Monitor, KeyRound as KeyIcon,
  LogOut, Trash2, ChevronRight, Eye, ShieldCheck, AlertTriangle, KeyRound,
  Mic, Video, HelpCircle, Keyboard, MessageSquareText, Ban,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fingerprint } from '../../lib/crypto'
import { isAppLockEnabled } from '../../lib/appLock'
import AppLockSetupModal from './AppLockSetupModal'
import Avatar from '../ui/Avatar'

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle}>
      <div className="toggle-thumb" />
    </div>
  )
}

function CategoryRow({ icon, label, sub, onClick }) {
  return (
    <div className="settings-row" onClick={onClick}>
      <div className="settings-row-left">
        <div className="settings-row-icon">{icon}</div>
        <div>
          <div className="settings-row-label">{label}</div>
          <div className="settings-row-sub">{sub}</div>
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  )
}

function SubHeader({ title, onBack }) {
  return (
    <div className="settings-header">
      <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      <div className="settings-header-title">{title}</div>
    </div>
  )
}

// ---------------------------------------------------------------

function AccountSection({ onBack }) {
  const { user, profile, updateProfile, encryptionStatus, resetEncryptionKeys } = useAuth()
  const [editName, setEditName] = useState(false)
  const [editStatus, setEditStatus] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [statusText, setStatusText] = useState(profile?.status_text || '')
  const [resetting, setResetting] = useState(false)
  const fileRef = useRef()

  async function saveField(field, value) { await updateProfile({ [field]: value }) }

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

  return (
    <>
      <SubHeader title="Account" onBack={onBack} />
      <div className="settings-body">
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={16} />
            <div
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-surface)' }}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={13} color="white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ padding: '6px 10px', fontSize: '15px', fontWeight: 700 }} autoFocus />
                <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }} onClick={() => { saveField('display_name', displayName); setEditName(false) }}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-display)', cursor: 'pointer', marginBottom: '4px' }} onClick={() => setEditName(true)}>{profile?.display_name}</div>
            )}
            {editStatus ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input className="form-input" value={statusText} onChange={e => setStatusText(e.target.value)} style={{ padding: '5px 10px', fontSize: '13px' }} autoFocus />
                <button className="btn-primary" style={{ width: 'auto', padding: '5px 12px', fontSize: '12px' }} onClick={() => { saveField('status_text', statusText); setEditStatus(false) }}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditStatus(true)}>{profile?.status_text || 'Add status...'}</div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{user?.email}</div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Encryption</div>
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: encryptionStatus === 'ready' ? 'var(--online)' : 'var(--warning)' }}>
                {encryptionStatus === 'ready' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div>
                <div className="settings-row-label">{encryptionStatus === 'ready' ? 'End-to-end encryption active' : 'Encryption key missing on this device'}</div>
                <div className="settings-row-sub">{encryptionStatus === 'ready' ? 'Messages and files are encrypted before they leave this device.' : 'Reset below to start fresh on this device.'}</div>
              </div>
            </div>
          </div>
          {encryptionStatus === 'ready' && profile?.public_key && (
            <div className="settings-row" style={{ cursor: 'default' }}>
              <div className="settings-row-left">
                <div className="settings-row-icon"><KeyRound size={16} /></div>
                <div>
                  <div className="settings-row-label">Your security code</div>
                  <div className="settings-row-sub" style={{ fontFamily: 'monospace' }}>{fingerprint(profile.public_key)}</div>
                </div>
              </div>
            </div>
          )}
          {encryptionStatus === 'missing-local-key' && (
            <div className="settings-row" onClick={async () => { if (resetting) return; setResetting(true); await resetEncryptionKeys(); setResetting(false) }}>
              <div className="settings-row-left">
                <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><KeyRound size={16} /></div>
                <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Reset encryption keys</div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-row danger">
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></div>
              <div>
                <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Delete Account</div>
                <div className="settings-row-sub">Permanently delete your account and data</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function PrivacySection({ onBack }) {
  const { profile, updateProfile, user } = useAuth()
  const [privacyLastSeen, setPrivacyLastSeen] = useState(profile?.privacy_last_seen || 'everyone')
  const [privacyPhoto, setPrivacyPhoto] = useState(profile?.privacy_profile_photo || 'everyone')
  const [blocked, setBlocked] = useState([])
  const [showBlocked, setShowBlocked] = useState(false)
  const [showAppLock, setShowAppLock] = useState(false)

  async function saveField(field, value) { await updateProfile({ [field]: value }) }

  async function loadBlocked() {
    const { data } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, profiles:blocked_id (display_name, avatar_url)')
      .eq('blocker_id', user.id)
    setBlocked(data || [])
  }

  async function handleUnblock(rowId) {
    await supabase.from('blocked_users').delete().eq('id', rowId)
    loadBlocked()
  }

  if (showBlocked) {
    return (
      <>
        <SubHeader title="Blocked contacts" onBack={() => setShowBlocked(false)} />
        <div className="settings-body">
          <div className="settings-section">
            {blocked.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No blocked contacts</div>
            ) : blocked.map(b => (
              <div key={b.id} className="settings-row">
                <div className="settings-row-left">
                  <Avatar src={b.profiles?.avatar_url} name={b.profiles?.display_name} size={10} />
                  <div className="settings-row-label">{b.profiles?.display_name}</div>
                </div>
                <button className="btn-ghost" style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 12 }} onClick={() => handleUnblock(b.id)}>Unblock</button>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SubHeader title="Privacy" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon"><Eye size={16} /></div>
              <div><div className="settings-row-label">Last Seen</div><div className="settings-row-sub">Who can see when you were last online</div></div>
            </div>
            <select value={privacyLastSeen} onChange={e => { setPrivacyLastSeen(e.target.value); saveField('privacy_last_seen', e.target.value) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}>
              <option value="everyone">Everyone</option><option value="contacts">Contacts</option><option value="nobody">Nobody</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon"><Camera size={16} /></div>
              <div><div className="settings-row-label">Profile Photo</div><div className="settings-row-sub">Who can see your profile picture</div></div>
            </div>
            <select value={privacyPhoto} onChange={e => { setPrivacyPhoto(e.target.value); saveField('privacy_profile_photo', e.target.value) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}>
              <option value="everyone">Everyone</option><option value="contacts">Contacts</option><option value="nobody">Nobody</option>
            </select>
          </div>
          <div className="settings-row" onClick={() => { loadBlocked(); setShowBlocked(true) }}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Ban size={16} /></div>
              <div><div className="settings-row-label">Blocked Contacts</div><div className="settings-row-sub">Manage blocked users</div></div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
          <div className="settings-row" onClick={() => setShowAppLock(true)}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Lock size={16} /></div>
              <div><div className="settings-row-label">App Lock</div><div className="settings-row-sub">{isAppLockEnabled() ? 'On' : 'Off'} · Require a PIN to open WaveChat</div></div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>
      {showAppLock && <AppLockSetupModal onClose={() => setShowAppLock(false)} />}
    </>
  )
}

function NotificationsSection({ onBack }) {
  const { profile, updateProfile } = useAuth()
  const [notifs, setNotifs] = useState(profile?.notifications_enabled ?? true)
  async function toggle() {
    const val = !notifs
    setNotifs(val)
    await updateProfile({ notifications_enabled: val })
  }
  return (
    <>
      <SubHeader title="Notifications" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row" onClick={toggle}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Bell size={16} /></div>
              <div><div className="settings-row-label">Push Notifications</div><div className="settings-row-sub">Receive message alerts</div></div>
            </div>
            <Toggle on={notifs} onToggle={toggle} />
          </div>
        </div>
      </div>
    </>
  )
}

function ChatsSection({ onBack }) {
  return (
    <>
      <SubHeader title="Chats" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><MessageSquareText size={16} /></div>
              <div><div className="settings-row-label">Theme</div><div className="settings-row-sub">Dark (more themes coming soon)</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function GeneralSection({ onBack }) {
  return (
    <>
      <SubHeader title="General" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Monitor size={16} /></div>
              <div><div className="settings-row-label">Startup</div><div className="settings-row-sub">WaveChat runs in your browser — no desktop launcher to configure (yet)</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function VideoVoiceSection({ onBack }) {
  const [devices, setDevices] = useState({ mics: [], cams: [] })
  const [testing, setTesting] = useState(false)
  const [permError, setPermError] = useState('')

  async function loadDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        mics: list.filter(d => d.kind === 'audioinput'),
        cams: list.filter(d => d.kind === 'videoinput'),
      })
    } catch { /* ignore */ }
  }
  useEffect(() => { loadDevices() }, [])

  async function testDevices() {
    setPermError('')
    setTesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      await loadDevices()
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setPermError('Camera/mic permission denied or unavailable')
    }
    setTesting(false)
  }

  return (
    <>
      <SubHeader title="Video & voice" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row" onClick={testDevices}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Mic size={16} /></div>
              <div><div className="settings-row-label">Microphone</div><div className="settings-row-sub">{devices.mics[0]?.label || 'Tap to detect & grant permission'}</div></div>
            </div>
            {testing && <div className="spinner" style={{ width: 16, height: 16 }} />}
          </div>
          <div className="settings-row" onClick={testDevices}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Video size={16} /></div>
              <div><div className="settings-row-label">Camera</div><div className="settings-row-sub">{devices.cams[0]?.label || 'Tap to detect & grant permission'}</div></div>
            </div>
          </div>
        </div>
        {permError && <div className="error-msg">{permError}</div>}
      </div>
    </>
  )
}

function KeyboardShortcutsSection({ onBack }) {
  const shortcuts = [
    ['Enter', 'Send message'],
    ['Shift + Enter', 'New line in message'],
    ['Esc', 'Close emoji picker / attach menu'],
  ]
  return (
    <>
      <SubHeader title="Keyboard shortcuts" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          {shortcuts.map(([key, desc]) => (
            <div className="settings-row" key={key} style={{ cursor: 'default' }}>
              <div className="settings-row-label">{desc}</div>
              <code style={{ background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{key}</code>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function HelpSection({ onBack }) {
  return (
    <>
      <SubHeader title="Help and feedback" onBack={onBack} />
      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><HelpCircle size={16} /></div>
              <div><div className="settings-row-label">WaveChat v2.0</div><div className="settings-row-sub">A side project, not affiliated with WhatsApp</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------

export default function SettingsPage({ onBack }) {
  const { profile, signOut } = useAuth()
  const [section, setSection] = useState(null)

  if (section === 'general') return <GeneralSection onBack={() => setSection(null)} />
  if (section === 'account') return <AccountSection onBack={() => setSection(null)} />
  if (section === 'privacy') return <PrivacySection onBack={() => setSection(null)} />
  if (section === 'chats') return <ChatsSection onBack={() => setSection(null)} />
  if (section === 'notifications') return <NotificationsSection onBack={() => setSection(null)} />
  if (section === 'video') return <VideoVoiceSection onBack={() => setSection(null)} />
  if (section === 'shortcuts') return <KeyboardShortcutsSection onBack={() => setSection(null)} />
  if (section === 'help') return <HelpSection onBack={() => setSection(null)} />

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="settings-header-title">Settings</div>
      </div>

      <div className="settings-body">
        <div className="settings-row" style={{ cursor: 'default', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div className="settings-row-left">
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={14} />
            <div className="settings-row-label" style={{ fontSize: 16 }}>{profile?.display_name}</div>
          </div>
        </div>

        <div className="settings-section">
          <CategoryRow icon={<Monitor size={16} />} label="General" sub="Startup and close" onClick={() => setSection('general')} />
          <CategoryRow icon={<KeyIcon size={16} />} label="Account" sub="Security, encryption, account info" onClick={() => setSection('account')} />
          <CategoryRow icon={<Shield size={16} />} label="Privacy" sub="Blocked contacts, app lock" onClick={() => setSection('privacy')} />
          <CategoryRow icon={<MessageSquareText size={16} />} label="Chats" sub="Theme, chat settings" onClick={() => setSection('chats')} />
          <CategoryRow icon={<Video size={16} />} label="Video & voice" sub="Camera, microphone & speakers" onClick={() => setSection('video')} />
          <CategoryRow icon={<Bell size={16} />} label="Notifications" sub="Message notifications" onClick={() => setSection('notifications')} />
          <CategoryRow icon={<Keyboard size={16} />} label="Keyboard shortcuts" sub="Quick actions" onClick={() => setSection('shortcuts')} />
          <CategoryRow icon={<HelpCircle size={16} />} label="Help and feedback" sub="About, contact" onClick={() => setSection('help')} />
        </div>

        <div className="settings-section">
          <div className="settings-row" onClick={signOut}>
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><LogOut size={16} /></div>
              <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Log Out</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '20px' }}>
          WaveChat v2.0 · Made with ❤️
        </div>
      </div>
    </div>
  )
}