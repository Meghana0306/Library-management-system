import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import {
  IconAdjustments,
  IconAlertCircle,
  IconDownload,
  IconPrinter,
  IconStarFilled,
} from '@tabler/icons-react'
import { bookService } from '../../services'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { StatCard } from '../../components/common/StatCard.jsx'
import { downloadStatsCsv } from './authorStatsCsv.js'
import {
  BorrowTrendsChart,
  CountPerBookChart,
  PortfolioChart,
  RatingDistributionChart,
  RatingPerBookChart,
} from './AuthorStatsCharts.jsx'
import { formatRating, plural, truncate } from './authorUtils.js'
import classes from './authorStats.module.css'

const WIDGET_CONFIG = [
  { id: 'cards', label: 'Summary Cards' },
  { id: 'portfolio', label: 'Portfolio Breakdown' },
  { id: 'ratingDist', label: 'Rating Distribution' },
  { id: 'borrows', label: 'Borrows per Book' },
  { id: 'reads', label: 'Reads per Book' },
  { id: 'ratingPerBook', label: 'Avg Rating per Book' },
  { id: 'trends', label: 'Borrow Trends' },
  { id: 'table', label: 'Published Books Table' },
]

const DEFAULT_WIDGETS = Object.fromEntries(WIDGET_CONFIG.map((widget) => [widget.id, true]))

const widgetStorageKey = (authorId) => (authorId ? `author-stats-widgets-${authorId}` : '')

const loadWidgetPrefs = (authorId) => {
  const key = widgetStorageKey(authorId)
  if (!key) return { ...DEFAULT_WIDGETS }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...DEFAULT_WIDGETS }
    return { ...DEFAULT_WIDGETS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_WIDGETS }
  }
}

const approved = (books) => books.filter((book) => book.status === 'APPROVED')

/** Statistics tab: eight toggleable widgets over the author-stats endpoints. */
export const AuthorStats = ({ authorId }) => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [trendPeriod, setTrendPeriod] = useState('monthly')
  const [trendData, setTrendData] = useState([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState('')

  const [widgets, setWidgets] = useState(() => loadWidgetPrefs(authorId))
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!authorId) return
    setLoading(true)
    setError('')
    bookService.getAuthorStats(authorId)
      .then((response) => setStats(response.data))
      .catch(() => setError('Failed to load statistics. Please try again.'))
      .finally(() => setLoading(false))
  }, [authorId])

  useEffect(() => {
    if (!authorId || !stats) return
    setTrendLoading(true)
    setTrendError('')
    bookService.getAuthorStatsTrends(authorId, trendPeriod)
      .then((response) => setTrendData(Array.isArray(response.data) ? response.data : []))
      .catch(() => setTrendError('Failed to load trend data.'))
      .finally(() => setTrendLoading(false))
  }, [authorId, trendPeriod, stats])

  useEffect(() => {
    const key = widgetStorageKey(authorId)
    if (key) localStorage.setItem(key, JSON.stringify(widgets))
  }, [authorId, widgets])

  const derived = useMemo(() => {
    if (!stats) return null
    const { summary, books, ratingDistribution } = stats

    return {
      summary,
      books,
      portfolio: [
        { name: 'Published', value: summary.publishedBooks },
        { name: 'Pending', value: summary.pendingBooks },
        { name: 'Rejected', value: summary.rejectedBooks },
      ].filter((slice) => slice.value > 0),
      borrows: approved(books)
        .sort((a, b) => b.totalBorrows - a.totalBorrows)
        .map((book) => ({ name: truncate(book.title, 18), borrows: book.totalBorrows })),
      reads: approved(books)
        .sort((a, b) => (b.completedReads ?? 0) - (a.completedReads ?? 0))
        .map((book) => ({ name: truncate(book.title, 18), reads: book.completedReads ?? 0 })),
      ratings: Object.entries(ratingDistribution || {}).map(([star, count]) => ({
        name: `${star} star`,
        star,
        count,
      })),
      ratingPerBook: approved(books)
        .filter((book) => book.averageRating != null)
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 10)
        .map((book) => ({ name: truncate(book.title, 18), rating: Number(book.averageRating.toFixed(2)) })),
      tableRows: approved(books).sort((a, b) => b.totalBorrows - a.totalBorrows),
    }
  }, [stats])

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={280} radius="sm" />
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {WIDGET_CONFIG.map((widget) => <Skeleton key={widget.id} height={84} radius="sm" />)}
        </SimpleGrid>
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
        {error}
      </Alert>
    )
  }

  if (!derived) return null

  const { summary, portfolio, borrows, reads, ratings, ratingPerBook, tableRows } = derived
  const hasPublished = summary.publishedBooks > 0
  const hasBorrows = summary.totalBorrows > 0
  const hasReads = reads.some((entry) => entry.reads > 0)
  const hasReviews = summary.totalReviews > 0

  return (
    <Stack gap="md">
      <PageHeader
        title="Your Publishing Statistics"
        actions={(
          <Group gap="xs" className={classes.noPrint}>
            <Button
              variant={showSettings ? 'light' : 'default'}
              leftSection={<IconAdjustments size={16} stroke={1.5} />}
              onClick={() => setShowSettings((prev) => !prev)}
            >
              Customize
            </Button>
            <Button
              variant="default"
              leftSection={<IconDownload size={16} stroke={1.5} />}
              onClick={() => downloadStatsCsv(stats, trendData, trendPeriod, authorId)}
            >
              Export CSV
            </Button>
            <Button
              variant="default"
              leftSection={<IconPrinter size={16} stroke={1.5} />}
              onClick={() => window.print()}
            >
              Print / PDF
            </Button>
          </Group>
        )}
      />

      {showSettings ? (
        <Paper withBorder p="md" className={classes.noPrint}>
          <Text size="sm" fw={600} mb="xs">
            Toggle dashboard sections:
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            {WIDGET_CONFIG.map((widget) => (
              <Checkbox
                key={widget.id}
                label={widget.label}
                checked={Boolean(widgets[widget.id])}
                onChange={() => setWidgets((prev) => ({ ...prev, [widget.id]: !prev[widget.id] }))}
              />
            ))}
          </SimpleGrid>
        </Paper>
      ) : null}

      {widgets.cards ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Total Books" value={summary.totalBooks} />
          <StatCard label="Published" value={summary.publishedBooks} />
          <StatCard label="Pending Review" value={summary.pendingBooks} />
          <StatCard label="Rejected" value={summary.rejectedBooks} />
          <StatCard label="Total Borrows" value={summary.totalBorrows} />
          <StatCard label="Completed Reads" value={summary.totalCompletedReads ?? 0} hint="read to 100%" />
          <StatCard label="Total Reviews" value={summary.totalReviews} />
          <StatCard
            label="Avg Rating"
            value={summary.overallAverageRating != null ? `${formatRating(summary.overallAverageRating)} / 5` : 'N/A'}
            hint={hasReviews ? `${summary.totalReviews} ${plural(summary.totalReviews, 'review')}` : undefined}
          />
        </SimpleGrid>
      ) : null}

      {widgets.portfolio || widgets.ratingDist ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {widgets.portfolio ? <PortfolioChart data={portfolio} /> : null}
          {widgets.ratingDist ? <RatingDistributionChart data={ratings} isEmpty={!hasReviews} /> : null}
        </SimpleGrid>
      ) : null}

      {widgets.borrows ? (
        <CountPerBookChart
          title="Total Borrows per Published Book"
          data={borrows}
          dataKey="borrows"
          name="Total Borrows"
          isEmpty={!hasPublished || !hasBorrows}
          emptyLabel={!hasPublished ? 'No published books yet.' : 'No borrows recorded yet.'}
          colorIndex={0}
        />
      ) : null}

      {widgets.reads ? (
        <CountPerBookChart
          title="Completed Reads per Published Book"
          data={reads}
          dataKey="reads"
          name="Completed Reads"
          isEmpty={!hasPublished || !hasReads}
          emptyLabel={!hasPublished ? 'No published books yet.' : 'No completed reads recorded yet.'}
          colorIndex={1}
        />
      ) : null}

      {widgets.ratingPerBook && ratingPerBook.length > 0 ? (
        <RatingPerBookChart data={ratingPerBook} />
      ) : null}

      {widgets.trends ? (
        <Stack gap="xs">
          {trendError ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
              {trendError}
            </Alert>
          ) : null}
          <BorrowTrendsChart
            data={trendData}
            loading={trendLoading}
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
          />
        </Stack>
      ) : null}

      {widgets.table && hasPublished ? (
        <Paper withBorder p="md">
          <Text fw={600} size="sm" mb="sm">
            Published Books Detail
          </Text>
          <Table.ScrollContainer minWidth={860} type="native">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Genre</Table.Th>
                  <Table.Th>Total Borrows</Table.Th>
                  <Table.Th>Active Borrows</Table.Th>
                  <Table.Th>Unique Readers</Table.Th>
                  <Table.Th>Completed Reads</Table.Th>
                  <Table.Th>Avg Rating</Table.Th>
                  <Table.Th>Reviews</Table.Th>
                  <Table.Th>Published</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tableRows.map((book) => (
                  <Table.Tr key={book.bookId}>
                    <Table.Td>{book.title}</Table.Td>
                    <Table.Td>{book.genre || '—'}</Table.Td>
                    <Table.Td>{book.totalBorrows}</Table.Td>
                    <Table.Td>{book.activeBorrows}</Table.Td>
                    <Table.Td>{book.uniqueReaders}</Table.Td>
                    <Table.Td>{book.completedReads ?? 0}</Table.Td>
                    <Table.Td>
                      {book.averageRating != null ? (
                        <Group gap={4} wrap="nowrap">
                          {formatRating(book.averageRating)}
                          <IconStarFilled size={12} color="var(--app-star)" />
                        </Group>
                      ) : '—'}
                    </Table.Td>
                    <Table.Td>{book.reviewCount}</Table.Td>
                    <Table.Td>{book.publishedDate || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : null}
    </Stack>
  )
}

export default AuthorStats
