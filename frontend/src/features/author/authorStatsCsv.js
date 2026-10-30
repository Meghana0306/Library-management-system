import { formatRating } from './authorUtils.js'

const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

/** Builds the exported report: header, SUMMARY, PUBLISHED BOOKS, BORROW TRENDS. */
export const buildStatsCsv = (stats, trendData, trendPeriod) => {
  const { summary, books } = stats

  const rows = [
    ['AUTHOR STATISTICS REPORT'],
    [`Exported: ${new Date().toLocaleString()}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Books', summary.totalBooks],
    ['Published', summary.publishedBooks],
    ['Pending Review', summary.pendingBooks],
    ['Rejected', summary.rejectedBooks],
    ['Total Borrows', summary.totalBorrows],
    ['Total Completed Reads', summary.totalCompletedReads ?? 0],
    ['Total Reviews', summary.totalReviews],
    ['Overall Avg Rating', summary.overallAverageRating ?? 'N/A'],
    [],
    ['PUBLISHED BOOKS'],
    ['Title', 'Genre', 'Total Borrows', 'Active Borrows', 'Unique Readers', 'Completed Reads', 'Avg Rating', 'Reviews', 'Published Date'],
    ...books
      .filter((book) => book.status === 'APPROVED')
      .sort((a, b) => b.totalBorrows - a.totalBorrows)
      .map((book) => [
        esc(book.title),
        esc(book.genre),
        book.totalBorrows,
        book.activeBorrows,
        book.uniqueReaders,
        book.completedReads ?? 0,
        book.averageRating != null ? formatRating(book.averageRating) : 'N/A',
        book.reviewCount,
        book.publishedDate || 'N/A',
      ]),
  ]

  if (trendData.length > 0) {
    rows.push([], [`BORROW TRENDS (${trendPeriod.toUpperCase()})`], ['Period', 'Borrows'])
    trendData.forEach((point) => rows.push([point.period, point.count]))
  }

  return rows.map((row) => (Array.isArray(row) ? row.join(',') : row)).join('\n')
}

export const downloadStatsCsv = (stats, trendData, trendPeriod, authorId) => {
  const csv = buildStatsCsv(stats, trendData, trendPeriod)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `author-stats-${authorId}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
