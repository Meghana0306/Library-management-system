import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Group, Select, Skeleton, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBookmark } from '@tabler/icons-react'
import { coverPath } from '../../services/api'
import { borrowService } from '../../services'
import { AuthImage } from '../../components/common/AuthImage.jsx'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { formatDateTime, getDueDate } from '../../utils/helpers'
import { statusColor } from '../../theme.js'
import { ReaderModal } from './components/ReaderModal.jsx'
import { BookReviewModal } from './BookReviewModal.jsx'
import { isExpired, useBookReader } from './hooks/useBookReader.js'

const getDaysUntilDue = (record) => {
  const dueDate = getDueDate(record)
  if (!dueDate) return null
  return Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export const BorrowedBooksPanel = ({ userId, restoreRecordId, onReaderRecordChange }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('BORROWED')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkReturning, setBulkReturning] = useState(false)
  const [confirmBulkReturn, setConfirmBulkReturn] = useState(false)
  const [reviewRecord, setReviewRecord] = useState(null)
  const restoreOnceIdRef = useRef(restoreRecordId)

  const loadRecords = useCallback(async (showRefreshed = false) => {
    if (!userId) return
    try {
      setLoading(true)
      try {
        await borrowService.autoReturnExpiredBooks(userId)
      } catch {
        // Non-blocking: borrowed history should still load even if auto-return check fails.
      }
      const response = await borrowService.getUserActiveBorrowings(userId)
      setRecords(Array.isArray(response.data) ? response.data : [])
      if (showRefreshed) notifications.show({ color: 'green', message: 'Borrowed records refreshed.' })
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load borrowed books' })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadRecords() }, [loadRecords])

  const handleExpired = useCallback(() => {
    loadRecords(true)
    notifications.show({ color: 'red', message: 'Reading closed automatically because the borrowing period expired.' })
  }, [loadRecords])

  const reader = useBookReader({ userId, onReaderRecordChange, onExpired: handleExpired })

  useEffect(() => {
    if (loading || !restoreOnceIdRef.current || records.length === 0) return
    const record = records.find((r) => r.id === restoreOnceIdRef.current)
    if (!record) return
    restoreOnceIdRef.current = null
    reader.openReader(record)
    // eslint-disable-next-line no-use-before-define
  }, [loading, records])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return records
      .filter((r) => status === 'ALL' || (r.status || '').toUpperCase() === status)
      .filter((r) => {
        if (!keyword) return true
        const title = r.book?.title || ''
        const author = r.book?.author || ''
        const genre = r.book?.genre || ''
        return title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword) || genre.toLowerCase().includes(keyword)
      })
      .sort((a, b) => new Date(b.borrowedDate || 0) - new Date(a.borrowedDate || 0))
  }, [records, query, status])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((r) => r.id === id)))
  }, [filtered])

  const handleReturnBook = async (record) => {
    try {
      await borrowService.returnBook(record.id)
      if (reader.readerRecord?.id === record.id) reader.closeReader()
      setSelectedIds((prev) => prev.filter((id) => id !== record.id))
      notifications.show({ color: 'green', message: `Returned "${record.book?.title || 'book'}" successfully.` })
      await loadRecords()
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to return book' })
    }
  }

  const handleReturnSelected = async () => {
    setConfirmBulkReturn(false)
    setBulkReturning(true)
    try {
      const res = await borrowService.returnBooksInBulk(selectedIds)
      const data = res.data
      const closedIds = (data.returned || []).map((r) => r.recordId)
      if (reader.readerRecord && closedIds.includes(reader.readerRecord.id)) reader.closeReader()
      setSelectedIds([])
      const alreadyReturned = data.alreadyReturnedCount || 0
      notifications.show({
        color: 'green',
        message: `Returned ${data.returnedCount || 0} book(s) successfully.${alreadyReturned ? ` ${alreadyReturned} were already returned.` : ''}`,
      })
      if (data.errors?.length) notifications.show({ color: 'orange', message: data.errors.join('; ') })
      await loadRecords()
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to return selected books' })
    } finally {
      setBulkReturning(false)
    }
  }

  const columns = [
    {
      key: 'book',
      label: 'Book',
      render: (record) => (
        <Group gap="sm" wrap="nowrap">
          <AuthImage path={record.book?.id ? coverPath(record.book.id) : null} kind="cover" name={record.book?.title} width={36} height={48} />
          <Stack gap={0}>
            <Text size="sm" fw={600}>{record.book?.title || 'Untitled book'}</Text>
            <Text size="xs" c="dimmed">{record.book?.author || '-'} · {record.book?.genre || '-'}</Text>
          </Stack>
        </Group>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (record) => {
        const daysLeft = getDaysUntilDue(record)
        const expired = isExpired(record)
        const isBorrowed = (record.status || '').toUpperCase() === 'BORROWED'
        const overdue = isBorrowed && daysLeft !== null && daysLeft < 0
        const dueSoon = isBorrowed && !expired && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0
        return (
          <Stack gap={2}>
            <Badge color={statusColor(record.status)}>{record.status || '-'}</Badge>
            {expired ? <Text size="xs" c="red">Expired — will be auto-returned.</Text> : null}
            {!expired && overdue ? <Text size="xs" c="red">Overdue! Please return it immediately.</Text> : null}
            {!expired && dueSoon ? (
              <Text size="xs" c="orange">{daysLeft === 0 ? 'Due today!' : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}</Text>
            ) : null}
          </Stack>
        )
      },
    },
    { key: 'borrowedDate', label: 'Borrowed', render: (record) => formatDateTime(record.borrowedDate) },
    { key: 'dueDate', label: 'Due', render: (record) => { const d = getDueDate(record); return d ? d.toLocaleDateString() : '-' } },
    {
      key: 'actions',
      label: 'Actions',
      render: (record) => {
        const isBorrowed = (record.status || '').toUpperCase() === 'BORROWED'
        const expired = isExpired(record)
        return (
          <Group gap="xs" wrap="nowrap">
            <Button size="compact-xs" variant="default" disabled={!isBorrowed || expired} onClick={() => reader.openReader(record)}>Read Book</Button>
            <Button size="compact-xs" disabled={!isBorrowed} onClick={() => handleReturnBook(record)}>Return</Button>
            <Button size="compact-xs" variant="subtle" onClick={() => setReviewRecord(record)}>Write a Review</Button>
          </Group>
        )
      },
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Borrowed Books</Title>
        <Text size="sm" c="dimmed">Active: {records.length}</Text>
      </Group>

      <SearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Search borrowed books by title, author, or genre"
        actions={(
          <>
            <Button variant="default" onClick={() => loadRecords(true)} loading={loading}>Refresh</Button>
            {selectedIds.length > 0 ? (
              <Button color="red" onClick={() => setConfirmBulkReturn(true)} loading={bulkReturning}>
                Return Selected ({selectedIds.length})
              </Button>
            ) : null}
          </>
        )}
      >
        <Select
          label="Status"
          value={status}
          onChange={(value) => setStatus(value || 'ALL')}
          data={[{ value: 'ALL', label: 'All Active' }, { value: 'BORROWED', label: 'Borrowed' }]}
          w={160}
          allowDeselect={false}
        />
      </SearchToolbar>

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconBookmark} title="No borrowed books found" />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          selection={{ selected: selectedIds, onChange: setSelectedIds }}
          emptyLabel="No borrowed books found."
        />
      )}

      <ConfirmModal
        opened={confirmBulkReturn}
        onClose={() => setConfirmBulkReturn(false)}
        onConfirm={handleReturnSelected}
        title="Return selected books?"
        message={`Return ${selectedIds.length} selected book(s)?`}
        confirmLabel="Return"
        loading={bulkReturning}
      />

      {reader.readerRecord ? (
        <ReaderModal
          record={reader.readerRecord}
          url={reader.readerUrl}
          loading={reader.readerLoading}
          error={reader.readerError}
          bookmarks={reader.bookmarks}
          bookmarkLabel={reader.bookmarkLabel}
          onBookmarkLabelChange={reader.setBookmarkLabel}
          onAddBookmark={reader.handleAddBookmark}
          onScrollToBookmark={reader.handleScrollToBookmark}
          onRemoveBookmark={reader.handleRemoveBookmark}
          highlights={reader.highlights}
          highlightQuery={reader.highlightQuery}
          onHighlightQueryChange={reader.setHighlightQuery}
          onAddHighlight={reader.handleAddHighlight}
          onScrollToHighlight={reader.handleScrollToHighlight}
          onRemoveHighlight={reader.handleRemoveHighlight}
          onScrollRefReady={reader.onScrollRefReady}
          onDocumentLoad={reader.onDocumentLoad}
          lastSavedAt={reader.lastSavedAt}
          onClose={reader.closeReaderWithProgress}
        />
      ) : null}

      {reviewRecord ? (
        <BookReviewModal
          bookId={reviewRecord.book?.id}
          bookTitle={reviewRecord.book?.title || 'Book'}
          userId={userId}
          existingReview={null}
          onClose={() => setReviewRecord(null)}
          onSaved={() => setReviewRecord(null)}
        />
      ) : null}
    </Stack>
  )
}

export default BorrowedBooksPanel
