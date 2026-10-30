import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Checkbox, Group, Select, Skeleton, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconRefresh } from '@tabler/icons-react'
import { borrowService } from '../../services'
import { ApiError } from '../../services/api'
import { formatDateTime, getDueDate } from '../../utils/helpers'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { statusColor } from '../../theme.js'
import { downloadCsv } from './downloadFile.js'

const isOverdue = (record) => {
  if ((record?.status || '').toUpperCase() !== 'BORROWED') return false
  const dueDate = getDueDate(record)
  return !!dueDate && Date.now() > dueDate.getTime()
}

const isActiveBorrowing = (record) => (record?.status || '').toUpperCase() === 'BORROWED' && !isOverdue(record)

/** Read-only borrowing ledger across every user, with overdue computation and CSV export. */
export const BorrowedBooksRecord = () => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const response = await borrowService.getAllBorrowingRecords()
      setRecords(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      notifications.show({
        title: 'Something went wrong',
        message: err instanceof ApiError ? err.message : 'Failed to load borrowing records.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return records
      .filter((record) => {
        if (status === 'ALL') return true
        if (status === 'ACTIVE') return isActiveBorrowing(record)
        if (status === 'OVERDUE') return isOverdue(record)
        return (record.status || '').toUpperCase() === status
      })
      .filter((record) => {
        if (!keyword) return true
        return (record.book?.title || '').toLowerCase().includes(keyword)
          || (record.user?.username || '').toLowerCase().includes(keyword)
      })
      .filter((record) => (overdueOnly ? isOverdue(record) : true))
      .sort((a, b) => new Date(b.borrowedDate || 0) - new Date(a.borrowedDate || 0))
  }, [records, query, status, overdueOnly])

  const exportCsv = () => {
    downloadCsv([
      ['Book Title', 'Borrower Username', 'Borrow Date', 'Due Date', 'Return Date', 'Status', 'Overdue'],
      ...filtered.map((record) => [
        record.book?.title || '-',
        record.user?.username || '-',
        formatDateTime(record.borrowedDate),
        formatDateTime(getDueDate(record)),
        formatDateTime(record.returnDate),
        record.status || '-',
        isOverdue(record) ? 'YES' : 'NO',
      ]),
    ], 'borrowed-books-records.csv')
  }

  const columns = [
    { key: 'bookTitle', label: 'Book Title', render: (r) => r.book?.title || '-' },
    { key: 'username', label: 'Borrower Username', render: (r) => r.user?.username || '-' },
    { key: 'borrowedDate', label: 'Borrow Date', render: (r) => formatDateTime(r.borrowedDate) },
    { key: 'dueDate', label: 'Due Date', render: (r) => formatDateTime(getDueDate(r)) },
    { key: 'returnDate', label: 'Return Date', render: (r) => formatDateTime(r.returnDate) },
    { key: 'status', label: 'Status', render: (r) => <Badge color={statusColor(r.status)}>{r.status || '-'}</Badge> },
    {
      key: 'overdue',
      label: 'Overdue',
      render: (r) => <Badge color={isOverdue(r) ? 'red' : 'gray'}>{isOverdue(r) ? 'Yes' : 'No'}</Badge>,
    },
  ]

  return (
    <Stack gap="md">
      <PageHeader
        title="Borrowed books record"
        description="Track borrowing activity across all users."
        actions={(
          <Group gap="xs">
            <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.5} />} onClick={loadRecords}>
              Refresh
            </Button>
            <Button leftSection={<IconDownload size={16} stroke={1.5} />} onClick={exportCsv}>
              Export CSV
            </Button>
          </Group>
        )}
      />

      <SearchToolbar value={query} onChange={setQuery} placeholder="Search by book title or borrower username">
        <Select
          value={status}
          onChange={(value) => setStatus(value || 'ALL')}
          data={[
            { value: 'ALL', label: 'All Status' },
            { value: 'ACTIVE', label: 'Active Borrowings' },
            { value: 'OVERDUE', label: 'Overdue Borrowings' },
            { value: 'RETURNED', label: 'Returned' },
          ]}
          allowDeselect={false}
          w={190}
        />
        <Checkbox
          label="Overdue only"
          checked={overdueOnly}
          onChange={(e) => setOverdueOnly(e.currentTarget.checked)}
        />
      </SearchToolbar>

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No borrowing records found" />
      ) : (
        <DataTable columns={columns} rows={filtered} emptyLabel="No borrowing records found" />
      )}
    </Stack>
  )
}

export default BorrowedBooksRecord
