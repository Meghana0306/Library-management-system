import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Grid,
  Group,
  NavLink,
  Paper,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { IconAlertCircle, IconFlag, IconMessage } from '@tabler/icons-react'
import { reviewService } from '../../services'
import { useAiCapability } from '../../ai/AiCapabilityContext.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { ReviewAnalytics } from './ReviewAnalytics.jsx'
import { ReviewCard } from './ReviewCard.jsx'
import { StarRating, ratingBasedSentiment } from './ReviewPrimitives.jsx'
import { plural } from './authorUtils.js'

/**
 * Reviews tab. Sentiment is assigned from the star rating immediately, then
 * refined by the AI batch endpoint when the server reports that feature as
 * available — the rating-based value stays as the fallback either way.
 */
export const AuthorReviews = ({ authorId }) => {
  const [bookEntries, setBookEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [sentimentMap, setSentimentMap] = useState({})
  const [sentimentLoading, setSentimentLoading] = useState(false)
  const { available: sentimentAvailable } = useAiCapability('sentiment')

  useEffect(() => {
    if (!authorId) return

    let active = true
    setLoading(true)
    setError('')

    reviewService.getReviewsForAuthor(authorId)
      .then((response) => {
        if (!active) return
        const entries = Array.isArray(response.data) ? response.data : []
        setBookEntries(entries)
        if (entries.length > 0) setSelectedBookId(entries[0].bookId)

        const initial = {}
        entries.forEach((entry) => {
          entry.reviews.forEach((review) => {
            initial[review.reviewId] = ratingBasedSentiment(review.rating)
          })
        })
        setSentimentMap(initial)
      })
      .catch(() => {
        if (active) setError('Failed to load reviews. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [authorId])

  useEffect(() => {
    if (!sentimentAvailable || bookEntries.length === 0) return undefined

    const withText = bookEntries
      .flatMap((entry) => entry.reviews)
      .filter((review) => review.reviewText && review.reviewText.trim())
      .map((review) => ({ id: review.reviewId, rating: review.rating, text: review.reviewText }))

    if (withText.length === 0) return undefined

    let active = true
    setSentimentLoading(true)
    reviewService.analyzeSentiment(withText)
      .then((response) => {
        if (!active) return
        setSentimentMap((prev) => ({ ...prev, ...(response.data?.sentiments || {}) }))
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSentimentLoading(false)
      })

    return () => {
      active = false
    }
    // Keyed to the loaded review set, so replying or flagging does not re-run it.
  }, [sentimentAvailable, bookEntries.length, authorId])

  const handleReviewUpdate = (bookId, updated) => {
    setBookEntries((prev) => prev.map((entry) => {
      if (entry.bookId !== bookId) return entry
      return {
        ...entry,
        reviews: entry.reviews.map((review) => (
          review.reviewId === updated.reviewId ? { ...review, ...updated } : review
        )),
      }
    }))
  }

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={240} radius="sm" />
        <Skeleton height={120} radius="sm" />
        <Skeleton height={220} radius="sm" />
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
        {error}
      </Alert>
    )
  }

  if (bookEntries.length === 0) {
    return (
      <EmptyState
        icon={IconMessage}
        title="You have no published books with reviews yet."
        description="Reviews from readers will appear here once your books are approved and borrowed."
      />
    )
  }

  const selected = bookEntries.find((entry) => entry.bookId === selectedBookId) || bookEntries[0]
  const totalReviews = bookEntries.reduce((sum, entry) => sum + entry.reviewCount, 0)
  const flaggedCount = bookEntries.reduce(
    (sum, entry) => sum + entry.reviews.filter((review) => review.flagged).length,
    0,
  )

  return (
    <Stack gap="md">
      <PageHeader title="Reviews & Feedback" />

      <Group gap="xs" wrap="wrap">
        <Badge color="gray">
          {bookEntries.length} {plural(bookEntries.length, 'book')} with reviews
        </Badge>
        <Badge color="gray">
          {totalReviews} total {plural(totalReviews, 'review')}
        </Badge>
        {flaggedCount > 0 ? (
          <Badge color="red" leftSection={<IconFlag size={12} stroke={1.5} />}>
            {flaggedCount} flagged
          </Badge>
        ) : null}
      </Group>

      <ReviewAnalytics
        bookEntries={bookEntries}
        sentimentMap={sentimentMap}
        sentimentLoading={sentimentLoading}
      />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p={4}>
            {bookEntries.map((entry) => {
              const flagged = entry.reviews.filter((review) => review.flagged).length
              const sentiments = entry.reviews.map((review) => sentimentMap[review.reviewId]).filter(Boolean)
              const positive = sentiments.filter((value) => value === 'POSITIVE').length
              const negative = sentiments.filter((value) => value === 'NEGATIVE').length

              return (
                <NavLink
                  key={entry.bookId}
                  active={entry.bookId === selected.bookId}
                  onClick={() => setSelectedBookId(entry.bookId)}
                  label={entry.bookTitle}
                  description={(
                    <Group gap={6} wrap="wrap">
                      <Text size="xs" c="dimmed">
                        {entry.reviewCount} {plural(entry.reviewCount, 'review')}
                        {entry.averageRating != null ? ` · ${Number(entry.averageRating).toFixed(1)}/5` : ''}
                      </Text>
                      {flagged > 0 ? <Badge size="xs" color="red">{flagged} flagged</Badge> : null}
                      {positive > 0 ? <Badge size="xs" color="green">{positive}+</Badge> : null}
                      {negative > 0 ? <Badge size="xs" color="red">{negative}−</Badge> : null}
                    </Group>
                  )}
                />
              )
            })}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text fw={600}>{selected.bookTitle}</Text>
              {selected.averageRating != null ? (
                <Group gap="xs" wrap="nowrap">
                  <StarRating rating={Math.round(selected.averageRating)} />
                  <Text size="sm" c="dimmed">
                    {Number(selected.averageRating).toFixed(1)} / 5 ({selected.reviewCount}{' '}
                    {plural(selected.reviewCount, 'review')})
                  </Text>
                </Group>
              ) : null}
            </Group>

            {selected.reviews.length === 0 ? (
              <EmptyState compact icon={IconMessage} title="No reviews yet for this book." />
            ) : (
              selected.reviews.map((review) => (
                <ReviewCard
                  key={review.reviewId}
                  review={review}
                  authorId={authorId}
                  sentiment={sentimentMap[review.reviewId] || null}
                  onUpdate={(updated) => handleReviewUpdate(selected.bookId, updated)}
                />
              ))
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

export default AuthorReviews
