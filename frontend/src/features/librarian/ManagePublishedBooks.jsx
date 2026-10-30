import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconRefresh } from '@tabler/icons-react'
import { bookService, librarianService } from '../../services'
import { ApiError } from '../../services/api'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { statusColor } from '../../theme.js'
import { BookFormModal } from './BookFormModal.jsx'
import { BookHistoryModal } from './BookHistoryModal.jsx'
import { BulkDeleteBooksModal, BulkEditBooksModal } from './BookBulkModals.jsx'

const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'REJECTED']
const SOURCE_OPTIONS = [
  { value: 'ALL', label: 'All Sources' },
  { value: 'AUTHOR_SUBMISSION', label: 'Author Submissions' },
  { value: 'LIBRARIAN_MANUAL', label: 'Librarian Added' },
  { value: 'REQUEST_DOWNLOAD', label: 'Downloaded' },
]

const notifyError = (err, fallback) => {
  notifications.show({
    title: 'Something went wrong',
    message: err instanceof ApiError ? err.message : fallback,
    color: 'red',
  })
}

const notifySuccess = (message) => notifications.show({ title: 'Done', message, color: 'green' })

/** Full catalog CRUD for the librarian: filters, bulk ops, and per-book actions. */
export const ManagePublishedBooks = () => {
  const [books, setBooks] = useState([])
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'APPROVED', source: 'ALL', genre: '', author: '', query: '' })
  const [selectedIds, setSelectedIds] = useState([])

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('ADD')
  const [formBook, setFormBook] = useState(null)

  const [historyBook, setHistoryBook] = useState(null)
  const [deleteBook, setDeleteBook] = useState(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  const loadAuthors = async () => {
    try {
      const res = await librarianService.getAllUsers({ role: 'AUTHOR', active: true })
      setAuthors(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAuthors([])
    }
  }

  const loadBooks = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.status !== 'ALL') params.status = filters.status
      if (filters.source !== 'ALL') params.source = filters.source
      if (filters.genre.trim()) params.genre = filters.genre.trim()
      if (filters.author.trim()) params.author = filters.author.trim()
      if (filters.query.trim()) params.query = filters.query.trim()
      const res = await bookService.getManageBooks(params)
      setBooks(Array.isArray(res.data) ? res.data : [])
      setSelectedIds([])
    } catch (err) {
      notifyError(err, 'Failed to load books.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuthors()
  }, [])

  useEffect(() => {
    loadBooks()
  }, [filters.status, filters.source, filters.genre, filters.author, filters.query])

  const filteredBooks = useMemo(() => books, [books])

  const openAdd = () => {
    setFormMode('ADD')
    setFormBook(null)
    setFormOpen(true)
  }

  const openEdit = (book) => {
    setFormMode('EDIT')
    setFormBook(book)
    setFormOpen(true)
  }

  const handleSaved = async () => {
    setFormOpen(false)
    await loadBooks()
  }

  const handleDelete = async () => {
    if (!deleteBook) return
    setBulkLoading(true)
    try {
      await bookService.deleteLibrarianBook(deleteBook.id)
      notifySuccess('Book deleted successfully.')
      setDeleteBook(null)
      await loadBooks()
    } catch (err) {
      notifyError(err, 'Failed to delete book.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    setBulkLoading(true)
    try {
      await bookService.bulkDeleteBooks(selectedIds)
      notifySuccess('Bulk delete completed.')
      setBulkDeleteOpen(false)
      setSelectedIds([])
      await loadBooks()
    } catch (err) {
      notifyError(err, 'Bulk delete failed.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkEdit = async (payload) => {
    setBulkLoading(true)
    try {
      await bookService.bulkUpdateBooks({ bookIds: selectedIds, ...payload })
      notifySuccess('Bulk update completed.')
      setBulkEditOpen(false)
      setSelectedIds([])
      await loadBooks()
    } catch (err) {
      notifyError(err, 'Bulk update failed.')
    } finally {
      setBulkLoading(false)
    }
  }

  const columns = [
    { key: 'title', label: 'Title', render: (b) => <Text fw={600} size="sm">{b.title}</Text> },
    { key: 'author', label: 'Author', render: (b) => b.author || 'Unknown' },
    { key: 'genre', label: 'Genre', render: (b) => b.genre || 'Uncategorized' },
    { key: 'status', label: 'Status', render: (b) => <Badge color={statusColor(b.status)}>{b.status}</Badge> },
    { key: 'source', label: 'Source', render: (b) => <Badge color="gray">{b.source || 'AUTHOR_SUBMISSION'}</Badge> },
    { key: 'quantity', label: 'Quantity' },
    {
      key: 'actions',
      label: 'Actions',
      render: (b) => (
        <Group gap={4} wrap="nowrap">
          <Button size="xs" variant="default" onClick={() => openEdit(b)}>Edit</Button>
          <Button size="xs" variant="default" onClick={() => setHistoryBook(b)}>History</Button>
          <Button size="xs" color="red" variant="light" onClick={() => setDeleteBook(b)}>Delete</Button>
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <PageHeader
        title="Manage published books"
        description="Add, edit, or remove books across the entire catalog."
        actions={(
          <Group gap="xs">
            <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.5} />} onClick={loadBooks}>
              Refresh
            </Button>
            <Button leftSection={<IconPlus size={16} stroke={1.5} />} onClick={openAdd}>Add book</Button>
          </Group>
        )}
      />

      <SearchToolbar
        value={filters.query}
        onChange={(value) => setFilters((prev) => ({ ...prev, query: value }))}
        placeholder="Search title, author, genre"
      >
        <Select
          value={filters.status}
          onChange={(value) => setFilters((prev) => ({ ...prev, status: value || 'ALL' }))}
          data={[{ value: 'ALL', label: 'All Status' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
          allowDeselect={false}
          w={140}
        />
        <Select
          value={filters.source}
          onChange={(value) => setFilters((prev) => ({ ...prev, source: value || 'ALL' }))}
          data={SOURCE_OPTIONS}
          allowDeselect={false}
          w={170}
        />
        <TextInput
          value={filters.genre}
          onChange={(e) => setFilters((prev) => ({ ...prev, genre: e.currentTarget.value }))}
          placeholder="Filter by genre"
          w={160}
        />
        <TextInput
          value={filters.author}
          onChange={(e) => setFilters((prev) => ({ ...prev, author: e.currentTarget.value }))}
          placeholder="Filter by author"
          w={160}
        />
      </SearchToolbar>

      {selectedIds.length > 0 ? (
        <Group gap="xs">
          <Text size="sm" c="dimmed">{selectedIds.length} selected</Text>
          <Button size="xs" variant="default" onClick={() => setBulkEditOpen(true)}>Bulk edit</Button>
          <Button size="xs" color="red" variant="light" onClick={() => setBulkDeleteOpen(true)}>Bulk delete</Button>
        </Group>
      ) : null}

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : filteredBooks.length === 0 ? (
        <EmptyState title="No books found" description="Try a different search or filter combination." />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredBooks}
          selection={{ selected: selectedIds, onChange: setSelectedIds }}
          emptyLabel="No books found."
        />
      )}

      <BookFormModal
        opened={formOpen}
        mode={formMode}
        book={formBook}
        authors={authors}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <BookHistoryModal opened={!!historyBook} book={historyBook} onClose={() => setHistoryBook(null)} />

      <ConfirmModal
        opened={!!deleteBook}
        onClose={() => setDeleteBook(null)}
        onConfirm={handleDelete}
        loading={bulkLoading}
        danger
        title="Delete book"
        confirmLabel="Delete"
        message={`Delete "${deleteBook?.title}"? This cannot be undone.`}
      />

      <BulkEditBooksModal
        opened={bulkEditOpen}
        count={selectedIds.length}
        loading={bulkLoading}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={handleBulkEdit}
      />

      <BulkDeleteBooksModal
        opened={bulkDeleteOpen}
        count={selectedIds.length}
        loading={bulkLoading}
        onClose={() => setBulkDeleteOpen(false)}
        onSubmit={handleBulkDelete}
      />
    </Stack>
  )
}

export default ManagePublishedBooks
