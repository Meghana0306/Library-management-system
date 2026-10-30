import { useState } from 'react'
import { Badge, Collapse, Group, Paper, Progress, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconStarFilled } from '@tabler/icons-react'
import { SENTIMENT_META } from './ReviewPrimitives.jsx'
import { plural, truncate } from './authorUtils.js'

const AnalyticsBar = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" w={72} style={{ flexShrink: 0 }} lineClamp={1}>
        {label}
      </Text>
      <Progress value={pct} color={color} size="sm" style={{ flex: 1 }} />
      <Text size="xs" c="dimmed" w={64} ta="right" style={{ flexShrink: 0 }}>
        {count} ({pct}%)
      </Text>
    </Group>
  )
}

const Section = ({ title, children }) => (
  <Stack gap={6}>
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts={0.4}>
      {title}
    </Text>
    {children}
  </Stack>
)

/** Collapsible aggregate view over every review the author has received. */
export const ReviewAnalytics = ({ bookEntries, sentimentMap, sentimentLoading }) => {
  const [open, setOpen] = useState(true)

  const allReviews = bookEntries.flatMap((entry) => entry.reviews)
  const total = allReviews.length
  if (total === 0) return null

  const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 }
  allReviews.forEach((review) => {
    const value = sentimentMap[review.reviewId]
    if (value && sentimentCounts[value] !== undefined) sentimentCounts[value] += 1
  })

  const ratingCounts = [0, 0, 0, 0, 0]
  allReviews.forEach((review) => {
    if (review.rating >= 1 && review.rating <= 5) ratingCounts[review.rating - 1] += 1
  })

  const replied = allReviews.filter((review) => Boolean(review.authorReply)).length
  const avgRating = (allReviews.reduce((sum, review) => sum + review.rating, 0) / total).toFixed(1)

  return (
    <Paper withBorder p="md">
      <UnstyledButton onClick={() => setOpen((prev) => !prev)} style={{ width: '100%' }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm">
            Feedback Analytics
          </Text>
          {open
            ? <IconChevronUp size={16} stroke={1.5} />
            : <IconChevronDown size={16} stroke={1.5} />}
        </Group>
      </UnstyledButton>

      <Collapse in={open}>
        <Group gap="xs" mt="sm" mb="md" wrap="wrap">
          <Badge color="gray">{total} reviews</Badge>
          <Badge color="gray" leftSection={<IconStarFilled size={10} />}>{avgRating} avg</Badge>
          <Badge color="gray">
            {replied} replied ({Math.round((replied / total) * 100)}%)
          </Badge>
          <Badge color="gray">
            {bookEntries.length} {plural(bookEntries.length, 'book')}
          </Badge>
          {sentimentLoading ? <Badge color="gray" variant="outline">Analyzing sentiment…</Badge> : null}
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Section title="Sentiment Analysis">
            <AnalyticsBar label="Positive" count={sentimentCounts.POSITIVE} total={total} color={SENTIMENT_META.POSITIVE.color} />
            <AnalyticsBar label="Neutral" count={sentimentCounts.NEUTRAL} total={total} color={SENTIMENT_META.NEUTRAL.color} />
            <AnalyticsBar label="Negative" count={sentimentCounts.NEGATIVE} total={total} color={SENTIMENT_META.NEGATIVE.color} />
          </Section>

          <Section title="Rating Distribution">
            {[5, 4, 3, 2, 1].map((star) => (
              <AnalyticsBar
                key={star}
                label={`${star} star`}
                count={ratingCounts[star - 1]}
                total={total}
                color="amber"
              />
            ))}
          </Section>

          <Section title="Reply Rate by Book">
            {bookEntries.map((entry) => (
              <AnalyticsBar
                key={entry.bookId}
                label={truncate(entry.bookTitle, 22)}
                count={entry.reviews.filter((review) => Boolean(review.authorReply)).length}
                total={entry.reviews.length}
                color="forest"
              />
            ))}
          </Section>
        </SimpleGrid>
      </Collapse>
    </Paper>
  )
}

export default ReviewAnalytics
