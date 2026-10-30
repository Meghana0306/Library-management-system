import { Badge, Button, Card, Checkbox, Group, Stack, Text } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { AuthImage } from '../../../components/common/AuthImage.jsx'
import { coverPath } from '../../../services/api'
import { StarDisplay } from '../BookReviewModal.jsx'

const SUMMARY_THRESHOLD = 180

const availabilityBadge = (book) => {
  const quantity = Number(book.quantity) || 0
  if (quantity <= 0) return { label: 'Not Available', color: 'red' }
  if (quantity <= 2) return { label: 'Limited Availability', color: 'orange' }
  return { label: 'Available', color: 'green' }
}

const isLongSummary = (text) => text.length > SUMMARY_THRESHOLD || text.includes('\n')

/** One book tile in the Available Books card grid — the sole grid view in the app. */
export const BookCard = ({
  book,
  selected = false,
  onToggleSelect,
  onBorrow,
  onViewPDF,
  onOpenDetail,
  rating,
  recommended = false,
  recommendReason,
}) => {
  const summary = book.description?.trim() || 'No summary available.'
  const availability = availabilityBadge(book)
  const borrowable = Number(book.quantity) > 0

  return (
    <Card>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          {onToggleSelect ? (
            <Checkbox
              checked={selected}
              onChange={() => onToggleSelect(book.id)}
              disabled={!borrowable}
              label="Select"
              size="sm"
            />
          ) : <span />}
          <Badge color={recommended ? 'amber' : availability.color}>
            {recommended ? 'Recommended' : availability.label}
          </Badge>
        </Group>

        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="sm" lineClamp={2}>{book.title}</Text>
            <Text size="xs" c="dimmed">{book.author || 'Unknown author'}</Text>
            <Text size="xs" c="dimmed">{book.genre || 'Uncategorised'}</Text>
            {!recommended && book.publishedDate ? (
              <Text size="xs" c="dimmed">Published {new Date(book.publishedDate).toLocaleDateString()}</Text>
            ) : null}
            {!recommended ? <Text size="xs" c="dimmed">Copies available: {book.quantity ?? 0}</Text> : null}
          </Stack>
          <AuthImage path={book.id ? coverPath(book.id) : null} kind="cover" name={book.title} width={56} height={78} />
        </Group>

        {!recommended && rating?.reviewCount > 0 ? (
          <Button
            variant="subtle"
            size="compact-xs"
            justify="flex-start"
            px={0}
            onClick={() => onOpenDetail?.(book, 'reviews')}
          >
            <StarDisplay value={rating.averageRating} count={rating.reviewCount} />
          </Button>
        ) : !recommended ? (
          <Text size="xs" c="dimmed">No reviews yet</Text>
        ) : null}

        <Stack gap={2}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {recommended ? 'Why recommended' : 'Summary'}
          </Text>
          {recommended ? (
            <Text size="xs" c="dimmed" lineClamp={2}>{recommendReason || 'Popular among library users'}</Text>
          ) : isLongSummary(summary) ? (
            <Button variant="subtle" size="compact-xs" px={0} justify="flex-start" onClick={() => onOpenDetail?.(book, 'summary')}>
              <Text size="xs" c="dimmed" lineClamp={3} ta="left">{summary}</Text>
            </Button>
          ) : (
            <Text size="xs" c="dimmed" lineClamp={3}>{summary}</Text>
          )}
        </Stack>

        <Group gap="xs" mt={4}>
          {!recommended && book.filePath ? (
            <Button variant="default" size="xs" leftSection={<IconFileText size={14} stroke={1.5} />} onClick={() => onViewPDF?.(book)}>
              View PDF
            </Button>
          ) : null}
          <Button size="xs" disabled={!borrowable} onClick={() => onBorrow?.(book)} ml={recommended ? 0 : 'auto'}>
            {borrowable ? 'Borrow' : 'Unavailable'}
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export default BookCard
