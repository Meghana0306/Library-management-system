import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { reviewService } from '../../services'
import { ApiError } from '../../services/api'

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

/** 5 clickable stars with hover preview; `readonly` renders a static display. */
export const StarRating = ({ value, onChange, readonly = false, size = 22 }) => {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <Group gap={2} aria-label={`Rating: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          type="button"
          variant="subtle"
          color={display >= star ? 'amber' : 'gray'}
          p={2}
          size="compact-sm"
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          disabled={readonly}
          aria-label={`${star} star`}
          style={{ cursor: readonly ? 'default' : 'pointer' }}
        >
          {display >= star ? <IconStarFilled size={size} /> : <IconStar size={size} stroke={1.5} />}
        </Button>
      ))}
    </Group>
  )
}

/** Static 5-star display; shows "X.X (Y)" when a review count is supplied. */
export const StarDisplay = ({ value, count }) => {
  const num = Number(value) || 0
  return (
    <Group gap={2} title={`${num.toFixed(1)} / 5`} wrap="nowrap">
      {[1, 2, 3, 4, 5].map((star) => (
        star <= Math.round(num)
          ? <IconStarFilled key={star} size={14} color="var(--app-star)" />
          : <IconStar key={star} size={14} stroke={1.5} color="var(--app-star-empty)" />
      ))}
      {count != null ? (
        <Text size="xs" c="dimmed" ml={4}>
          {num.toFixed(1)} ({count})
        </Text>
      ) : null}
    </Group>
  )
}

/**
 * Modal for submitting / editing a book review. On a 409 (already reviewed),
 * fetches the user's existing review for the book and switches to edit mode.
 */
export const BookReviewModal = ({ bookId, bookTitle, userId, existingReview, onClose, onSaved }) => {
  const toReviewState = (review) => ({
    activeReview: review || null,
    rating: review?.rating || 0,
    reviewText: review?.reviewText || '',
    isAnonymous: review?.isAnonymous || false,
  })
  const initialState = toReviewState(existingReview)
  const [activeReview, setActiveReview] = useState(initialState.activeReview)
  const [rating, setRating] = useState(initialState.rating)
  const [reviewText, setReviewText] = useState(initialState.reviewText)
  const [isAnonymous, setIsAnonymous] = useState(initialState.isAnonymous)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextState = toReviewState(existingReview)
    setActiveReview(nextState.activeReview)
    setRating(nextState.rating)
    setReviewText(nextState.reviewText)
    setIsAnonymous(nextState.isAnonymous)
  }, [existingReview])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (rating < 1) {
      setError('Please select a rating (1-5 stars).')
      return
    }
    setLoading(true)
    setError('')
    try {
      let response
      if (activeReview?.reviewId) {
        response = await reviewService.updateReview(activeReview.reviewId, { rating, reviewText, isAnonymous })
      } else {
        response = await reviewService.submitReview({ userId, bookId, rating, reviewText, isAnonymous })
      }
      notifications.show({ color: 'green', message: 'Review saved!' })
      onSaved?.(response.data)
      setTimeout(onClose, 800)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !activeReview?.reviewId && userId && bookId) {
        try {
          const reviewsRes = await reviewService.getReviewsByUser(userId)
          const existing = (reviewsRes.data?.reviews || []).find((review) => Number(review.bookId) === Number(bookId))
          if (existing) {
            setActiveReview(existing)
            setRating(existing.rating || 0)
            setReviewText(existing.reviewText || '')
            setError('You already reviewed this book. You can edit your existing review now.')
            setLoading(false)
            return
          }
        } catch {
          // Fall back to generic error handling below.
        }
      }
      setError(err instanceof ApiError ? err.message : 'Failed to save review.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal opened onClose={onClose} title={activeReview ? 'Edit Your Review' : 'Write a Review'} size="md">
      <Stack gap="sm">
        <Badge variant="light" size="lg" radius="sm">{bookTitle}</Badge>

        {error ? <Text size="sm" c="red">{error}</Text> : null}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Stack gap={4}>
              <Text size="sm" fw={600}>Your Rating</Text>
              <Group gap="sm">
                <StarRating value={rating} onChange={setRating} />
                {rating > 0 ? <Badge color="amber">{RATING_LABELS[rating]}</Badge> : null}
              </Group>
            </Stack>

            <Stack gap={4}>
              <Textarea
                label="Review (optional)"
                rows={4}
                maxLength={1000}
                placeholder="Share your thoughts about this book..."
                value={reviewText}
                onChange={(event) => setReviewText(event.currentTarget.value)}
                disabled={loading}
              />
              <Text size="xs" c="dimmed" ta="right">{reviewText.length}/1000</Text>
            </Stack>

            <Stack gap={4}>
              <Checkbox
                label="Submit anonymously"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.currentTarget.checked)}
                disabled={loading}
              />
              <Text size="xs" c="dimmed">Your name will appear as &quot;Anonymous&quot; to other readers.</Text>
            </Stack>

            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" loading={loading} disabled={rating < 1}>
                {activeReview ? 'Update Review' : 'Submit Review'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  )
}

/** Read-only panel showing all reviews for a book, with recent/rating sort. */
export const BookReviewsPanel = ({ bookId }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('recent')

  const loadReviews = (sortBy) => {
    if (!bookId) return
    setLoading(true)
    reviewService.getReviewsForBook(bookId, sortBy)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReviews(sort)
  }, [bookId])

  if (loading) {
    return (
      <Group py="md" justify="center">
        <Loader size="sm" />
      </Group>
    )
  }

  if (!data || data.reviewCount === 0) {
    return <Text size="sm" c="dimmed">No reviews yet. Be the first to review!</Text>
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <StarDisplay value={data.averageRating} count={data.reviewCount} />
        <Select
          value={sort}
          onChange={(value) => { setSort(value); loadReviews(value) }}
          data={[
            { value: 'recent', label: 'Most Recent' },
            { value: 'rating', label: 'Highest Rated' },
          ]}
          w={160}
          allowDeselect={false}
        />
      </Group>
      <Stack gap="xs">
        {(data.reviews || []).map((review) => (
          <Stack key={review.reviewId} gap={2} p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Group justify="space-between">
              <Text size="sm" fw={600}>{review.isAnonymous ? 'Anonymous' : (review.reviewerName || 'Unknown')}</Text>
              <Group gap="sm">
                <StarDisplay value={review.rating} />
                <Text size="xs" c="dimmed">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</Text>
              </Group>
            </Group>
            {review.reviewText ? <Text size="sm">{review.reviewText}</Text> : null}
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

export default BookReviewModal
