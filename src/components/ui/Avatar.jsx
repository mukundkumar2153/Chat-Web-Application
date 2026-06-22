export default function Avatar({ src, name, size = 10, showOnline = false, isOnline = false, style = {} }) {
  const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  
  // Generate consistent color from name
  const colors = [
    '#7C5CFC', '#FF5470', '#22D48F', '#FFAB2E',
    '#5B9BFF', '#FF7A5C', '#A855F7', '#14B8A6'
  ]
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0
  const bgColor = src ? undefined : colors[colorIndex]

  return (
    <div className="avatar" style={style}>
      <div
        className={`avatar-img size-${size}`}
        style={bgColor ? { background: bgColor } : {}}
      >
        {src ? (
          <img src={src} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {showOnline && isOnline && <div className="online-dot" />}
    </div>
  )
}
