import { useEffect, useState } from 'react'
import { Loader, Modal, Stack, Text } from '@mantine/core'
import { bookService } from '../../services'
import { EmptyState } from '../../components/common/EmptyState.jsx'

const summarizeText = (value) => {
  if (!value || !String(value).trim()) return '—'
  const text = String(value).trim()
  return text.length > 220 ? `${text.slice(0, 220)}...` : text
}

const normalize = (value) => (value === null || value === undefined ? '' : String(value).trim())

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'genre', label: 'Genre' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'description', label: 'Summary' },
  { key: 'fileName', label: 'Book File' },
  { key: 'coverImageName', label: 'Cover Image' },
]

const getChangedFields = (detail) => {
  const before = detail?.before || {}
  const after = detail?.after || {}
  return FIELDS
    .filter(({ key }) => normalize(before[key]) !== normalize(after[key]))
    .map(({ key, label }) => ({ key, label, before: before[key], after: after[key] }))
}

/** Version history for a published book: action, timestamp, before/after diffs. */
export const BookHistoryModal = ({ opened, book, onClose }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!opened || !book) return
    setLoading(true)
    setError('')
    bookService.getBookHistory(book.id)
      .then((res) => setRecords(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Failed to load version history.'))
      .finally(() => setLoading(false))
  }, [opened, book])

  return (
    <Modal opened={opened} onClose={onClose} title={`Version history: ${book?.title || ''}`} size="lg">
      {loading ? (
        <Loader size="sm" />
      ) : error ? (
        <Text size="sm" c="red">{error}</Text>
      ) : records.length === 0 ? (
        <EmptyState title="No history available" compact />
      ) : (
        <Stack gap="md">
          {records.map((record) => {
            let detail = null
            try {
              detail = record.details ? JSON.parse(record.details) : null
            } catch {
              detail = null
            }
            const changedFields = getChangedFields(detail)
            return (
              <Stack key={record.id} gap={4}>
                <Text size="sm" fw={600}>
                  {record.action} · {new Date(record.createdAt).toLocaleString()}
                </Text>
                {detail ? (
                  changedFields.length === 0 ? (
                    <Text size="xs" c="dimmed">No field-level differences captured.</Text>
                  ) : (
                    changedFields.map((field) => (
                      <Text size="xs" key={field.key}>
                        <b>{field.label}:</b>{' '}
                        {field.key === 'description'
                          ? `"${summarizeText(field.before)}" -> "${summarizeText(field.after)}"`
                          : `"${field.before || '—'}" -> "${field.after || '—'}"`}
                      </Text>
                    ))
                  )
                ) : null}
              </Stack>
            )
          })}
        </Stack>
      )}
    </Modal>
  )
}

export default BookHistoryModal
