import { useState, useEffect, useRef } from 'react'
import { FileText, Download, Play, Pause, Film, AlertCircle } from 'lucide-react'
import { downloadAndDecryptFile, formatFileSize } from '../../lib/media'
import { getConversationKey } from '../../lib/encryption'
import { useAuth } from '../../context/AuthContext'

export default function MediaBubble({ msg, conversationId, onOpenLightbox }) {
  const { user } = useAuth()
  const [objectUrl, setObjectUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }
  }, [])

  async function decrypt() {
    if (objectUrl || loading) return objectUrl
    setLoading(true)
    setError(false)
    try {
      const key = await getConversationKey({ conversationId, myUserId: user.id })
      if (!key) throw new Error('no key')
      const url = await downloadAndDecryptFile({
        storagePath: msg.storage_path,
        fileNonce: msg.file_nonce,
        mimeType: msg.mime_type,
        conversationKeyBytes: key,
      })
      objectUrlRef.current = url
      setObjectUrl(url)
      setLoading(false)
      return url
    } catch {
      setError(true)
      setLoading(false)
      return null
    }
  }

  // Images: auto-decrypt full-res in the background, show thumbnail meanwhile
  useEffect(() => {
    if (msg.message_type === 'image') decrypt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id])

  if (msg.message_type === 'image') {
    const showSrc = objectUrl || msg.thumbnail_data_url
    return (
      <div className="media-bubble media-image" onClick={() => showSrc && onOpenLightbox?.(objectUrl || showSrc)}>
        {showSrc ? (
          <img src={showSrc} alt={msg.content || 'photo'} style={{ filter: objectUrl ? 'none' : 'blur(2px)' }} />
        ) : (
          <div className="media-placeholder"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
        )}
        {error && <div className="media-error"><AlertCircle size={14} /> Failed to load</div>}
      </div>
    )
  }

  if (msg.message_type === 'video') {
    if (objectUrl) {
      return (
        <video src={objectUrl} controls autoPlay className="media-video" />
      )
    }
    return (
      <div className="media-bubble media-video-placeholder" onClick={decrypt}>
        {msg.thumbnail_data_url && <img src={msg.thumbnail_data_url} alt="" style={{ filter: 'blur(1px) brightness(0.7)' }} />}
        <div className="media-play-overlay">
          {loading ? <div className="spinner" style={{ width: 22, height: 22 }} /> : <Film size={26} color="white" />}
        </div>
        {error && <div className="media-error"><AlertCircle size={14} /> Failed to load</div>}
      </div>
    )
  }

  if (msg.message_type === 'voice') {
    async function togglePlay() {
      if (!objectUrl) {
        const url = await decrypt()
        if (!url) return
        setTimeout(() => { audioRef.current?.play(); setPlaying(true) }, 50)
        return
      }
      if (playing) { audioRef.current.pause(); setPlaying(false) }
      else { audioRef.current.play(); setPlaying(true) }
    }
    return (
      <div className="media-bubble media-voice">
        <button className="voice-play-btn" onClick={togglePlay}>
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="voice-waveform">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ height: `${20 + Math.abs(Math.sin(i * 0.7)) * 60}%` }} />
          ))}
        </div>
        {objectUrl && (
          <audio
            ref={audioRef}
            src={objectUrl}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
        )}
        {error && <AlertCircle size={14} color="var(--danger)" />}
      </div>
    )
  }

  // document
  async function handleDocClick() {
    const url = await decrypt()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = msg.content || 'file'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  return (
    <div className="media-bubble media-document" onClick={handleDocClick}>
      <div className="doc-icon"><FileText size={20} /></div>
      <div className="doc-info">
        <div className="doc-name truncate">{msg.content || 'Document'}</div>
        <div className="doc-size">{formatFileSize(msg.file_size)}</div>
      </div>
      <div className="doc-action">
        {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Download size={16} />}
      </div>
      {error && <div className="media-error"><AlertCircle size={14} /> Failed</div>}
    </div>
  )
}