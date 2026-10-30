import { useEffect, useState } from 'react'
import { Badge, Button, Group, MultiSelect, Paper, Skeleton, Stack, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconClipboardList } from '@tabler/icons-react'
import { bookRequestService } from '../../services'
import { ApiError } from '../../services/api'
import { DataTable } from '../../components/common/DataTable.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { PREDEFINED_GENRES } from '../../utils/constants'
import { statusColor } from '../../theme.js'

const EMPTY_FORM = { title: '', author: '', genres: [], keywords: '', reason: '' }

export const BookRequestForm = ({ userId }) => {
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const loadRequests = async () => {
    if (!userId) return
    setLoadingRequests(true)
    try {
      const res = await bookRequestService.getUserRequests(userId)
      setRequests(Array.isArray(res.data.requests) ? res.data.requests : [])
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load your book requests.' })
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => { loadRequests() }, [userId])

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    if (formError) setFormError('')
    if (duplicateWarning) setDuplicateWarning('')
  }

  const validate = () => {
    if (!form.title.trim()) return 'Book title is required.'
    if (form.title.trim().length > 255) return 'Title must not exceed 255 characters.'
    if (!form.author.trim()) return 'Author name is required.'
    if (form.author.trim().length > 255) return 'Author must not exceed 255 characters.'
    if (!form.reason.trim()) return 'Reason for request is required.'
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) { setFormError(validationError); return }

    const lowerTitle = form.title.trim().toLowerCase()
    const lowerAuthor = form.author.trim().toLowerCase()
    const clientDuplicate = requests.find(
      (r) => (r.status || 'PENDING').toUpperCase() === 'PENDING'
        && r.title.trim().toLowerCase() === lowerTitle
        && r.author.trim().toLowerCase() === lowerAuthor,
    )
    if (clientDuplicate) {
      setDuplicateWarning(`You already have a pending request for "${form.title}" by ${form.author}. Please wait for the librarian's review or cancel it before requesting again.`)
      return
    }

    setSubmitting(true)
    setFormError('')
    setDuplicateWarning('')
    try {
      await bookRequestService.submitRequest({
        userId,
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genres.length > 0 ? form.genres.join(', ') : null,
        keywords: form.keywords.trim() || null,
        reason: form.reason.trim(),
      })
      notifications.show({ color: 'green', message: 'Your book request has been submitted! The librarian will review it shortly.' })
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadRequests()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit request. Please try again.'
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateWarning(message)
      } else {
        setFormError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRequests = requests.filter((r) => statusFilter === 'ALL' || (r.status || '').toUpperCase() === statusFilter)
  const statusCounts = requests.reduce((acc, r) => {
    const s = (r.status || 'PENDING').toUpperCase()
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const columns = [
    {
      key: 'title',
      label: 'Request',
      render: (req) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>&quot;{req.title}&quot; by {req.author}</Text>
          {req.genre ? <Text size="xs" c="dimmed">{req.genre}</Text> : null}
          {req.keywords ? <Text size="xs" c="dimmed">Keywords: {req.keywords}</Text> : null}
        </Stack>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (req) => (
        <Group gap={4}>
          <Badge color={statusColor(req.status)}>{(req.status || 'PENDING')}</Badge>
          {req.priority && req.priority !== 'NORMAL' ? <Badge color="red">Urgent</Badge> : null}
        </Group>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (req) => (
        <Stack gap={0}>
          <Text size="sm" lineClamp={2}>{req.reason}</Text>
          {req.rejectionReason ? <Text size="xs" c="red">Rejection reason: {req.rejectionReason}</Text> : null}
        </Stack>
      ),
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (req) => (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'),
    },
  ]

  return (
    <Stack gap="md">
      <Title order={3}>Request a Book</Title>

      <Group>
        <Button
          onClick={() => { setShowForm((v) => !v); setForm(EMPTY_FORM); setFormError(''); setDuplicateWarning('') }}
        >
          {showForm ? 'Cancel Request' : 'New Book Request'}
        </Button>
      </Group>

      {duplicateWarning ? <Text size="sm" c="orange">{duplicateWarning}</Text> : null}

      {showForm ? (
        <Paper withBorder p="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {formError ? <Text size="sm" c="red">{formError}</Text> : null}
              <Group grow>
                <TextInput
                  label="Book Title"
                  required
                  value={form.title}
                  onChange={(e) => setField('title', e.currentTarget.value)}
                  maxLength={255}
                  disabled={submitting}
                  placeholder="e.g. The Great Gatsby"
                />
                <TextInput
                  label="Author"
                  required
                  value={form.author}
                  onChange={(e) => setField('author', e.currentTarget.value)}
                  maxLength={255}
                  disabled={submitting}
                  placeholder="e.g. F. Scott Fitzgerald"
                />
              </Group>
              <Group grow align="flex-start">
                <MultiSelect
                  label="Genres (optional)"
                  data={PREDEFINED_GENRES}
                  value={form.genres}
                  onChange={(value) => setField('genres', value)}
                  disabled={submitting}
                  placeholder="Select genres..."
                  clearable
                  searchable
                />
                <TextInput
                  label="Keywords / Search Hints (optional)"
                  value={form.keywords}
                  onChange={(e) => setField('keywords', e.currentTarget.value)}
                  maxLength={255}
                  disabled={submitting}
                  placeholder="e.g. Wavelet Matrix"
                />
              </Group>
              <Textarea
                label="Reason for Request"
                required
                rows={4}
                value={form.reason}
                onChange={(e) => setField('reason', e.currentTarget.value)}
                disabled={submitting}
                placeholder="Why should the library add this book? How will it benefit readers?"
              />
              <Group>
                <Button type="submit" loading={submitting}>Submit Request</Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      ) : null}

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Your Request History ({requests.length})</Title>
        </Group>
        <Tabs value={statusFilter} onChange={setStatusFilter}>
          <Tabs.List>
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
              <Tabs.Tab key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}{s !== 'ALL' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {loadingRequests ? (
          <Skeleton height={220} radius="sm" />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={IconClipboardList}
            title="No requests"
            description={requests.length === 0 ? 'No book requests yet. Submit your first request above!' : `No ${statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} requests.`}
          />
        ) : (
          <DataTable columns={columns} rows={filteredRequests} rowKey="requestId" emptyLabel="No book requests yet." />
        )}
      </Stack>
    </Stack>
  )
}

export default BookRequestForm
