import { useCallback, useEffect, useMemo, useState } from 'react'

export const NOTIFICATION_CATEGORIES = ['ALL', 'APPROVAL', 'REJECTION', 'DELETION', 'ANNOUNCEMENT']

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const STATIC_ANNOUNCEMENTS = [
  {
    id: 'announcement-guideline',
    category: 'ANNOUNCEMENT',
    priority: 'LOW',
    title: 'Author Reminder',
    message: 'Keep book descriptions clear and complete to speed up librarian review.',
    timestamp: '2026-03-31T09:00:00.000Z',
  },
]

export const categoryLabel = (category) => {
  if (category === 'APPROVAL') return 'Approval'
  if (category === 'REJECTION') return 'Rejection'
  if (category === 'DELETION') return 'Deletion'
  if (category === 'ANNOUNCEMENT') return 'Announcement'
  return 'All'
}

export const notificationStorageKey = (authorId) => (
  authorId ? `author-notification-state-${authorId}` : ''
)

const EMPTY_STATE = {
  archivedNotificationIds: [],
  readNotificationIds: [],
  deletedNotificationIds: [],
  manualNotifications: [],
}

const readStoredState = (key) => {
  if (!key) return EMPTY_STATE
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    return {
      archivedNotificationIds: Array.isArray(parsed.archivedNotificationIds) ? parsed.archivedNotificationIds : [],
      readNotificationIds: Array.isArray(parsed.readNotificationIds) ? parsed.readNotificationIds : [],
      deletedNotificationIds: Array.isArray(parsed.deletedNotificationIds) ? parsed.deletedNotificationIds : [],
      manualNotifications: Array.isArray(parsed.manualNotifications) ? parsed.manualNotifications : [],
    }
  } catch {
    return EMPTY_STATE
  }
}

const addOnce = (list, id) => (list.includes(id) ? list : [...list, id])

/**
 * The author notification board is derived state: approval/rejection entries
 * come from the book list, deletion entries are recorded locally when the
 * author removes a book, and read/archived/deleted flags live in localStorage
 * under `author-notification-state-{authorId}`.
 */
export const useAuthorNotifications = ({ authorId, books, view, filter, search }) => {
  const storageKey = useMemo(() => notificationStorageKey(authorId), [authorId])

  const [state, setState] = useState(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!storageKey) {
      setLoaded(false)
      return
    }
    setState(readStoredState(storageKey))
    setLoaded(true)
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || !loaded) return
    localStorage.setItem(storageKey, JSON.stringify(state))
  }, [storageKey, loaded, state])

  const { archivedNotificationIds, readNotificationIds, deletedNotificationIds, manualNotifications } = state

  const notifications = useMemo(() => {
    const statusNotifications = books
      .filter((book) => ['APPROVED', 'REJECTED'].includes(String(book.status || '').toUpperCase()))
      .map((book) => {
        const status = String(book.status || '').toUpperCase()
        const isApproved = status === 'APPROVED'
        return {
          id: `status-${book.id}-${status}`,
          category: isApproved ? 'APPROVAL' : 'REJECTION',
          priority: isApproved ? 'MEDIUM' : 'HIGH',
          title: isApproved ? 'Book Approved' : 'Book Rejected',
          message: isApproved
            ? `Your book "${book.title}" has been approved and published.`
            : `Your book "${book.title}" has been rejected.${book.rejectionReason ? ` Reason: ${book.rejectionReason}` : ' Please submit a new version if needed.'}`,
          timestamp: book.publishedDate || book.submittedDate,
        }
      })

    return [...statusNotifications, ...manualNotifications, ...STATIC_ANNOUNCEMENTS].sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
    )
  }, [books, manualNotifications])

  const activeNotifications = useMemo(
    () => notifications.filter((item) => (
      !archivedNotificationIds.includes(item.id) && !deletedNotificationIds.includes(item.id)
    )),
    [notifications, archivedNotificationIds, deletedNotificationIds],
  )

  const archivedNotifications = useMemo(
    () => notifications.filter((item) => (
      archivedNotificationIds.includes(item.id) && !deletedNotificationIds.includes(item.id)
    )),
    [notifications, archivedNotificationIds, deletedNotificationIds],
  )

  const scoped = view === 'ARCHIVED' ? archivedNotifications : activeNotifications

  const visible = useMemo(() => {
    const byCategory = filter === 'ALL' ? scoped : scoped.filter((item) => item.category === filter)

    const query = (search || '').trim().toLowerCase()
    const bySearch = !query
      ? byCategory
      : byCategory.filter((item) => (
        `${item.title} ${item.message} ${categoryLabel(item.category)}`.toLowerCase().includes(query)
      ))

    return [...bySearch].sort((a, b) => {
      const left = PRIORITY_ORDER[a.priority] ?? 3
      const right = PRIORITY_ORDER[b.priority] ?? 3
      if (left !== right) return left - right
      return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    })
  }, [scoped, filter, search])

  const categoryCounts = useMemo(() => ({
    ALL: scoped.length,
    APPROVAL: scoped.filter((item) => item.category === 'APPROVAL').length,
    REJECTION: scoped.filter((item) => item.category === 'REJECTION').length,
    DELETION: scoped.filter((item) => item.category === 'DELETION').length,
    ANNOUNCEMENT: scoped.filter((item) => item.category === 'ANNOUNCEMENT').length,
  }), [scoped])

  const unreadCount = useMemo(
    () => activeNotifications.filter((item) => !readNotificationIds.includes(item.id)).length,
    [activeNotifications, readNotificationIds],
  )

  const addDeletionNotification = useCallback((message) => {
    setState((prev) => ({
      ...prev,
      manualNotifications: [
        {
          id: `manual-deletion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          category: 'DELETION',
          priority: 'HIGH',
          title: 'Book Deletion Update',
          message,
          timestamp: new Date().toISOString(),
        },
        ...prev.manualNotifications,
      ],
    }))
  }, [])

  const toggleRead = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      readNotificationIds: prev.readNotificationIds.includes(id)
        ? prev.readNotificationIds.filter((item) => item !== id)
        : [...prev.readNotificationIds, id],
    }))
  }, [])

  const archive = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      archivedNotificationIds: addOnce(prev.archivedNotificationIds, id),
      readNotificationIds: addOnce(prev.readNotificationIds, id),
    }))
  }, [])

  const restore = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      archivedNotificationIds: prev.archivedNotificationIds.filter((item) => item !== id),
    }))
  }, [])

  const remove = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      deletedNotificationIds: addOnce(prev.deletedNotificationIds, id),
    }))
  }, [])

  const markAllRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      readNotificationIds: Array.from(new Set([
        ...prev.readNotificationIds,
        ...activeNotifications.map((item) => item.id),
      ])),
    }))
  }, [activeNotifications])

  return {
    notifications: visible,
    categoryCounts,
    unreadCount,
    readNotificationIds,
    addDeletionNotification,
    toggleRead,
    archive,
    restore,
    remove,
    markAllRead,
  }
}

export default useAuthorNotifications
