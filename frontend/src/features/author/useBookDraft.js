import { useCallback, useEffect, useRef, useState } from 'react'

const DRAFT_STORAGE_PREFIX = 'author-book-draft'
const AUTOSAVE_DELAY_MS = 400

export const draftStorageKey = (authorId) => `${DRAFT_STORAGE_PREFIX}-${authorId || 'unknown'}`

const draftPayload = (values) => ({
  title: values.title,
  genres: values.genres,
  otherGenreText: values.otherGenreText,
  description: values.description,
})

const isDraftEmpty = (draft) => (
  !(draft.title || '').trim()
  && !(draft.description || '').trim()
  && !(draft.otherGenreText || '').trim()
  && (Array.isArray(draft.genres) ? draft.genres.length : 0) === 0
)

/**
 * Debounced localStorage draft for the publishing form. Files are deliberately
 * not persisted, so a restored draft asks the author to re-attach them.
 */
export const useBookDraft = ({ authorId, values, active, onRestore }) => {
  const [savedAt, setSavedAt] = useState('')
  const [notice, setNotice] = useState('')
  const restoreRef = useRef(onRestore)
  restoreRef.current = onRestore

  useEffect(() => {
    if (!authorId) return
    try {
      const raw = localStorage.getItem(draftStorageKey(authorId))
      if (!raw) return
      const parsed = JSON.parse(raw)
      restoreRef.current({
        title: parsed.title || '',
        genres: Array.isArray(parsed.genres) ? parsed.genres : [],
        otherGenreText: parsed.otherGenreText || '',
        description: parsed.description || '',
      })
      setSavedAt(parsed.savedAt || '')
      setNotice('Draft restored. Re-upload files before submitting.')
    } catch {
      // Ignore malformed draft data.
    }
  }, [authorId])

  useEffect(() => {
    if (!authorId || !active) return undefined

    const timer = setTimeout(() => {
      const key = draftStorageKey(authorId)
      const draft = draftPayload(values)
      try {
        if (isDraftEmpty(draft)) {
          localStorage.removeItem(key)
          setSavedAt('')
          return
        }
        const stamp = new Date().toISOString()
        localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: stamp }))
        setSavedAt(stamp)
      } catch {
        // Ignore storage failures.
      }
    }, AUTOSAVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [authorId, active, values])

  const clear = useCallback((message = '') => {
    if (authorId) localStorage.removeItem(draftStorageKey(authorId))
    setSavedAt('')
    setNotice(message)
  }, [authorId])

  return { savedAt, notice, clear }
}

export default useBookDraft
