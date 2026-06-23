import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MoreVertical, Phone, Video, Search, Smile, Paperclip, Mic,
  Send, X, Reply, Trash2, Forward, ArrowLeft, CheckCheck,
  Image as ImageIcon, FileText, Film, Lock, Square, Trash, Star, ChevronUp, ChevronDown,
} from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { useCall } from '../../context/CallContext'
import Avatar from '../ui/Avatar'
import MediaBubble from './MediaBubble'
import Lightbox from './Lightbox'
import { validateFile } from '../../lib/media'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'

function formatMsgTime(dateStr) {
  if (!dateStr) return ''
  return format(new Date(dateStr), 'HH:mm')
}

function DateDivider({ date }) {
  const d = new Date(date)
  let label = format(d, 'MMMM d, yyyy')
  if (isToday(d)) label = 'Today'
  else if (isYesterday(d)) label = 'Yesterday'
  return <div className="date-divider"><span>{label}</span></div>
}

function EncryptionBanner() {
  return (
    <div className="encryption-banner">
      <Lock size={13} />
      Messages and files are end-to-end encrypted. Only people in this chat can read or download them.
    </div>
  )
}

function ReactionBar({ reactions, myId, onReact, messageId }) {
  if (!reactions?.length) return null
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false }
    acc[r.emoji].count++
    if (r.user_id === myId) acc[r.emoji].mine = true
    return acc
  }, {})
  return (
    <div className="reactions-bar">
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <div key={emoji} className={`reaction-pill ${mine ? 'mine' : ''}`} onClick={() => onReact(messageId, emoji)}>
          {emoji} <span className="reaction-count">{count}</span>
        </div>
      ))}
    </div>
  )
}

function MessageBubble({ msg, isOut, onReply, onDelete, onReact, onToggleStar, myId, conversationId, onOpenLightbox, highlight }) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiQuick, setShowEmojiQuick] = useState(false)
  const isDeleted = !!msg.deleted_at
  const isMedia = ['image', 'video', 'document', 'voice'].includes(msg.message_type)
  const isStarred = (msg.starred_by || []).includes(myId)

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏']

  return (
    <div
      id={`msg-${msg.id}`}
      className={`message-row ${isOut ? 'outgoing' : 'incoming'} ${highlight ? 'highlighted' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiQuick(false) }}
    >
      {!isOut && (
        <Avatar src={msg.profiles?.avatar_url} name={msg.profiles?.display_name} size={10} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start', flex: 1 }}>
        {!isDeleted && (
          <div className="message-actions" style={{ opacity: showActions ? 1 : 0 }}>
            <div style={{ position: 'relative' }}>
              <button className="action-btn" onClick={() => setShowEmojiQuick(p => !p)} title="React">
                <Smile size={13} />
              </button>
              {showEmojiQuick && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                  padding: '6px 8px', display: 'flex', gap: '4px', whiteSpace: 'nowrap', zIndex: 10,
                  boxShadow: 'var(--shadow-md)'
                }}>
                  {quickEmojis.map(e => (
                    <button key={e} style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}
                      onClick={() => { onReact(msg.id, e); setShowEmojiQuick(false) }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="action-btn" onClick={() => onReply(msg)} title="Reply"><Reply size={13} /></button>
            <button className="action-btn" onClick={() => onToggleStar(msg)} title={isStarred ? 'Unstar' : 'Star'}>
              <Star size={13} fill={isStarred ? 'var(--warning)' : 'none'} color={isStarred ? 'var(--warning)' : undefined} />
            </button>
            <button className="action-btn" title="Forward"><Forward size={13} /></button>
            {isOut && (
              <button className="action-btn" style={{ color: 'var(--danger)' }} onClick={() => onDelete(msg.id)} title="Delete">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        <div
          className={`bubble ${isDeleted ? 'deleted' : ''} ${isMedia && !isDeleted ? 'bubble-media' : ''}`}
          style={{ position: 'relative' }}
        >
          {msg.reply_to && !isDeleted && (
            <div className="reply-preview">
              <div className="reply-preview-name">{msg.reply_to.profiles?.display_name}</div>
              <div className="reply-preview-text">{msg.reply_to.content}</div>
            </div>
          )}

          {isDeleted ? (
            <div className="bubble-text">🚫 This message was deleted</div>
          ) : isMedia ? (
            <>
              <MediaBubble msg={msg} conversationId={conversationId} onOpenLightbox={onOpenLightbox} />
              {msg.message_type === 'document' && null}
            </>
          ) : (
            <div className="bubble-text">{msg.content}</div>
          )}

          {!isDeleted && (
            <div className="bubble-meta">
              <span className="bubble-time">{formatMsgTime(msg.created_at)}</span>
              {isOut && <CheckCheck size={12} style={{ opacity: 0.7 }} />}
            </div>
          )}
        </div>

        {!isDeleted && msg.message_reactions?.length > 0 && (
          <ReactionBar reactions={msg.message_reactions} myId={myId} onReact={onReact} messageId={msg.id} />
        )}
      </div>

      {isOut && <div style={{ width: 40 }} />}
    </div>
  )
}

export default function ChatWindow({ onBack, onOpenContactInfo }) {
  const { user, profile } = useAuth()
  const {
    activeConversation, messages, typingUsers, sendMessage, sendMediaMessage,
    deleteMessage, reactToMessage, toggleStarMessage, sendTypingIndicator, onlineUsers, uploadProgress,
  } = useChat()
  const { startCall } = useCall()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [fileError, setFileError] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)

  // voice recording state
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStreamRef = useRef(null)

  const messagesEndRef = useRef()
  const textareaRef = useRef()
  const typingTimeoutRef = useRef()
  const imageInputRef = useRef()
  const videoInputRef = useRef()
  const docInputRef = useRef()

  const conv = activeConversation
  const otherUser = conv?.other_user
  const isOnline = onlineUsers.has(otherUser?.id)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    return () => { if (recordStreamRef.current) recordStreamRef.current.getTracks().forEach(t => t.stop()) }
  }, [])

  function handleTyping(e) {
    setText(e.target.value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    sendTypingIndicator(conv.id, profile?.display_name)
  }

  async function handleSend() {
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    setReplyTo(null)
    setShowEmoji(false)
    const { error } = await sendMessage({ conversationId: conv.id, content, type: 'text', replyToId: replyTo?.id })
    if (error) setFileError(error.message)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleEmojiSelect(emojiData) {
    setText(prev => prev + emojiData.emoji)
    textareaRef.current?.focus()
  }

  async function uploadFile(file) {
    const { valid, error } = validateFile(file)
    if (!valid) { setFileError(error); setTimeout(() => setFileError(''), 4000); return }
    setShowAttachMenu(false)
    const { error: sendErr } = await sendMediaMessage({ conversationId: conv.id, file, replyToId: replyTo?.id })
    setReplyTo(null)
    if (sendErr) { setFileError(sendErr.message); setTimeout(() => setFileError(''), 4000) }
  }

  function handleFileInputChange(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (file) uploadFile(file)
  }

  // ---- drag & drop ----
  function handleDragOver(e) { e.preventDefault(); setDragOver(true) }
  function handleDragLeave(e) { e.preventDefault(); setDragOver(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    files.forEach(uploadFile)
  }

  // ---- voice recording ----
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = handleRecordingStop
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      setFileError('Microphone access denied')
      setTimeout(() => setFileError(''), 3000)
    }
  }

  function stopRecording(send) {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current._send = send
    mediaRecorderRef.current.stop()
    clearInterval(recordTimerRef.current)
    setRecording(false)
    recordStreamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function handleRecordingStop() {
    const shouldSend = mediaRecorderRef.current?._send
    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
    if (shouldSend && blob.size > 0) {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
      await sendMediaMessage({ conversationId: conv.id, file })
    }
  }

  function formatRecordTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  // Group messages by date
  const grouped = []
  let lastDate = null
  messages.forEach(msg => {
    const d = new Date(msg.created_at)
    if (!lastDate || !isSameDay(d, lastDate)) {
      grouped.push({ type: 'date', date: msg.created_at })
      lastDate = d
    }
    grouped.push({ type: 'message', msg })
  })

  const typingNames = Object.values(typingUsers)
  const convName = conv?.is_group ? conv?.name : otherUser?.display_name || 'Unknown'
  const convAvatar = conv?.is_group ? conv?.group_avatar_url : otherUser?.avatar_url

  // ---- in-chat search ----
  const searchMatches = searchTerm.trim()
    ? messages.filter(m => !m.deleted_at && m.content?.toLowerCase().includes(searchTerm.toLowerCase()))
    : []

  useEffect(() => { setSearchMatchIdx(0) }, [searchTerm])

  useEffect(() => {
    if (!showSearch || searchMatches.length === 0) return
    const target = searchMatches[searchMatchIdx]
    if (target) {
      document.getElementById(`msg-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [searchMatchIdx, showSearch, searchMatches.length])

  function goToNextMatch() {
    if (searchMatches.length === 0) return
    setSearchMatchIdx(i => (i + 1) % searchMatches.length)
  }
  function goToPrevMatch() {
    if (searchMatches.length === 0) return
    setSearchMatchIdx(i => (i - 1 + searchMatches.length) % searchMatches.length)
  }

  if (!conv) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="empty-state-title">Select a conversation</div>
          <div className="empty-state-sub">Choose from your existing chats or start a new one</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`chat-window ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="drag-overlay">
          <Paperclip size={32} />
          <span>Drop file to send</span>
        </div>
      )}

      <div className="chat-header">
        <button className="icon-btn" onClick={onBack} style={{ display: 'none' }} id="back-btn">
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpenContactInfo?.(conv)}>
          <Avatar src={convAvatar} name={convName} size={12} showOnline={!conv.is_group} isOnline={isOnline} />
          <div className="chat-header-info">
            <div className="chat-header-name">{convName}</div>
            <div className={`chat-header-status ${isOnline ? 'online' : ''}`}>
              {typingNames.length > 0
                ? `${typingNames[0]} is typing...`
                : conv.is_group
                ? `${conv.members_count || ''} members`
                : isOnline ? 'Online' : otherUser?.last_seen
                ? `Last seen ${format(new Date(otherUser.last_seen), 'dd MMM, HH:mm')}`
                : 'Offline'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {!conv.is_group && (
            <>
              <button className="icon-btn" title="Voice call" onClick={() => startCall(otherUser, conv.id, 'voice')}><Phone size={18} /></button>
              <button className="icon-btn" title="Video call" onClick={() => startCall(otherUser, conv.id, 'video')}><Video size={18} /></button>
            </>
          )}
          <button className="icon-btn" title="Search in chat" onClick={() => setShowSearch(p => !p)} style={{ color: showSearch ? 'var(--accent)' : undefined }}><Search size={18} /></button>
          <button className="icon-btn" onClick={() => onOpenContactInfo?.(conv)}><MoreVertical size={18} /></button>
        </div>
      </div>

      {showSearch && (
        <div className="chat-search-bar">
          <Search size={15} color="var(--text-muted)" />
          <input
            autoFocus
            placeholder="Search in this chat..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') goToNextMatch() }}
          />
          {searchTerm && (
            <span className="chat-search-count">
              {searchMatches.length ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0/0'}
            </span>
          )}
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={goToPrevMatch}><ChevronUp size={14} /></button>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={goToNextMatch}><ChevronDown size={14} /></button>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => { setShowSearch(false); setSearchTerm('') }}><X size={14} /></button>
        </div>
      )}

      <div className="messages-area">
        <EncryptionBanner />
        {grouped.map((item, i) => {
          if (item.type === 'date') return <DateDivider key={`date-${i}`} date={item.date} />
          const msg = item.msg
          const isOut = msg.sender_id === user.id
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOut={isOut}
              myId={user.id}
              conversationId={conv.id}
              onReply={setReplyTo}
              onDelete={deleteMessage}
              onReact={reactToMessage}
              onToggleStar={toggleStarMessage}
              onOpenLightbox={setLightboxSrc}
              highlight={searchMatches[searchMatchIdx]?.id === msg.id}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {typingNames.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
          <span>{typingNames[0]} is typing</span>
        </div>
      )}

      {uploadProgress && (
        <div className="upload-progress-bar">
          <div className="spinner" style={{ width: 14, height: 14 }} />
          <span className="truncate">Sending {uploadProgress.fileName}…</span>
        </div>
      )}

      {fileError && (
        <div className="upload-progress-bar" style={{ color: 'var(--danger)' }}>
          {fileError}
        </div>
      )}

      <div className="message-input-area" style={{ position: 'relative' }}>
        {replyTo && (
          <div className="reply-bar">
            <div className="reply-bar-content">
              <div className="reply-bar-name">{replyTo.profiles?.display_name || 'Message'}</div>
              <div className="reply-bar-text">{replyTo.content}</div>
            </div>
            <button className="icon-btn" onClick={() => setReplyTo(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {showEmoji && (
          <div className="emoji-picker-wrap">
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              theme="dark"
              height={350}
              width={300}
              searchPlaceholder="Search emoji..."
            />
          </div>
        )}

        {showAttachMenu && (
          <div className="attach-menu">
            <div className="attach-menu-item" onClick={() => { imageInputRef.current?.click() }}>
              <div className="attach-menu-icon" style={{ background: '#A855F7' }}><ImageIcon size={16} color="white" /></div>
              Photo
            </div>
            <div className="attach-menu-item" onClick={() => { videoInputRef.current?.click() }}>
              <div className="attach-menu-icon" style={{ background: '#FF5470' }}><Film size={16} color="white" /></div>
              Video
            </div>
            <div className="attach-menu-item" onClick={() => { docInputRef.current?.click() }}>
              <div className="attach-menu-icon" style={{ background: '#5B9BFF' }}><FileText size={16} color="white" /></div>
              Document
            </div>
          </div>
        )}

        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileInputChange} />
        <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={handleFileInputChange} />

        {recording ? (
          <div className="recording-row">
            <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => stopRecording(false)} title="Cancel">
              <Trash size={18} />
            </button>
            <div className="recording-indicator">
              <span className="recording-dot" />
              {formatRecordTime(recordSeconds)}
            </div>
            <div style={{ flex: 1 }} />
            <button className="send-btn" onClick={() => stopRecording(true)} title="Send voice note">
              <Send size={18} />
            </button>
          </div>
        ) : (
          <div className="input-row">
            <div className="input-actions-left">
              <button className="icon-btn" onClick={() => { setShowEmoji(p => !p); setShowAttachMenu(false) }}>
                <Smile size={20} style={{ color: showEmoji ? 'var(--accent)' : 'var(--text-muted)' }} />
              </button>
              <button className="icon-btn" onClick={() => { setShowAttachMenu(p => !p); setShowEmoji(false) }}>
                <Paperclip size={20} style={{ color: showAttachMenu ? 'var(--accent)' : 'var(--text-muted)' }} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="input-box"
              placeholder="Type a message..."
              value={text}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ lineHeight: '22px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />

            {text.trim() ? (
              <button className="send-btn" onClick={handleSend}>
                <Send size={18} />
              </button>
            ) : (
              <button className="send-btn" style={{ background: 'var(--bg-elevated)', boxShadow: 'none' }} onClick={startRecording} title="Record voice note">
                <Mic size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        )}
      </div>

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  )
}