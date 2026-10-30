// Reader state (bookmarks/highlights) storage — same localStorage key + shape as
// before, so legacy reader data remains readable:
// `student-reader-{userId}-{recordId}` -> { version: 4, bookmarks, highlights, updatedAt }
export const READER_STATE_VERSION = 4

export const getReaderStorageKey = (userId, recordId) => `student-reader-${userId}-${recordId}`

export const defaultReaderState = () => ({
  bookmarks: [],
  highlights: [],
  updatedAt: '',
})

export const normalizeBookmarks = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const page = Number(item?.page)
      if (!Number.isInteger(page) || page <= 0) return null
      return {
        id: item.id || `bm-${page}-${Math.random().toString(36).slice(2, 6)}`,
        page,
        label: typeof item.label === 'string' ? item.label : '',
        createdAt: item.createdAt || new Date().toISOString(),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.page - b.page)
}

export const normalizeHighlights = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      // Keep compatible with historical data where pageNumber only exists in boundingRect.
      const pageNumber = Number(item?.position?.pageNumber || item?.position?.boundingRect?.pageNumber)
      if (!pageNumber || !item?.content) return null

      const rects = Array.isArray(item.position?.rects)
        ? item.position.rects.map((rect) => ({ ...rect, pageNumber: Number(rect?.pageNumber) || pageNumber }))
        : []

      return {
        id: item.id || `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        content: item.content,
        position: {
          ...item.position,
          pageNumber,
          boundingRect: {
            ...(item.position?.boundingRect || {}),
            pageNumber,
          },
          rects,
        },
        comment: item.comment || { text: '', emoji: '' },
        createdAt: item.createdAt || new Date().toISOString(),
      }
    })
    .filter(Boolean)
}

/** Version 3 and below discarded on load; v3+ compatible after normalization. */
export const loadReaderState = (userId, recordId) => {
  try {
    const raw = localStorage.getItem(getReaderStorageKey(userId, recordId))
    if (!raw) return defaultReaderState()
    const parsed = JSON.parse(raw)
    if ((parsed.version || 0) < 3) return defaultReaderState()

    return {
      bookmarks: normalizeBookmarks(parsed.bookmarks),
      highlights: normalizeHighlights(parsed.highlights),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return defaultReaderState()
  }
}

export const saveReaderState = (userId, recordId, payload) => {
  try {
    localStorage.setItem(getReaderStorageKey(userId, recordId), JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

/** Latest (highest page) bookmark for a record, used by ReadingHistory's Bookmark column. */
export const getLastBookmark = (userId, recordId) => {
  const { bookmarks } = loadReaderState(userId, recordId)
  if (bookmarks.length === 0) return null
  return bookmarks.reduce((latest, bm) => (!latest || bm.page > latest.page ? bm : latest), null)
}
