import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import apiClient from '../../../services/api'
import { readingHistoryService } from '../../../services'
import { getDueDate } from '../../../utils/helpers'
import {
  READER_STATE_VERSION,
  loadReaderState,
  normalizeBookmarks,
  normalizeHighlights,
  saveReaderState,
} from '../utils/readerStorage.js'

export const isExpired = (record) => {
  if (!record || (record.status || '').toUpperCase() !== 'BORROWED') return false
  const dueDate = getDueDate(record)
  return dueDate ? Date.now() >= dueDate.getTime() : false
}

const getCurrentPage = () => {
  const pages = document.querySelectorAll('[data-page-number]')
  if (!pages.length) return 1
  let bestPage = 1
  let maxVisible = 0
  pages.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
    if (visible > maxVisible) {
      maxVisible = visible
      bestPage = parseInt(el.getAttribute('data-page-number'), 10)
    }
  })
  return bestPage || 1
}

/**
 * Owns the PDF reader's open/close lifecycle plus bookmark/highlight state and
 * their localStorage persistence — factored out of BorrowedBooksPanel so the
 * record-list component stays focused on the table and bulk actions.
 */
export const useBookReader = ({ userId, onReaderRecordChange, onExpired }) => {
  const [readerRecord, setReaderRecord] = useState(null)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerError, setReaderError] = useState('')
  const [readerUrl, setReaderUrl] = useState('')
  const readerUrlRef = useRef('')
  const scrollViewerToRef = useRef(null)
  const [bookmarkLabel, setBookmarkLabel] = useState('')
  const [bookmarks, setBookmarks] = useState([])
  const [highlightQuery, setHighlightQuery] = useState('')
  const [highlights, setHighlights] = useState([])
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [readerTotalPages, setReaderTotalPages] = useState(0)

  const closeReader = useCallback(() => {
    if (readerUrlRef.current) URL.revokeObjectURL(readerUrlRef.current)
    setReaderRecord(null)
    setReaderUrl('')
    readerUrlRef.current = ''
    setReaderError('')
    setReaderLoading(false)
    setBookmarkLabel('')
    setHighlightQuery('')
    setLastSavedAt('')
    setReaderTotalPages(0)
    scrollViewerToRef.current = null
    onReaderRecordChange?.(null)
  }, [onReaderRecordChange])

  // User-initiated close: saves reading progress to the backend first, then closes.
  const closeReaderWithProgress = useCallback(() => {
    const record = readerRecord
    if (record && readerTotalPages > 0) {
      const currentPage = getCurrentPage()
      const progress = Math.min(100, Math.round((currentPage / readerTotalPages) * 100))
      readingHistoryService.updateReadingProgress(record.id, progress).catch(() => {})
    }
    closeReader()
  }, [readerRecord, readerTotalPages, closeReader])

  useEffect(() => {
    if (!readerRecord) return undefined
    const timer = setInterval(() => {
      if (isExpired(readerRecord)) {
        closeReader()
        onExpired?.()
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [readerRecord, closeReader, onExpired])

  const openReader = async (record) => {
    if ((record.status || '').toUpperCase() !== 'BORROWED') {
      notifications.show({ color: 'red', message: 'Only active borrowings can be opened for reading.' })
      return
    }
    if (isExpired(record)) {
      notifications.show({ color: 'red', message: 'Borrowing has expired and was auto-returned. Please refresh.' })
      onExpired?.()
      return
    }
    const filePath = record.book?.filePath
    if (!filePath) {
      notifications.show({ color: 'red', message: 'This book does not have a readable file attached.' })
      return
    }

    const cached = loadReaderState(userId, record.id)
    setBookmarks(cached.bookmarks)
    setHighlights(cached.highlights)
    setLastSavedAt(cached.updatedAt)
    setBookmarkLabel('')
    setHighlightQuery('')
    setReaderRecord(record)
    onReaderRecordChange?.(record.id)
    setReaderError('')
    setReaderLoading(true)

    try {
      const response = await apiClient.get('/files/stream', { params: { filePath }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      readerUrlRef.current = url
      setReaderUrl(url)
    } catch (err) {
      setReaderError(err?.message || 'Failed to open reader')
    } finally {
      setReaderLoading(false)
    }
  }

  const persistReader = (next) => {
    if (!readerRecord || !userId) return
    const payload = {
      version: READER_STATE_VERSION,
      bookmarks: normalizeBookmarks(next.bookmarks),
      highlights: normalizeHighlights(next.highlights),
      updatedAt: new Date().toISOString(),
    }
    const ok = saveReaderState(userId, readerRecord.id, payload)
    if (ok) { setLastSavedAt(payload.updatedAt); return }
    notifications.show({ color: 'red', message: 'Unable to save reading state. Local storage may be full.' })
  }

  const scrollToPage = useCallback((page) => {
    const pageNumber = Number(page)
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) return false

    const pageElement = document.querySelector(`[data-page-number="${pageNumber}"]`)
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }
    try {
      if (!scrollViewerToRef.current) return false
      scrollViewerToRef.current({
        id: `page-${pageNumber}`,
        content: { text: '' },
        position: {
          pageNumber,
          boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1, pageNumber },
          rects: [{ x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1, pageNumber }],
        },
      })
      return true
    } catch {
      return false
    }
  }, [])

  const handleAddBookmark = () => {
    const page = getCurrentPage()
    if (bookmarks.some((item) => item.page === page)) {
      notifications.show({ color: 'orange', message: `Page ${page} is already bookmarked.` })
      return
    }
    const nextBookmarks = [
      ...bookmarks,
      { id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, page, label: bookmarkLabel.trim(), createdAt: new Date().toISOString() },
    ].sort((a, b) => a.page - b.page)
    setBookmarks(nextBookmarks)
    setBookmarkLabel('')
    persistReader({ bookmarks: nextBookmarks, highlights })
  }

  const handleRemoveBookmark = (bookmarkId) => {
    const nextBookmarks = bookmarks.filter((item) => item.id !== bookmarkId)
    setBookmarks(nextBookmarks)
    persistReader({ bookmarks: nextBookmarks, highlights })
  }

  const handleScrollToBookmark = (bookmark) => {
    if (!scrollToPage(bookmark.page)) notifications.show({ color: 'orange', message: 'Unable to jump right now. Please try again in a moment.' })
  }

  const handleAddHighlight = ({ content, position, comment }) => {
    const newHighlight = { id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, content, position, comment, createdAt: new Date().toISOString() }
    const nextHighlights = [newHighlight, ...highlights]
    setHighlights(nextHighlights)
    persistReader({ bookmarks, highlights: nextHighlights })
  }

  const handleRemoveHighlight = (id) => {
    const nextHighlights = highlights.filter((item) => item.id !== id)
    setHighlights(nextHighlights)
    persistReader({ bookmarks, highlights: nextHighlights })
  }

  const handleScrollToHighlight = (highlight) => {
    try {
      if (scrollViewerToRef.current) { scrollViewerToRef.current(highlight); return }
    } catch {
      // Fallback below: jump to highlight page if direct highlight scroll fails.
    }
    const page = highlight?.position?.pageNumber || highlight?.position?.boundingRect?.pageNumber
    if (!scrollToPage(page)) notifications.show({ color: 'orange', message: 'Unable to jump right now. Please try again in a moment.' })
  }

  const visibleHighlights = useMemo(() => {
    const keyword = highlightQuery.trim().toLowerCase()
    if (!keyword) return highlights
    return highlights.filter((item) => {
      const text = item.content?.text || ''
      const note = item.comment?.text || ''
      const page = String(item.position?.pageNumber || '')
      return `${page} ${text} ${note}`.toLowerCase().includes(keyword)
    })
  }, [highlights, highlightQuery])

  return {
    readerRecord,
    readerLoading,
    readerError,
    readerUrl,
    bookmarks,
    bookmarkLabel,
    setBookmarkLabel,
    highlights: visibleHighlights,
    highlightQuery,
    setHighlightQuery,
    lastSavedAt,
    openReader,
    closeReader,
    closeReaderWithProgress,
    handleAddBookmark,
    handleRemoveBookmark,
    handleScrollToBookmark,
    handleAddHighlight,
    handleRemoveHighlight,
    handleScrollToHighlight,
    onScrollRefReady: (scrollTo) => { scrollViewerToRef.current = scrollTo },
    onDocumentLoad: (numPages) => setReaderTotalPages(numPages),
  }
}

export default useBookReader
