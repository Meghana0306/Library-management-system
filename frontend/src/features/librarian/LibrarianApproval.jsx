import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Select,
  Skeleton,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconDownload, IconEye, IconInfoCircle, IconX } from '@tabler/icons-react'
import { bookService } from '../../services'
import { ApiError } from '../../services/api'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { StatCard } from '../../components/common/StatCard.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { PDFPreviewModal } from '../../components/common/PDFPreviewModal.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { statusColor } from '../../theme.js'
import { downloadBookFile } from './downloadFile.js'

const notifyError = (err, fallback) => {
  notifications.show({
    title: 'Something went wrong',
    message: err instanceof ApiError ? err.message : fallback,
    color: 'red',
  })
}

/**
 * Split-pane submission review: pending books on the left with bulk
 * approve/reject, the approved library on the right for quick reference.
 */
export const LibrarianApproval = () => {
  const [pendingBooks, setPendingBooks] = useState([])
  const [approvedBooks, setApprovedBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [submittedDate, setSubmittedDate] = useState(null)
  const [previewBook, setPreviewBook] = useState(null)
  const [detailBook, setDetailBook] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { bookIds, approved }
  const [rejectionReason, setRejectionReason] = useState('')
  const [approveQuantity, setApproveQuantity] = useState(1)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [pendingRes, allRes] = await Promise.all([
        bookService.getPendingBooks(),
        bookService.getAllBooks(),
      ])
      const pending = Array.isArray(pendingRes.data) ? pendingRes.data : []
      const approved = (Array.isArray(allRes.data) ? allRes.data : [])
        .filter((book) => book.status === 'APPROVED')
        .sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0))
      setPendingBooks(pending)
      setApprovedBooks(approved)
      setSelectedIds((prev) => prev.filter((id) => pending.some((book) => book.id === id)))
    } catch (err) {
      notifyError(err, 'Failed to load submission data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredPending = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return pendingBooks.filter((book) => {
      const matchesKeyword = !keyword
        || (book.title || '').toLowerCase().includes(keyword)
        || (book.authorFullName || '').toLowerCase().includes(keyword)
        || (book.authorUsername || '').toLowerCase().includes(keyword)
        || (book.genre || '').toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'ALL' || (book.status || '').toUpperCase() === statusFilter
      const matchesDate = !submittedDate
        || new Date(book.submittedDate).toDateString() === submittedDate.toDateString()
      return matchesKeyword && matchesStatus && matchesDate
    })
  }, [pendingBooks, searchText, statusFilter, submittedDate])

  const openApprove = (bookIds) => {
    setApproveQuantity(1)
    setConfirmAction({ bookIds, approved: true })
  }

  const openReject = (bookIds) => {
    setRejectionReason('')
    setConfirmAction({ bookIds, approved: false })
  }

  const runAction = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      const results = await Promise.allSettled(
        confirmAction.bookIds.map((bookId) => bookService.approveBook({
          bookId,
          approved: confirmAction.approved,
          rejectionReason: confirmAction.approved ? null : rejectionReason.trim(),
          ...(confirmAction.approved ? { quantity: approveQuantity } : {}),
        })),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      const verb = confirmAction.approved ? 'approved' : 'rejected'
      if (failed === 0) {
        notifications.show({
          title: 'Done',
          message: `${succeeded} submission${succeeded === 1 ? '' : 's'} ${verb} successfully.`,
          color: 'green',
        })
      } else {
        notifications.show({
          title: 'Partial success',
          message: `${succeeded} updated, ${failed} failed. Please retry the rest.`,
          color: 'orange',
        })
      }
      setConfirmAction(null)
      setSelectedIds([])
      await loadData()
    } catch (err) {
      notifyError(err, 'Failed to update submission status.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownload = async (book) => {
    try {
      await downloadBookFile(book.filePath, book.title)
    } catch (err) {
      notifyError(err, 'Failed to download the file.')
    }
  }

  const pendingColumns = [
    {
      key: 'title',
      label: 'Book',
      render: (book) => (
        <Stack gap={2}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm">{book.title}</Text>
            <Badge color={statusColor(book.status)} size="sm">{book.status}</Badge>
          </Group>
          <Text size="xs" c="dimmed">{book.authorFullName} ({book.authorUsername})</Text>
        </Stack>
      ),
    },
    { key: 'genre', label: 'Genre', render: (book) => book.genre || 'Uncategorized' },
    {
      key: 'submittedDate',
      label: 'Submitted',
      render: (book) => (book.submittedDate ? new Date(book.submittedDate).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (book) => (
        <Group gap={4} wrap="nowrap">
          <Button size="xs" variant="default" leftSection={<IconEye size={14} stroke={1.5} />}
            disabled={!book.filePath} onClick={() => setPreviewBook(book)}>
            Preview
          </Button>
          <Button size="xs" variant="default" leftSection={<IconDownload size={14} stroke={1.5} />}
            disabled={!book.filePath} onClick={() => handleDownload(book)}>
            Download
          </Button>
          <Button size="xs" color="green" leftSection={<IconCheck size={14} stroke={1.5} />}
            onClick={() => openApprove([book.id])}>
            Approve
          </Button>
          <Button size="xs" color="red" variant="light" leftSection={<IconX size={14} stroke={1.5} />}
            onClick={() => openReject([book.id])}>
            Reject
          </Button>
          <Button size="xs" variant="subtle" leftSection={<IconInfoCircle size={14} stroke={1.5} />}
            onClick={() => setDetailBook(book)}>
            Details
          </Button>
        </Group>
      ),
    },
  ]

  const approvedColumns = [
    { key: 'title', label: 'Title', render: (book) => <Text fw={600} size="sm">{book.title}</Text> },
    { key: 'author', label: 'Author', render: (book) => book.author || 'Unknown' },
    { key: 'genre', label: 'Genre', render: (book) => book.genre || 'Uncategorized' },
    {
      key: 'actions',
      label: 'Actions',
      render: (book) => (
        <Group gap={4} wrap="nowrap">
          <Button size="xs" variant="default" disabled={!book.filePath} onClick={() => setPreviewBook(book)}>
            Preview
          </Button>
          <Button size="xs" variant="default" disabled={!book.filePath} onClick={() => handleDownload(book)}>
            Download
          </Button>
          <Button size="xs" variant="subtle" onClick={() => setDetailBook(book)}>Details</Button>
        </Group>
      ),
    },
  ]

  const confirmCount = confirmAction?.bookIds?.length || 0

  return (
    <Stack gap="md">
      <PageHeader
        title="Submission review queue"
        description="Approve or reject books submitted by authors, then browse the live library on the right."
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard label="Pending" value={pendingBooks.length} loading={loading} />
        <StatCard label="Selected" value={selectedIds.length} />
        <StatCard label="Approved" value={approvedBooks.length} loading={loading} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">Pending submissions</Text>
          <SearchToolbar value={searchText} onChange={setSearchText} placeholder="Search title, author, genre">
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'ALL')}
              data={[{ value: 'ALL', label: 'All Status' }, { value: 'PENDING', label: 'Pending' }]}
              allowDeselect={false}
              w={140}
            />
            <DateInput
              value={submittedDate}
              onChange={setSubmittedDate}
              placeholder="Submitted date"
              clearable
              w={160}
            />
          </SearchToolbar>

          {selectedIds.length > 0 ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed">{selectedIds.length} selected</Text>
              <Button size="xs" color="green" onClick={() => openApprove(selectedIds)}>Approve selected</Button>
              <Button size="xs" color="red" variant="light" onClick={() => openReject(selectedIds)}>
                Reject selected
              </Button>
            </Group>
          ) : null}

          {loading ? <Skeleton height={280} radius="sm" /> : filteredPending.length === 0 ? (
            <EmptyState title="No books pending approval" description="New author submissions will appear here." />
          ) : (
            <DataTable
              columns={pendingColumns}
              rows={filteredPending}
              selection={{ selected: selectedIds, onChange: setSelectedIds }}
              emptyLabel="No books pending approval"
            />
          )}
        </Stack>

        <Stack gap="xs">
          <Text fw={600} size="sm">Approved library</Text>
          {loading ? <Skeleton height={280} radius="sm" /> : approvedBooks.length === 0 ? (
            <EmptyState title="No approved books available" description="Approved titles will be listed here." />
          ) : (
            <DataTable columns={approvedColumns} rows={approvedBooks} emptyLabel="No approved books available" />
          )}
        </Stack>
      </SimpleGrid>

      <PDFPreviewModal
        isOpen={!!previewBook}
        onClose={() => setPreviewBook(null)}
        filePath={previewBook?.filePath}
        bookTitle={previewBook?.title}
      />

      <Modal opened={!!detailBook} onClose={() => setDetailBook(null)} title={detailBook?.title || 'Book details'} size="md">
        {detailBook ? (
          <Stack gap="xs">
            <Text size="sm"><b>Author:</b> {detailBook.author || detailBook.authorFullName || 'Unknown'}</Text>
            <Text size="sm"><b>Genre:</b> {detailBook.genre || 'Uncategorized'}</Text>
            <Text size="sm">
              <b>Published:</b>{' '}
              {detailBook.publishedDate ? new Date(detailBook.publishedDate).toLocaleDateString() : 'N/A'}
            </Text>
            <Text size="sm">{detailBook.description || 'No description provided.'}</Text>
            <Group justify="flex-end">
              <Button
                variant="default"
                disabled={!detailBook.filePath}
                onClick={() => { setPreviewBook(detailBook); setDetailBook(null) }}
              >
                Preview PDF
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <ConfirmModal
        opened={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runAction}
        loading={actionLoading}
        danger={confirmAction ? !confirmAction.approved : false}
        title={confirmAction?.approved ? 'Confirm approval' : 'Confirm rejection'}
        confirmLabel={actionLoading ? 'Processing…' : confirmAction?.approved ? 'Approve' : 'Reject'}
        message={`You are about to ${confirmAction?.approved ? 'approve' : 'reject'} ${confirmCount} submission${confirmCount === 1 ? '' : 's'}.`}
      >
        {confirmAction?.approved ? (
          <NumberInput
            label="Quantity"
            description="Copies added to the catalog for each approved title"
            min={0}
            value={approveQuantity}
            onChange={(value) => setApproveQuantity(typeof value === 'number' ? value : 1)}
            mt="sm"
          />
        ) : (
          <Textarea
            label="Rejection reason (optional)"
            placeholder="Provide feedback to the author"
            maxLength={500}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.currentTarget.value)}
            mt="sm"
            autosize
            minRows={3}
          />
        )}
      </ConfirmModal>
    </Stack>
  )
}

export default LibrarianApproval
