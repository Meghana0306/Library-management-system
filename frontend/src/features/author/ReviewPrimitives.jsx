import { Badge, Group } from '@mantine/core'
import { IconStar, IconStarFilled } from '@tabler/icons-react'

export const SENTIMENT_META = {
  POSITIVE: { label: 'Positive', color: 'green' },
  NEUTRAL: { label: 'Neutral', color: 'orange' },
  NEGATIVE: { label: 'Negative', color: 'red' },
}

export const ratingBasedSentiment = (rating) => {
  if (rating >= 4) return 'POSITIVE'
  if (rating === 3) return 'NEUTRAL'
  return 'NEGATIVE'
}

export const StarRating = ({ rating }) => (
  <Group gap={1} wrap="nowrap" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      star <= rating
        ? <IconStarFilled key={star} size={14} color="var(--app-star)" />
        : <IconStar key={star} size={14} stroke={1.5} color="var(--app-star-empty)" />
    ))}
  </Group>
)

export const SentimentBadge = ({ sentiment }) => {
  const meta = SENTIMENT_META[sentiment]
  if (!meta) return null
  return <Badge size="xs" color={meta.color}>{meta.label}</Badge>
}
