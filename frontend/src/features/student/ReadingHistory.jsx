import { useEffect, useState } from 'react'
import { Badge, Button, Group, Progress, Select, Skeleton, SimpleGrid, Stack, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconHistory } from '@tabler/icons-react'
import { readingHistoryService } from '../../services'
import { DataTable } from '../../components/common/DataTable.jsx'
import { StatCard } from '../../components/common/StatCard.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { PREDEFINED_GENRES } from '../../utils/constants'
import { statusColor } from '../../theme.js'
import { ReadingInsights } from './components/ReadingInsights.jsx'
import { ReadingAchievements } from './components/ReadingAchievements.jsx'
import { getLastBookmark } from './utils/readerStorage.js'
import { exportReadingHistoryCSV, exportReadingHistoryPDF } from './utils/readingHistoryExport.js'

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const ReadingHistory = ({ userId }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('list')

  const [searchTerm, setSearchTerm] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadHistory = async (overrideParams) => {
    if (!userId) return
    setLoading(true)
    try {
      let params
      if (overrideParams !== undefined) {
        params = overrideParams
      } else {
        params = {}
        if (startDate) params.startDate = `${startDate}T00:00:00`
        if (endDate) params.endDate = `${endDate}T23:59:59`
        if (authorFilter.trim()) params.author = authorFilter.trim()
        if (genreFilter) params.genre = genreFilter
      }
      const res = await readingHistoryService.getReadingHistory(userId, params)
      setHistory(Array.isArray(res.data.history) ? res.data.history : [])
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load reading history.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [userId])

  const handleClearFilters = () => {
    setSearchTerm('')
    setGenreFilter('')
    setAuthorFilter('')
    setStartDate('')
    setEndDate('')
    setStatusFilter('all')
    loadHistory({})
  }

  const filteredHistory = history.filter((item) => {
    const keyword = searchTerm.trim().toLowerCase()
    if (keyword) {
      const title = (item.bookTitle || '').toLowerCase()
      const author = (item.author || '').toLowerCase()
      if (!title.includes(keyword) && !author.includes(keyword)) return false
    }
    if (statusFilter !== 'all' && (item.status || '').toUpperCase() !== statusFilter) return false
    return true
  })

  const totalBooksRead = history.filter((r) => (r.status || '').toUpperCase() === 'RETURNED').length
  const activeBorrowings = history.filter((r) => (r.status || '').toUpperCase() === 'BORROWED').length
  const avgDuration = totalBooksRead > 0
    ? Math.round(history.filter((r) => (r.status || '').toUpperCase() === 'RETURNED')
      .reduce((sum, r) => sum + (r.readingDurationDays || 0), 0) / totalBooksRead)
    : 0

  const columns = [
    { key: 'bookTitle', label: 'Book Title', render: (item) => item.bookTitle || '—' },
    { key: 'author', label: 'Author', render: (item) => item.author || '—' },
    { key: 'genre', label: 'Genre', render: (item) => item.genre || '—' },
    { key: 'borrowedDate', label: 'Borrow Date', render: (item) => formatDate(item.borrowedDate) },
    { key: 'returnDate', label: 'Return Date', render: (item) => formatDate(item.returnDate) },
    { key: 'readingDurationDays', label: 'Duration', render: (item) => (item.readingDurationDays != null ? `${item.readingDurationDays}d` : '—') },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <Badge color={statusColor(item.status)}>{(item.status || '').toUpperCase() === 'RETURNED' ? 'Returned' : 'Active'}</Badge>,
    },
    {
      key: 'readingProgress',
      label: 'Progress',
      render: (item) => (
        <Group gap={6} wrap="nowrap" w={90}>
          <Progress value={Math.max(0, Math.min(100, Number(item.readingProgress) || 0))} size="sm" style={{ flex: 1 }} />
          <Text size="xs" c="dimmed">{Math.max(0, Math.min(100, Number(item.readingProgress) || 0))}%</Text>
        </Group>
      ),
    },
    {
      key: 'bookmark',
      label: 'Bookmark',
      render: (item) => {
        const lastBookmark = getLastBookmark(userId, item.recordId)
        return lastBookmark ? <Text size="xs">p.{lastBookmark.page}</Text> : <Text size="xs" c="dimmed">—</Text>
      },
    },
  ]

  return (
    <Stack gap="lg">
      <Title order={3}>Reading History</Title>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard label="Total Borrowed" value={history.length} />
        <StatCard label="Books Returned" value={totalBooksRead} />
        <StatCard label="Currently Active" value={activeBorrowings} />
        <StatCard label="Avg. Reading Time" value={`${avgDuration}d`} />
      </SimpleGrid>

      <Tabs value={section} onChange={setSection}>
        <Tabs.List>
          <Tabs.Tab value="list">History</Tabs.Tab>
          <Tabs.Tab value="insights">Insights</Tabs.Tab>
          <Tabs.Tab value="achievements">Achievements</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list" pt="md">
          <Stack gap="md">
            <Stack gap="sm" component="form" onSubmit={(e) => { e.preventDefault(); loadHistory() }}>
              <Group gap="sm" wrap="wrap">
                <TextInput label="Search" placeholder="Title or author..." value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} w={200} />
                <TextInput label="Author" placeholder="Filter by author..." value={authorFilter} onChange={(e) => setAuthorFilter(e.currentTarget.value)} w={180} />
                <Select
                  label="Genre"
                  value={genreFilter || null}
                  onChange={(value) => setGenreFilter(value || '')}
                  data={PREDEFINED_GENRES.map((g) => ({ value: g, label: g }))}
                  placeholder="All Genres"
                  clearable
                  w={180}
                />
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value || 'all')}
                  data={[{ value: 'all', label: 'All' }, { value: 'RETURNED', label: 'Returned' }, { value: 'BORROWED', label: 'Active' }]}
                  w={140}
                  allowDeselect={false}
                />
              </Group>
              <Group gap="sm" wrap="wrap" align="flex-end">
                <TextInput label="Borrow Date From" type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} w={160} />
                <TextInput label="Borrow Date To" type="date" value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} w={160} />
                <Button type="submit">Apply Filters</Button>
                <Button variant="default" onClick={handleClearFilters}>Clear</Button>
              </Group>
            </Stack>

            {filteredHistory.length > 0 ? (
              <Group gap="xs">
                <Text size="sm" c="dimmed">Export:</Text>
                <Button variant="default" size="xs" onClick={() => exportReadingHistoryCSV(filteredHistory)}>CSV</Button>
                <Button variant="default" size="xs" onClick={() => exportReadingHistoryPDF(filteredHistory)}>PDF</Button>
              </Group>
            ) : null}

            {loading ? (
              <Skeleton height={280} radius="sm" />
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                icon={IconHistory}
                title="No reading history"
                description={history.length === 0 ? 'No borrowing history yet. Start reading!' : 'No records match your filters.'}
              />
            ) : (
              <>
                <Text size="xs" c="dimmed">Showing {filteredHistory.length} of {history.length} records</Text>
                <DataTable columns={columns} rows={filteredHistory} rowKey="recordId" emptyLabel="No borrowing history yet." />
              </>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="insights" pt="md">
          {history.length === 0 ? (
            <EmptyState icon={IconHistory} title="No data yet" description="Borrow some books to see insights!" />
          ) : (
            <ReadingInsights history={history} />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="achievements" pt="md">
          <ReadingAchievements history={history} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

export default ReadingHistory
