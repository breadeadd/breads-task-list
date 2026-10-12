import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

const AUTOSAVE_DELAY_MS = 800

// A single free-form scratch pad per user, stored as one row in the
// `notes` table so it follows the account across devices
const NotesPad = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Last content written to Supabase — skips redundant saves
  const lastSavedRef = useRef('')
  // Mirrors `content` so event listeners always see the latest text
  const contentRef = useRef('')

  const saveNotes = useCallback(async () => {
    const text = contentRef.current
    if (text === lastSavedRef.current) return
    lastSavedRef.current = text
    const { error } = await supabase
      .from('notes')
      .upsert({ user_id: user.id, content: text, updated_at: new Date().toISOString() })
    if (error) console.error(error)
  }, [user.id])

  const handleClose = useCallback(() => {
    // Only save once loaded so an empty pad can never overwrite saved notes
    if (loaded) saveNotes()
    setIsOpen(false)
    setLoaded(false)
  }, [loaded, saveNotes])

  // Re-fetch on every open so edits made on another device show up
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function loadNotes() {
      const { data, error } = await supabase
        .from('notes')
        .select('content')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (error) { console.error(error); return }
      const text = data?.content ?? ''
      lastSavedRef.current = text
      contentRef.current = text
      setContent(text)
      setLoaded(true)
    }

    loadNotes()
    return () => { cancelled = true }
  }, [isOpen, user.id])

  // Debounced autosave while typing
  useEffect(() => {
    if (!isOpen || !loaded) return
    const timeoutId = setTimeout(saveNotes, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timeoutId)
  }, [content, isOpen, loaded, saveNotes])

  // Escape closes; leaving the tab (close, app switch on mobile) saves
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => { if (e.key === 'Escape') handleClose() }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && loaded) saveNotes()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isOpen, loaded, saveNotes, handleClose])

  function handleChange(e) {
    contentRef.current = e.target.value
    setContent(e.target.value)
  }

  return (
    <>
      <button className="notes-fab" onClick={() => setIsOpen(true)} aria-label="Open notes">
        <i className="fa-solid fa-pencil"></i>
      </button>

      {isOpen && (
        <div className="notes-overlay" onClick={handleClose}>
          <div className="notes-pad" onClick={e => e.stopPropagation()}>
            <button className="notes-close" onClick={handleClose} aria-label="Close notes">
              <i className="fa-solid fa-xmark"></i>
            </button>
            {loaded ? (
              <textarea
                className="notes-textarea"
                value={content}
                onChange={handleChange}
                placeholder="Write something down..."
                autoFocus
              />
            ) : (
              <p className="notes-loading">Loading…</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default NotesPad
