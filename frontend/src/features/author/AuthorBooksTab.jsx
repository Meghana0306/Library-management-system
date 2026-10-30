import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Grid, Group, Paper, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconTrash } from '@tabler/icons-react'
import { bookService } from '../../services'
import { PDFPreviewModal } from '../../components/common/PDFPreviewModal.jsx'
import { BookListSection } from './BookListSection.jsx'
import { BookDetailModal } from './BookDetailModal.jsx'
import { BookEditModal } from './BookEditModal.jsx'
import { BookDeleteDialog, BulkDeleteDialog } from './BookDeleteDialog.jsx'
import { isDeletableStatus, plural } from './authorUtils.js'

const notifyError = (message) => notifications.show({ title: 'Action failed', message, color: 'red', withBorder: true })
const notifySuccess = (message) => notifications.show({ message, color: 'green', withBorder: true })

/** "My Books": the three status sections, the bulk toolbar and every book dialog. */
export const AuthorBooksTab = ({
  authorId,
  books,
  loading,
  error,
  reload,
  selectedBookIds,
  onSelectionChange,
  detailBookId,
  onDetailChange,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  onDeletionNotification,
  notificationsPanel,
}) => {
  const [editBook, setEditBook] = useState(null)
  const [deleteBook, setDeleteBook] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  const pendingBooks = useMemo(() => books.filter((book) => String(book.status || '').toUpperCase() === 'PENDING'), [books])
  const approvedBooks = useMemo(() => books.filter((book) => String(book.status || '').toUpperCase() === 'APPROVED'), [books])
  const rejectedBooks = useMemo(() => books.filter((book) => String(book.status || '').toUpperCase() === 'REJECTED'), [books])

  const selectableIds = useMemo(
    () => books.filter((book) => isDeletableStatus(book.status)).map((book) => book.id).filter(Boolean),
    [books],
  )
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedBookIds.includes(id))

  const detailBook = books.find((book) => book.id === detailBookId) || null
  const selectedBooks = books.filter((book) => selectedBookIds.includes(book.id))

  const toggleSelect = (bookId) => {
    onSelectionChange(selectedBookIds.includes(bookId)
      ? selectedBookIds.filter((id) => id !== bookId)
      : [...selectedBookIds, bookId])
  }

  const toggleSelectAll = () => onSelectionChange(allSelected ? [] : selectableIds)

  const handleSaved = async () => {
    setEditBook(null)
    await reload()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteBook || !authorId) return

    setDeleteLoading(true)
    try {
      await bookService.deleteAuthorBook(authorId, deleteBook.id)
      onSelectionChange(selectedBookIds.filter((id) => id !== deleteBook.id))
      if (detailBookId === deleteBook.id) onDetailChange(null)
      notifySuccess('Book deleted successfully.')
      onDeletionNotification(`Book "${deleteBook.title}" was deleted.`)
      setDeleteBook(null)
      await reload()
    } catch (err) {
      notifyError(err?.message || 'Failed to delete book')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (!authorId || selectedBookIds.length === 0) return

    setBulkLoading(true)
    try {
      const response = await bookService.bulkDeleteAuthorBooks(authorId, selectedBookIds)
      const data = response?.data || {}
      const deletedCount = Number(data.deletedCount || 0)
      const failedCount = Number(data.failedCount || 0)

      if (failedCount === 0) {
        notifySuccess(`${deletedCount} ${plural(deletedCount, 'book')} deleted successfully.`)
      } else {
        const reasons = Array.isArray(data.failedBooks)
          ? data.failedBooks.map((item) => {
            const book = books.find((entry) => entry.id === item.bookId)
            return `${book?.title || `Book #${item.bookId}`}: ${item.reason}`
          }).join('\n')
          : ''

        if (deletedCount === 0 && failedCount === 1) {
          notifyError('Book is currently being borrowed, cannot be deleted.')
        } else if (reasons) {
          notifyError(`Some books could not be deleted:\n${reasons}`)
        } else {
          notifyError(`${failedCount} ${plural(failedCount, 'book')} could not be deleted.`)
        }
      }

      if (deletedCount > 0) {
        onDeletionNotification(`${deletedCount} ${plural(deletedCount, 'book')} deleted from your submissions.`)
      }

      onBulkDeleteOpenChange(false)
      onSelectionChange([])
      await reload()
    } catch (err) {
      notifyError(err?.message || 'Failed to bulk delete books')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            {error ? (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
                {error}
              </Alert>
            ) : null}

            <Paper withBorder p="sm">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Group gap="md">
                  <Checkbox
                    label="Select All"
                    checked={allSelected}
                    disabled={loading || selectableIds.length === 0}
                    onChange={toggleSelectAll}
                  />
                  <Text size="sm" c="dimmed">
                    Selected: {selectedBookIds.length}
                  </Text>
                </Group>
                <Button
                  variant="default"
                  color="red"
                  leftSection={<IconTrash size={16} stroke={1.5} />}
                  disabled={selectedBookIds.length === 0 || loading}
                  onClick={() => onBulkDeleteOpenChange(true)}
                >
                  Delete Selected
                </Button>
              </Group>
            </Paper>

            <BookListSection
              title="Submitted Books (Pending Review)"
              books={pendingBooks}
              maxVisible={3}
              loading={loading}
              emptyMessage="No pending submissions."
              selectedBookIds={selectedBookIds}
              onToggleSelect={toggleSelect}
              onOpen={(book) => onDetailChange(book.id)}
            />

            <BookListSection
              title="Rejected Books"
              books={rejectedBooks}
              maxVisible={3}
              loading={loading}
              emptyMessage="No rejected books."
              selectedBookIds={selectedBookIds}
              onToggleSelect={toggleSelect}
              onOpen={(book) => onDetailChange(book.id)}
            />

            <BookListSection
              title="Published / Accepted Books"
              books={approvedBooks}
              maxVisible={8}
              loading={loading}
              emptyMessage="No accepted books yet."
              selectedBookIds={selectedBookIds}
              onToggleSelect={toggleSelect}
              onOpen={(book) => onDetailChange(book.id)}
            />
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>{notificationsPanel}</Grid.Col>
      </Grid>

      <BookDetailModal
        book={detailBook}
        onClose={() => onDetailChange(null)}
        onEdit={(book) => setEditBook(book)}
        onDelete={(book) => setDeleteBook(book)}
        onPreview={(book) => setPreviewFile({ title: book.title, filePath: book.filePath })}
      />

      {editBook ? (
        <BookEditModal
          book={editBook}
          authorId={authorId}
          onClose={() => setEditBook(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <BookDeleteDialog
        book={deleteBook}
        loading={deleteLoading}
        onCancel={() => (deleteLoading ? null : setDeleteBook(null))}
        onConfirm={handleDeleteConfirm}
      />

      <BulkDeleteDialog
        opened={bulkDeleteOpen}
        books={selectedBooks}
        loading={bulkLoading}
        onCancel={() => (bulkLoading ? null : onBulkDeleteOpenChange(false))}
        onConfirm={handleBulkDeleteConfirm}
      />

      <PDFPreviewModal
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        filePath={previewFile?.filePath}
        bookTitle={previewFile?.title}
      />
    </>
  )
}

export default AuthorBooksTab
