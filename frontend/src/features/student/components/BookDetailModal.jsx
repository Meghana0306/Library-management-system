import { Button, Divider, Group, Modal, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { BookReviewsPanel } from '../BookReviewModal.jsx'

/**
 * Combined "quick read summary" + "community reviews" modal. The old UI had
 * two separate popups (a summary preview and a lighter reviews-only popup)
 * that showed overlapping information; this merges them into one dense panel
 * reachable from either trigger, per CONTRACTS §10 (avoid duplicate modal UI).
 */
export const BookDetailModal = ({ book, onClose, onBorrow, onWriteReview }) => {
  if (!book) return null
  const borrowable = Number(book.quantity) > 0

  return (
    <Modal opened onClose={onClose} title={book.title} size="lg">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="xs">
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase">Author</Text>
            <Text size="sm" fw={600}>{book.author || 'Unknown'}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase">Genre</Text>
            <Text size="sm" fw={600}>{book.genre || 'Not specified'}</Text>
          </Stack>
          {book.publishedDate ? (
            <Stack gap={0}>
              <Text size="xs" c="dimmed" tt="uppercase">Published</Text>
              <Text size="sm" fw={600}>{new Date(book.publishedDate).toLocaleDateString()}</Text>
            </Stack>
          ) : null}
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase">Copies available</Text>
            <Text size="sm" fw={600}>{book.quantity ?? 0}</Text>
          </Stack>
        </SimpleGrid>

        <Stack gap={4}>
          <Title order={4}>Summary</Title>
          <Text size="sm">{book.description?.trim() || 'No summary available.'}</Text>
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Title order={4}>Ratings &amp; Reviews</Title>
          <BookReviewsPanel bookId={book.id} />
        </Stack>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => onWriteReview?.(book)}>Write a Review</Button>
          <Button disabled={!borrowable} onClick={() => onBorrow?.(book)}>
            {borrowable ? 'Borrow This Book' : 'Unavailable'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default BookDetailModal
