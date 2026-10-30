/** Shared status/date helpers for the author portal. */

export const normalizeStatus = (status) => String(status || 'PENDING').toUpperCase()

/** PENDING and APPROVED books can be removed by their author; REJECTED cannot. */
export const isDeletableStatus = (status) => {
  const value = normalizeStatus(status)
  return value === 'PENDING' || value === 'APPROVED'
}

/** An approved book is frozen for editing while a reader still holds a copy. */
export const isEditableBook = (book) => {
  const status = normalizeStatus(book?.status)
  if (status === 'PENDING') return true
  if (status === 'APPROVED') return (book?.activeBorrows || 0) === 0
  return false
}

export const nonDeletableMessage = () => 'This book cannot be deleted in its current status.'

export const nonEditableMessage = (book) => {
  const status = normalizeStatus(book?.status)
  if (status === 'APPROVED' && (book?.activeBorrows || 0) > 0) {
    return 'This book cannot be edited because it is currently borrowed by a user.'
  }
  return 'This book cannot be edited in its current status.'
}

export const formatBookDate = (value) => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString()
}

export const formatNotificationDate = (value) => {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return date.toLocaleString()
}

export const formatReviewDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const truncate = (value, max = 20) => (
  value && value.length > max ? `${value.slice(0, max - 1)}…` : value
)

export const formatRating = (value) => (value == null ? 'N/A' : Number(value).toFixed(1))

export const plural = (count, singular, suffix = 's') => (
  `${singular}${count === 1 ? '' : suffix}`
)

export const formatFileSize = (bytes) => `${((bytes || 0) / 1024 / 1024).toFixed(2)} MB`

/**
 * The api client already raises a quiet notification for a disabled/unavailable
 * AI backend, so callers skip their own inline error for those two codes.
 */
export const isAiUnavailableError = (error) => (
  error?.code === 'AI_DISABLED' || error?.code === 'AI_UNAVAILABLE'
)
