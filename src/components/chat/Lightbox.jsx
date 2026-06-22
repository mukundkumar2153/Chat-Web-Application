import { X, Download } from 'lucide-react'

export default function Lightbox({ src, onClose }) {
  if (!src) return null
  function handleDownload() {
    const a = document.createElement('a')
    a.href = src
    a.download = 'photo.jpg'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-actions">
        <button className="icon-btn" style={{ color: 'white' }} onClick={(e) => { e.stopPropagation(); handleDownload() }}>
          <Download size={20} />
        </button>
        <button className="icon-btn" style={{ color: 'white' }} onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      <img src={src} alt="" onClick={e => e.stopPropagation()} />
    </div>
  )
}