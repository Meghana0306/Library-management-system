import { Suspense, lazy } from 'react'
import { Alert, Box, Button, Center, Group, Loader, Modal, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconMapPin, IconTrash } from '@tabler/icons-react'
import { formatDateTime } from '../../../utils/helpers'

const PDFReaderModal = lazy(() => import('../../reader/PDFReaderModal.jsx'))

const BookmarkRow = ({ bookmark, onGoTo, onDelete }) => (
  <Paper withBorder p="xs" radius="sm">
    <Stack gap={2}>
      <Text size="sm" fw={600}>Page {bookmark.page}{bookmark.label ? ` — ${bookmark.label}` : ''}</Text>
      <Text size="xs" c="dimmed">{formatDateTime(bookmark.createdAt)}</Text>
      <Group gap="xs" mt={2}>
        <Button size="compact-xs" variant="default" leftSection={<IconMapPin size={12} stroke={1.5} />} onClick={() => onGoTo(bookmark)}>
          Go to page
        </Button>
        <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={12} stroke={1.5} />} onClick={() => onDelete(bookmark.id)}>
          Delete
        </Button>
      </Group>
    </Stack>
  </Paper>
)

const HighlightRow = ({ highlight, onGoTo, onDelete }) => (
  <Paper withBorder p="xs" radius="sm">
    <Stack gap={2}>
      <Text size="xs" fw={600}>Page {highlight.position?.pageNumber || '-'}</Text>
      <Text size="xs" lineClamp={3}>{highlight.content?.text || '(area highlight)'}</Text>
      {highlight.comment?.text ? <Text size="xs" c="dimmed" fs="italic">Note: {highlight.comment.text}</Text> : null}
      <Text size="xs" c="dimmed">{formatDateTime(highlight.createdAt)}</Text>
      <Group gap="xs" mt={2}>
        <Button size="compact-xs" variant="default" leftSection={<IconMapPin size={12} stroke={1.5} />} onClick={() => onGoTo(highlight)}>
          Jump to highlight
        </Button>
        <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={12} stroke={1.5} />} onClick={() => onDelete(highlight.id)}>
          Delete
        </Button>
      </Group>
    </Stack>
  </Paper>
)

/** Full-screen PDF reader with a bookmarks/highlights side panel. Pure UI — all state lives in BorrowedBooksPanel. */
export const ReaderModal = ({
  record,
  url,
  loading,
  error,
  bookmarks,
  bookmarkLabel,
  onBookmarkLabelChange,
  onAddBookmark,
  onScrollToBookmark,
  onRemoveBookmark,
  highlights,
  highlightQuery,
  onHighlightQueryChange,
  onAddHighlight,
  onScrollToHighlight,
  onRemoveHighlight,
  onScrollRefReady,
  onDocumentLoad,
  lastSavedAt,
  onClose,
}) => (
  <Modal opened onClose={onClose} title={record?.book?.title || 'Reader'} fullScreen>
    {loading ? (
      <Center h="70vh"><Loader size="sm" /></Center>
    ) : error ? (
      <Alert color="red" icon={<IconAlertTriangle size={16} stroke={1.5} />}>{error}</Alert>
    ) : (
      <Group align="flex-start" gap="md" wrap="nowrap" h="calc(100vh - 120px)">
        <Box style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <Suspense fallback={<Center h="100%"><Loader size="sm" /></Center>}>
            <PDFReaderModal
              url={url}
              highlights={highlights}
              onAddHighlight={onAddHighlight}
              onScrollRefReady={onScrollRefReady}
              onDocumentLoad={onDocumentLoad}
            />
          </Suspense>
        </Box>

        <ScrollArea w={320} h="100%" type="auto">
          <Stack gap="md" pr="xs">
            <Stack gap="xs">
              <Text fw={600} size="sm">Bookmarks</Text>
              <Text size="xs" c="dimmed">Navigate to the page you want to bookmark, then save it below.</Text>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  value={bookmarkLabel}
                  onChange={(e) => onBookmarkLabelChange(e.currentTarget.value)}
                  placeholder="Optional label"
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddBookmark() }}
                  style={{ flex: 1 }}
                />
                <Button size="sm" onClick={onAddBookmark}>Add</Button>
              </Group>
              <Stack gap="xs">
                {bookmarks.length === 0 ? (
                  <Text size="xs" c="dimmed">No bookmarks yet.</Text>
                ) : (
                  bookmarks.map((bookmark) => (
                    <BookmarkRow key={bookmark.id} bookmark={bookmark} onGoTo={onScrollToBookmark} onDelete={onRemoveBookmark} />
                  ))
                )}
              </Stack>
            </Stack>

            <Stack gap="xs">
              <Text fw={600} size="sm">Text Highlights</Text>
              <Text size="xs" c="dimmed">Select text in the PDF to highlight it. Hold Alt and drag to create an area highlight.</Text>
              <TextInput
                value={highlightQuery}
                onChange={(e) => onHighlightQueryChange(e.currentTarget.value)}
                placeholder="Filter highlights by text, note, or page"
              />
              <Stack gap="xs">
                {highlights.length === 0 ? (
                  <Text size="xs" c="dimmed">No highlights yet.</Text>
                ) : (
                  highlights.map((highlight) => (
                    <HighlightRow key={highlight.id} highlight={highlight} onGoTo={onScrollToHighlight} onDelete={onRemoveHighlight} />
                  ))
                )}
              </Stack>
            </Stack>

            {lastSavedAt ? <Text size="xs" c="dimmed">Last saved {formatDateTime(lastSavedAt)}</Text> : null}
          </Stack>
        </ScrollArea>
      </Group>
    )}
  </Modal>
)

export default ReaderModal
