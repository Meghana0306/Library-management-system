import { useEffect, useState } from 'react'
import { Button, Skeleton, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconStar } from '@tabler/icons-react'
import { reviewService } from '../../services'
import { DataTable } from '../../components/common/DataTable.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { BookReviewModal, StarDisplay } from './BookReviewModal.jsx'

export const MyReviews = ({ userId }) => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingReview, setEditingReview] = useState(null)

  const loadReviews = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await reviewService.getReviewsByUser(userId)
      setReviews(Array.isArray(res.data.reviews) ? res.data.reviews : [])
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load your reviews.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReviews() }, [userId])

  const columns = [
    {
      key: 'book',
      label: 'Book',
      render: (review) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>{review.bookTitle || 'Unknown Book'}</Text>
          {review.bookAuthor ? <Text size="xs" c="dimmed">by {review.bookAuthor}</Text> : null}
        </Stack>
      ),
    },
    { key: 'rating', label: 'Rating', render: (review) => <StarDisplay value={review.rating} /> },
    { key: 'reviewText', label: 'Review', render: (review) => <Text size="sm" lineClamp={2}>{review.reviewText || '—'}</Text> },
    { key: 'createdAt', label: 'Submitted', render: (review) => (review.createdAt ? new Date(review.createdAt).toLocaleDateString() : '—') },
    {
      key: 'actions',
      label: 'Actions',
      render: (review) => (
        <Button size="compact-xs" variant="default" onClick={() => setEditingReview(review)}>Edit Review</Button>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Title order={3}>My Reviews</Title>

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={IconStar}
          title="No reviews yet"
          description="You haven't reviewed any books yet. Borrow and read a book to leave a review!"
        />
      ) : (
        <DataTable columns={columns} rows={reviews} rowKey="reviewId" emptyLabel="No reviews yet." />
      )}

      {editingReview ? (
        <BookReviewModal
          bookId={editingReview.bookId}
          bookTitle={editingReview.bookTitle || 'Book'}
          userId={userId}
          existingReview={editingReview}
          onClose={() => setEditingReview(null)}
          onSaved={loadReviews}
        />
      ) : null}
    </Stack>
  )
}

export default MyReviews
