const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const exportReadingHistoryCSV = (data) => {
  const header = ['Title', 'Author', 'Genre', 'Borrow Date', 'Return Date', 'Duration (days)', 'Status', 'Progress (%)']
  const rows = data.map((r) => [
    `"${(r.bookTitle || '').replace(/"/g, '""')}"`,
    `"${(r.author || '').replace(/"/g, '""')}"`,
    `"${(r.genre || '').replace(/"/g, '""')}"`,
    `"${formatDate(r.borrowedDate)}"`,
    `"${formatDate(r.returnDate)}"`,
    r.readingDurationDays ?? '',
    r.status || '',
    r.readingProgress ?? '',
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'reading_history.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportReadingHistoryPDF = async (data) => {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const marginL = 10
  const tableW = pageW - marginL * 2

  doc.setFillColor(92, 107, 150)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Reading History Report', pageW / 2, 14, { align: 'center' })

  doc.setFillColor(75, 88, 128)
  doc.rect(0, 22, pageW, 10, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleDateString()}   |   Total Records: ${data.length}`, pageW / 2, 28, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  const headers = ['Book Title', 'Author', 'Genre', 'Borrowed', 'Returned', 'Days', 'Status', 'Progress']
  const colWidths = [58, 42, 32, 26, 26, 14, 22, 17]

  let y = 42
  const drawHeaderRow = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(marginL, y - 5, tableW, 9, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(marginL, y - 5, tableW, 9, 'S')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(55, 65, 81)
    let x = marginL + 2
    headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i] })
    y += 9
    doc.setFont('helvetica', 'normal')
  }

  drawHeaderRow()

  data.forEach((r, idx) => {
    if (y > 195) {
      doc.addPage()
      y = 15
      drawHeaderRow()
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(marginL, y - 5, tableW, 9, 'F')
    }

    doc.setTextColor(75, 85, 99)
    let x = marginL + 2
    const statusLabel = (r.status || '').toUpperCase() === 'RETURNED' ? 'Returned' : 'Active'
    const row = [
      (r.bookTitle || '—').slice(0, 34),
      (r.author || '—').slice(0, 24),
      (r.genre || '—').split(/[,;]/)[0].trim().slice(0, 18),
      formatDate(r.borrowedDate),
      formatDate(r.returnDate),
      r.readingDurationDays != null ? `${r.readingDurationDays}d` : '—',
      statusLabel,
      `${r.readingProgress ?? 0}%`,
    ]
    row.forEach((val, i) => { doc.text(val, x, y); x += colWidths[i] })

    doc.setDrawColor(229, 231, 235)
    doc.line(marginL, y + 3, marginL + tableW, y + 3)
    y += 9
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${i} of ${pageCount}`, pageW - marginL, 205, { align: 'right' })
  }

  doc.save('reading_history.pdf')
}
