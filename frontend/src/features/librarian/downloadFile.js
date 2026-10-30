import apiClient from '../../services/api'

/** Turns a blob into a one-shot programmatic download via a detached anchor. */
export const triggerBlobDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const extensionFromPath = (path) => {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(path || '')
  return match ? match[1] : 'pdf'
}

const safeFileName = (title) => {
  const cleaned = String(title || 'book').replace(/[^\w\- ]+/g, '').trim()
  return cleaned || 'book'
}

/**
 * Replaces the banned `window.open('/api/files/download?...')` pattern: fetches
 * the file as an authenticated blob, then downloads it via a detached anchor.
 */
export const downloadBookFile = async (filePath, title) => {
  const response = await apiClient.get('/files/download', {
    params: { filePath },
    responseType: 'blob',
  })
  triggerBlobDownload(response.data, `${safeFileName(title)}.${extensionFromPath(filePath)}`)
}

export const downloadCsv = (rows, filename) => {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerBlobDownload(blob, filename)
}
