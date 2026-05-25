import { useState, useEffect } from 'react'

const PageTab = ({ page, isActive, shouldAutoEdit, onAutoEditHandled, onSelect, onRename, onDelete, canDelete }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(page.title)

  useEffect(() => {
    if (!shouldAutoEdit) return
    requestAnimationFrame(() => setIsEditing(true))
    onAutoEditHandled?.()
  }, [shouldAutoEdit])

  const handleSave = () => {
    const cleaned = title.trim() || 'My Page'
    setTitle(cleaned)
    onRename(page.id, cleaned)
    setIsEditing(false)
  }

  return (
    <div
      className={`page-tab${isActive ? ' active' : ''}`}
      onClick={() => onSelect(page)}
    >
      {isEditing ? (
        <>
          <input
            className="page-tab-input"
            type="text"
            value={title}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
          />
          <i
            className="fa-regular fa-floppy-disk"
            onClick={(e) => { e.stopPropagation(); handleSave() }}
          />
        </>
      ) : (
        <>
          <span className="page-tab-title">{title}</span>
          <i
            className="fa-solid fa-pencil"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
          />
          {canDelete && (
            <i
              className="fa-solid fa-xmark"
              onClick={(e) => { e.stopPropagation(); onDelete(page.id) }}
            />
          )}
        </>
      )}
    </div>
  )
}

export default PageTab
