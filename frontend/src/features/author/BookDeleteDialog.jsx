import { List, Text } from '@mantine/core'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'

/** Single-book delete confirmation. */
export const BookDeleteDialog = ({ book, loading, onCancel, onConfirm }) => (
  <ConfirmModal
    opened={Boolean(book)}
    onClose={onCancel}
    onConfirm={onConfirm}
    title={`Delete "${book?.title ?? ''}"?`}
    confirmLabel="Delete Permanently"
    danger
    loading={loading}
  >
    <Text size="sm">This action is irreversible and cannot be undone.</Text>
    <Text size="sm" c="dimmed" mt={4}>
      The book record and submission data will be permanently removed.
    </Text>
  </ConfirmModal>
)

/** Bulk delete confirmation, listing every title in the selection. */
export const BulkDeleteDialog = ({ opened, books, loading, onCancel, onConfirm }) => (
  <ConfirmModal
    opened={opened}
    onClose={onCancel}
    onConfirm={onConfirm}
    title={`Delete ${books.length} selected books?`}
    confirmLabel="Delete Selected Permanently"
    danger
    loading={loading}
  >
    <Text size="sm">This action is irreversible and cannot be undone.</Text>
    <Text size="sm" c="dimmed" mt={4}>
      Published books will be deleted only if they are not currently borrowed.
    </Text>
    <List size="sm" mt="sm" spacing={2} withPadding>
      {books.map((book) => (
        <List.Item key={book.id}>{book.title}</List.Item>
      ))}
    </List>
  </ConfirmModal>
)

export default BookDeleteDialog
