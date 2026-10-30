import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Anchor, Badge, Button, Grid, Group, Paper, Progress, Select, Skeleton, SimpleGrid, Stack, Text, TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconRefresh } from '@tabler/icons-react'
import { bookRequestService, bookService } from '../../services'
import { ApiError } from '../../services/api'
import { useAiCapability } from '../../ai/AiCapabilityContext.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { RequestActionModal } from './RequestActionModal.jsx'

const StatusBadge = ({ status }) => {
  const s = (status || '').toUpperCase()
  const color = s === 'APPROVED' ? 'green' : s === 'REJECTED' ? 'red' : 'gray'
  return <Badge color={color}>{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>
}

/** Book requests: grouped by title+author, with download, priority and analytics. */
export const BookRequestsPanel = () => {
  const [requests, setRequests] = useState([])
  const [catalogBooks, setCatalogBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [searchTerm, setSearchTerm] = useState('')
  const [downloadStyle, setDownloadStyle] = useState('medium')

  const [actionRequest, setActionRequest] = useState(null)
  const [priorityLoading, setPriorityLoading] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState({})
  const [downloadMessage, setDownloadMessage] = useState({})
  const [downloadError, setDownloadError] = useState({})
  const [urlInputs, setUrlInputs] = useState({})
  const downloadTimers = useRef({})

  const { available: aiAvailable } = useAiCapability('summary')

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await bookRequestService.getAllRequests(statusFilter !== 'ALL' ? statusFilter : null)
      setRequests(Array.isArray(res.data?.requests) ? res.data.requests : [])
    } catch (err) {
      notifications.show({
        title: 'Something went wrong',
        message: err instanceof ApiError ? err.message : 'Failed to load book requests.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCatalog = async () => {
    try {
      const res = await bookService.getAllBooks()
      setCatalogBooks(Array.isArray(res.data) ? res.data : [])
    } catch {
      setCatalogBooks([])
    }
  }

  useEffect(() => {
    loadRequests()
  }, [statusFilter])

  useEffect(() => {
    loadCatalog()
  }, [])

  useEffect(() => () => {
    Object.values(downloadTimers.current).forEach((id) => clearInterval(id))
  }, [])

  const filteredRequests = useMemo(() => requests.filter((r) => {
    if (!searchTerm.trim()) return true
    const kw = searchTerm.trim().toLowerCase()
    return (r.title || '').toLowerCase().includes(kw)
      || (r.author || '').toLowerCase().includes(kw)
      || (r.keywords || '').toLowerCase().includes(kw)
      || (r.requesterName || '').toLowerCase().includes(kw)
  }), [requests, searchTerm])

  const groupedRequests = useMemo(() => {
    const groups = {}
    filteredRequests.forEach((r) => {
      const key = `${(r.title || '').trim().toLowerCase()}|||${(r.author || '').trim().toLowerCase()}`
      if (!groups[key]) groups[key] = { primary: r, requesters: [] }
      groups[key].requesters.push(r)
    })
    return Object.values(groups)
  }, [filteredRequests])

  const analytics = useMemo(() => {
    const authorCount = {}
    const genreCount = {}
    requests.forEach((req) => {
      const author = (req.author || 'Unknown').trim()
      authorCount[author] = (authorCount[author] || 0) + 1
      const genres = (req.genre || 'Unspecified').split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length === 0) genres.push('Unspecified')
      genres.forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1 })
    })
    return {
      topAuthors: Object.entries(authorCount).sort((a, b) => b[1] - a[1]).slice(0, 3),
      topGenres: Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 3),
    }
  }, [requests])

  const suggestAlternatives = (req) => {
    if (!req?.title) return []
    const keyword = req.title.toLowerCase()
    return catalogBooks.filter((book) => (book.title || '').toLowerCase().includes(keyword)).slice(0, 3)
  }

  const openAction = (req, action, allInGroup = []) => setActionRequest({ req, action, allInGroup })

  const handleActionDone = ({ type, message }) => {
    notifications.show({
      title: type === 'success' ? 'Done' : 'Partial success',
      message,
      color: type === 'success' ? 'green' : 'orange',
    })
    setActionRequest(null)
    loadRequests()
  }

  const handleTogglePriority = async (req) => {
    const newPriority = req.priority === 'URGENT' ? 'NORMAL' : 'URGENT'
    setPriorityLoading(req.requestId)
    try {
      await bookRequestService.updateRequestPriority(req.requestId, newPriority)
      await loadRequests()
    } catch {
      // silently ignore, matches prior behaviour
    } finally {
      setPriorityLoading(null)
    }
  }

  const startProgress = (requestId) => {
    setDownloadProgress((prev) => ({ ...prev, [requestId]: 10 }))
    if (downloadTimers.current[requestId]) clearInterval(downloadTimers.current[requestId])
    downloadTimers.current[requestId] = setInterval(() => {
      setDownloadProgress((prev) => {
        const current = prev[requestId] || 0
        if (current >= 90) return prev
        return { ...prev, [requestId]: Math.round(Math.min(90, current + Math.random() * 12 + 6)) }
      })
    }, 350)
  }

  const finishProgress = (requestId) => {
    if (downloadTimers.current[requestId]) {
      clearInterval(downloadTimers.current[requestId])
      delete downloadTimers.current[requestId]
    }
    setDownloadProgress((prev) => ({ ...prev, [requestId]: 100 }))
    setTimeout(() => {
      setDownloadProgress((prev) => {
        const next = { ...prev }
        delete next[requestId]
        return next
      })
    }, 1500)
  }

  const buildResultMessage = (data) => {
    const base = data?.summaryGenerated
      ? 'Downloaded and added to the library.'
      : 'Downloaded. Summary pending — use Generate Summary in Manage Books.'
    return data?.alternativeUsed && data?.requestedTitle && data?.downloadedTitle
      ? `${base} Alternative used: requested "${data.requestedTitle}", downloaded "${data.downloadedTitle}".`
      : base
  }

  const runDownload = async (req, payload) => {
    setDownloadMessage((prev) => ({ ...prev, [req.requestId]: '' }))
    setDownloadError((prev) => ({ ...prev, [req.requestId]: '' }))
    startProgress(req.requestId)
    try {
      const response = await bookRequestService.downloadRequest(req.requestId, payload)
      setDownloadMessage((prev) => ({ ...prev, [req.requestId]: buildResultMessage(response.data) }))
      setUrlInputs((prev) => ({ ...prev, [req.requestId]: '' }))
      await Promise.all([loadRequests(), loadCatalog()])
    } catch (err) {
      const errorObj = {
        message: err instanceof ApiError ? err.message : 'Download failed. Try manual upload.',
        suggestedArxivResults: Array.isArray(err.payload?.suggestedArxivResults) ? err.payload.suggestedArxivResults : [],
      }
      setDownloadError((prev) => ({ ...prev, [req.requestId]: errorObj }))
    } finally {
      finishProgress(req.requestId)
    }
  }

  const handleDownload = (req) => runDownload(req, { summaryStyle: downloadStyle })

  const handleDownloadFromUrl = (req, explicitUrl, suggestedPaper = null) => {
    const sourceUrl = (explicitUrl || urlInputs[req.requestId] || '').trim()
    if (!sourceUrl) {
      setDownloadError((prev) => ({ ...prev, [req.requestId]: { message: 'Please provide a URL.', suggestedArxivResults: [] } }))
      return
    }
    runDownload(req, {
      sourceUrl,
      downloadTitle: suggestedPaper?.title,
      downloadAuthor: suggestedPaper?.author,
      summaryStyle: downloadStyle,
    })
  }

  const handleResolveWithAlternative = async (req, suggestedBook) => {
    setDownloadMessage((prev) => ({ ...prev, [req.requestId]: '' }))
    setDownloadError((prev) => ({ ...prev, [req.requestId]: '' }))
    startProgress(req.requestId)
    try {
      const response = await bookRequestService.resolveWithAlternative(req.requestId, suggestedBook.bookId)
      const resolvedTitle = response.data?.resolvedBookTitle || suggestedBook.title
      setDownloadMessage((prev) => ({
        ...prev,
        [req.requestId]: `Request resolved with alternative title "${resolvedTitle}". Requester has been notified.`,
      }))
      await Promise.all([loadRequests(), loadCatalog()])
    } catch (err) {
      setDownloadError((prev) => ({
        ...prev,
        [req.requestId]: { message: err instanceof ApiError ? err.message : 'Failed to resolve with this book.', suggestedArxivResults: [] },
      }))
    } finally {
      finishProgress(req.requestId)
    }
  }

  return (
    <Stack gap="md">
      <PageHeader title="Book requests" description="Review and fulfil book requests from students and staff." />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Top requested authors</Text>
          {analytics.topAuthors.length === 0 ? (
            <Text size="sm" c="dimmed">No data yet.</Text>
          ) : (
            <Stack gap={4}>
              {analytics.topAuthors.map(([author, count]) => (
                <Group key={author} justify="space-between">
                  <Text size="sm">{author}</Text>
                  <Badge color="gray">{count}</Badge>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Top requested genres</Text>
          {analytics.topGenres.length === 0 ? (
            <Text size="sm" c="dimmed">No data yet.</Text>
          ) : (
            <Stack gap={4}>
              {analytics.topGenres.map(([genre, count]) => (
                <Group key={genre} justify="space-between">
                  <Text size="sm">{genre}</Text>
                  <Badge color="gray">{count}</Badge>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Summary style</Text>
          <Select
            value={downloadStyle}
            onChange={(value) => setDownloadStyle(value || 'medium')}
            data={[
              { value: 'short', label: 'Short' },
              { value: 'medium', label: 'Medium' },
              { value: 'detailed', label: 'Detailed' },
            ]}
            allowDeselect={false}
          />
          <Text size="xs" c="dimmed" mt={6}>
            {aiAvailable
              ? 'Used when generating summaries for downloaded books.'
              : 'Descriptions auto-generate only when AI is configured.'}
          </Text>
        </Paper>
      </SimpleGrid>

      <SearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Title, author, or requester..."
        actions={<Button variant="default" leftSection={<IconRefresh size={16} stroke={1.5} />} onClick={loadRequests}>Refresh</Button>}
      >
        <Select
          value={statusFilter}
          onChange={(value) => setStatusFilter(value || 'PENDING')}
          data={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'ALL', label: 'All' },
          ]}
          allowDeselect={false}
          w={150}
        />
      </SearchToolbar>

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="No book requests"
          description={requests.length === 0
            ? `No ${statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} book requests.`
            : 'No requests match your search.'}
        />
      ) : (
        <>
          <Text size="sm" c="dimmed">
            {groupedRequests.length} book{groupedRequests.length !== 1 ? 's' : ''} requested ({filteredRequests.length} total request{filteredRequests.length !== 1 ? 's' : ''})
          </Text>
          <Grid>
            {groupedRequests.map(({ primary: req, requesters }) => {
              const progress = downloadProgress[req.requestId]
              const message = downloadMessage[req.requestId]
              const errorInfo = downloadError[req.requestId]
              const alternatives = suggestAlternatives(req)
              return (
                <Grid.Col key={req.requestId} span={{ base: 12, md: 6 }}>
                  <Paper p="md" withBorder h="100%">
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={2}>
                          <Text fw={600} size="sm">&quot;{req.title}&quot;</Text>
                          <Text size="xs" c="dimmed">by {req.author}</Text>
                          {req.genre ? <Text size="xs" c="dimmed">{req.genre}</Text> : null}
                          {req.keywords ? <Text size="xs" c="dimmed">Keywords: {req.keywords}</Text> : null}
                        </Stack>
                        <Group gap={4}>
                          <StatusBadge status={req.status} />
                          {req.priority === 'URGENT' ? <Badge color="red">Urgent</Badge> : null}
                        </Group>
                      </Group>

                      {requesters.length > 1 ? (
                        <Stack gap={4}>
                          <Badge color="gray" variant="outline">{requesters.length} students requested</Badge>
                          <Text size="xs" c="dimmed">
                            {requesters.map((r) => r.requesterName || `User #${r.userId}`).join(', ')}
                          </Text>
                        </Stack>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Requested by: <b>{req.requesterName || `User #${req.userId}`}</b>
                          {req.createdAt ? ` on ${new Date(req.createdAt).toLocaleDateString()}` : ''}
                        </Text>
                      )}

                      <Text size="sm">Reason: {req.reason}</Text>
                      {req.rejectionReason ? <Text size="sm" c="red">Rejection reason: {req.rejectionReason}</Text> : null}

                      {alternatives.length > 0 ? (
                        <Group gap={4}>
                          <Text size="xs" c="dimmed">Alternatives:</Text>
                          {alternatives.map((book) => (
                            <Button
                              key={book.id}
                              size="compact-xs"
                              variant="light"
                              onClick={() => handleResolveWithAlternative(req, { bookId: book.id, title: book.title })}
                            >
                              {book.title}
                            </Button>
                          ))}
                        </Group>
                      ) : null}

                      <Group gap={6} wrap="wrap">
                        {req.status === 'PENDING' ? (
                          <>
                            <Button size="xs" color="green" onClick={() => openAction(req, 'APPROVED', requesters)}>
                              Approve{requesters.length > 1 ? ` all (${requesters.length})` : ''}
                            </Button>
                            <Button size="xs" color="red" variant="light" onClick={() => openAction(req, 'REJECTED', requesters)}>
                              Reject{requesters.length > 1 ? ` all (${requesters.length})` : ''}
                            </Button>
                          </>
                        ) : null}
                        {req.status !== 'REJECTED' ? (
                          <Button size="xs" variant="default" disabled={!!progress} onClick={() => handleDownload(req)}>
                            {req.status === 'PENDING' ? 'Download & approve' : 'Download'}
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant={req.priority === 'URGENT' ? 'default' : 'light'}
                          loading={priorityLoading === req.requestId}
                          onClick={() => handleTogglePriority(req)}
                        >
                          {req.priority === 'URGENT' ? 'Remove urgent' : 'Mark urgent'}
                        </Button>
                      </Group>

                      <Group gap={4} wrap="nowrap">
                        <TextInput
                          placeholder="Paste direct PDF or page URL..."
                          value={urlInputs[req.requestId] || ''}
                          onChange={(e) => setUrlInputs((prev) => ({ ...prev, [req.requestId]: e.currentTarget.value }))}
                          style={{ flex: 1 }}
                        />
                        <Button size="xs" disabled={!!progress} onClick={() => handleDownloadFromUrl(req)}>
                          Download from URL
                        </Button>
                      </Group>

                      {progress ? (
                        <Group gap="xs" align="center">
                          <Progress value={progress} style={{ flex: 1 }} size="sm" />
                          <Text size="xs">{progress}%</Text>
                        </Group>
                      ) : null}

                      {message ? <Text size="sm" c="green">{message}</Text> : null}

                      {errorInfo ? (
                        <Stack gap={4}>
                          <Text size="sm" c="red">{errorInfo.message}</Text>
                          {errorInfo.suggestedArxivResults?.length > 0 ? (
                            <Stack gap={4}>
                              <Text size="xs" fw={600}>Top arXiv results:</Text>
                              {errorInfo.suggestedArxivResults.slice(0, 3).map((paper) => (
                                <Paper key={paper.pdfUrl} p={6} withBorder>
                                  <Text size="xs" fw={600}>{paper.title}</Text>
                                  <Text size="xs" c="dimmed">{paper.author || 'Unknown author'}</Text>
                                  <Anchor href={paper.pdfUrl} target="_blank" rel="noreferrer" size="xs">{paper.pdfUrl}</Anchor>
                                  <Group justify="flex-end">
                                    <Button
                                      size="compact-xs"
                                      disabled={!!progress}
                                      onClick={() => handleDownloadFromUrl(req, paper.pdfUrl, paper)}
                                    >
                                      Download this result
                                    </Button>
                                  </Group>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Text size="xs" c="dimmed">No arXiv suggestions found. Try manual upload or a different search.</Text>
                          )}
                        </Stack>
                      ) : null}
                    </Stack>
                  </Paper>
                </Grid.Col>
              )
            })}
          </Grid>
        </>
      )}

      <RequestActionModal actionRequest={actionRequest} onClose={() => setActionRequest(null)} onDone={handleActionDone} />
    </Stack>
  )
}

export default BookRequestsPanel
