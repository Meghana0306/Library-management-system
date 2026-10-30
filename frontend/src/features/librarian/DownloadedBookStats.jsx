import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button, Checkbox, Group, Loader, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { IconAdjustments, IconDownload, IconPrinter, IconStarFilled } from '@tabler/icons-react'
import { bookService } from '../../services'
import { ApiError } from '../../services/api'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { StatCard } from '../../components/common/StatCard.jsx'
import { ChartCard } from '../../components/charts/ChartCard.jsx'
import { useChartTheme } from '../../components/charts/chartTheme.js'
import { downloadCsv } from './downloadFile.js'

const WIDGET_CONFIG = [
  { id: 'cards', label: 'Summary Cards' },
  { id: 'portfolio', label: 'Portfolio Breakdown' },
  { id: 'ratingDist', label: 'Rating Distribution' },
  { id: 'borrows', label: 'Borrows per Book' },
  { id: 'ratingPerBook', label: 'Avg Rating per Book' },
  { id: 'trends', label: 'Borrow Trends' },
  { id: 'table', label: 'Downloaded Books Table' },
]

const STORAGE_KEY = 'librarian-downloaded-stats-widgets'
const DEFAULT_WIDGETS = Object.fromEntries(WIDGET_CONFIG.map((w) => [w.id, true]))

const loadWidgetPrefs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_WIDGETS, ...JSON.parse(raw) } : { ...DEFAULT_WIDGETS }
  } catch {
    return { ...DEFAULT_WIDGETS }
  }
}

const formatRating = (value) => (value == null ? 'N/A' : Number(value).toFixed(1))
const truncate = (str, max = 18) => (str && str.length > max ? `${str.slice(0, max - 1)}…` : str)

const exportCsv = (stats, trendData, trendPeriod) => {
  const { summary, books } = stats
  const rows = [
    ['DOWNLOADED BOOK STATISTICS REPORT'],
    [`Exported: ${new Date().toLocaleString()}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Books', summary.totalBooks],
    ['Published', summary.publishedBooks],
    ['Pending Review', summary.pendingBooks],
    ['Rejected', summary.rejectedBooks],
    ['Total Borrows', summary.totalBorrows],
    ['Total Reviews', summary.totalReviews],
    ['Overall Avg Rating', summary.overallAverageRating ?? 'N/A'],
    [],
    ['DOWNLOADED BOOKS'],
    ['Title', 'Genre', 'Total Borrows', 'Active Borrows', 'Unique Readers', 'Avg Rating', 'Reviews', 'Published Date'],
    ...books.filter((b) => b.status === 'APPROVED').sort((a, b) => b.totalBorrows - a.totalBorrows).map((b) => [
      b.title, b.genre, b.totalBorrows, b.activeBorrows, b.uniqueReaders,
      b.averageRating != null ? formatRating(b.averageRating) : 'N/A', b.reviewCount, b.publishedDate || 'N/A',
    ]),
  ]
  if (trendData.length > 0) {
    rows.push([], [`BORROW TRENDS (${trendPeriod.toUpperCase()})`], ['Period', 'Borrows'])
    trendData.forEach((d) => rows.push([d.period, d.count]))
  }
  downloadCsv(rows, `downloaded-book-stats-${new Date().toISOString().slice(0, 10)}.csv`)
}

/** Librarian-facing analytics for the downloaded (request-fulfilled) catalog. */
export const DownloadedBookStats = () => {
  const { axisProps, chartColors, gridProps, legendProps, ratingColors, statusColors, tooltipProps } = useChartTheme()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trendPeriod, setTrendPeriod] = useState('monthly')
  const [trendData, setTrendData] = useState([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [widgets, setWidgets] = useState(loadWidgetPrefs)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setLoading(true)
    bookService.getDownloadedBookStats()
      .then((res) => setStats(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load downloaded book statistics.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!stats) return
    setTrendLoading(true)
    bookService.getDownloadedBookTrends(trendPeriod)
      .then((res) => setTrendData(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTrendData([]))
      .finally(() => setTrendLoading(false))
  }, [stats, trendPeriod])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
  }, [widgets])

  const toggleWidget = (id) => setWidgets((prev) => ({ ...prev, [id]: !prev[id] }))

  if (loading) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading statistics…</Text>
      </Group>
    )
  }
  if (error) return <Text size="sm" c="red">{error}</Text>
  if (!stats) return null

  const { summary, books, ratingDistribution } = stats
  const approvedBooks = books.filter((b) => b.status === 'APPROVED')
  const statusColorMap = {
    Published: statusColors.approved,
    Pending: statusColors.pending,
    Rejected: statusColors.rejected,
  }

  const statusPieData = [
    { name: 'Published', value: summary.publishedBooks },
    { name: 'Pending', value: summary.pendingBooks },
    { name: 'Rejected', value: summary.rejectedBooks },
  ].filter((d) => d.value > 0)

  const borrowBarData = [...approvedBooks]
    .sort((a, b) => b.totalBorrows - a.totalBorrows)
    .map((b) => ({ name: truncate(b.title), borrows: b.totalBorrows }))

  const ratingBarData = Object.entries(ratingDistribution || {}).map(([star, count]) => ({
    name: `${star} star`, count, fill: ratingColors[Number(star) - 1],
  }))

  const ratingPerBookData = approvedBooks
    .filter((b) => b.averageRating != null)
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 10)
    .map((b) => ({ name: truncate(b.title), rating: Number(b.averageRating.toFixed(2)) }))

  const hasPublished = summary.publishedBooks > 0
  const hasBorrows = summary.totalBorrows > 0
  const hasReviews = summary.totalReviews > 0

  return (
    <Stack gap="md">
      <PageHeader
        title="Downloaded book statistics"
        description="Performance of books that were fulfilled through student requests."
        actions={(
          <Group gap="xs">
            <Button
              variant={showSettings ? 'filled' : 'default'}
              leftSection={<IconAdjustments size={16} stroke={1.5} />}
              onClick={() => setShowSettings((s) => !s)}
            >
              Customize
            </Button>
            <Button
              variant="default"
              leftSection={<IconDownload size={16} stroke={1.5} />}
              onClick={() => exportCsv(stats, trendData, trendPeriod)}
            >
              Export CSV
            </Button>
            <Button variant="default" leftSection={<IconPrinter size={16} stroke={1.5} />} onClick={() => window.print()}>
              Print / PDF
            </Button>
          </Group>
        )}
      />

      {showSettings ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
          {WIDGET_CONFIG.map((w) => (
            <Checkbox key={w.id} label={w.label} checked={!!widgets[w.id]} onChange={() => toggleWidget(w.id)} />
          ))}
        </SimpleGrid>
      ) : null}

      {widgets.cards ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <StatCard label="Total Books" value={summary.totalBooks} />
          <StatCard label="Published" value={summary.publishedBooks} />
          <StatCard label="Pending Review" value={summary.pendingBooks} />
          <StatCard label="Rejected" value={summary.rejectedBooks} />
          <StatCard label="Total Borrows" value={summary.totalBorrows} />
          <StatCard label="Total Reviews" value={summary.totalReviews} />
          <StatCard
            label="Avg Rating"
            value={summary.overallAverageRating != null ? `${formatRating(summary.overallAverageRating)} / 5` : 'N/A'}
            hint={hasReviews ? `${summary.totalReviews} review${summary.totalReviews !== 1 ? 's' : ''}` : undefined}
          />
        </SimpleGrid>
      ) : null}

      {widgets.portfolio || widgets.ratingDist ? (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {widgets.portfolio ? (
            <ChartCard title="Downloaded portfolio" isEmpty={statusPieData.length === 0} emptyLabel="No downloaded books yet.">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusPieData.map((entry) => (
                    <Cell key={entry.name} fill={statusColorMap[entry.name]} />
                  ))}
                </Pie>
                <Legend {...legendProps} />
                <Tooltip {...tooltipProps} formatter={(value) => [value, 'Books']} />
              </PieChart>
            </ChartCard>
          ) : null}

          {widgets.ratingDist ? (
            <ChartCard title="Rating distribution" isEmpty={!hasReviews} emptyLabel="No reviews yet.">
              <BarChart data={ratingBarData}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" name="Reviews" radius={[4, 4, 0, 0]}>
                  {ratingBarData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          ) : null}
        </SimpleGrid>
      ) : null}

      {widgets.borrows ? (
        <ChartCard
          title="Total borrows per downloaded book"
          isEmpty={!hasPublished || !hasBorrows}
          emptyLabel={!hasPublished ? 'No published books yet.' : 'No borrows recorded yet.'}
          height={300}
        >
          <BarChart data={borrowBarData}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="borrows" name="Total Borrows" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      ) : null}

      {widgets.ratingPerBook && ratingPerBookData.length > 0 ? (
        <ChartCard title="Average rating per downloaded book" height={300}>
          <BarChart data={ratingPerBookData}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} {...axisProps} />
            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="rating" name="Avg Rating" fill={chartColors[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      ) : null}

      {widgets.trends ? (
        <ChartCard
          title="Borrow trends over time"
          loading={trendLoading}
          isEmpty={trendData.length === 0}
          emptyLabel="No borrow history to show."
          height={300}
          actions={(
            <Group gap={4}>
              <Button size="xs" variant={trendPeriod === 'monthly' ? 'filled' : 'default'} onClick={() => setTrendPeriod('monthly')}>
                Monthly
              </Button>
              <Button size="xs" variant={trendPeriod === 'weekly' ? 'filled' : 'default'} onClick={() => setTrendPeriod('weekly')}>
                Weekly
              </Button>
            </Group>
          )}
        >
          <LineChart data={trendData}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="period" angle={-35} textAnchor="end" interval="preserveStartEnd" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => [value, 'Borrows']} labelFormatter={(label) => `Period: ${label}`} />
            <Line type="monotone" dataKey="count" name="Borrows" stroke={chartColors[5]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartCard>
      ) : null}

      {widgets.table && hasPublished ? (
        <Stack gap="xs">
          <Text fw={600} size="sm">Downloaded books detail</Text>
          <Table.ScrollContainer minWidth={640}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Genre</Table.Th>
                  <Table.Th>Total Borrows</Table.Th>
                  <Table.Th>Active Borrows</Table.Th>
                  <Table.Th>Unique Readers</Table.Th>
                  <Table.Th>Avg Rating</Table.Th>
                  <Table.Th>Reviews</Table.Th>
                  <Table.Th>Published</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...approvedBooks].sort((a, b) => b.totalBorrows - a.totalBorrows).map((b) => (
                  <Table.Tr key={b.bookId}>
                    <Table.Td>{b.title}</Table.Td>
                    <Table.Td>{b.genre || '—'}</Table.Td>
                    <Table.Td>{b.totalBorrows}</Table.Td>
                    <Table.Td>{b.activeBorrows}</Table.Td>
                    <Table.Td>{b.uniqueReaders}</Table.Td>
                    <Table.Td>
                      {b.averageRating != null ? (
                        <Group gap={4} wrap="nowrap">
                          {formatRating(b.averageRating)}
                          <IconStarFilled size={12} color="var(--app-star)" />
                        </Group>
                      ) : '—'}
                    </Table.Td>
                    <Table.Td>{b.reviewCount}</Table.Td>
                    <Table.Td>{b.publishedDate || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      ) : null}
    </Stack>
  )
}

export default DownloadedBookStats
