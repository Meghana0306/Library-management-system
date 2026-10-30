import { Badge, Box, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconEye, IconTrash } from '@tabler/icons-react'
import { AuthImage } from '../../components/common/AuthImage.jsx'
import { coverPath } from '../../services/api'
import { statusColor } from '../../theme'
import {
  formatBookDate,
  isDeletableStatus,
  isEditableBook,
  nonDeletableMessage,
  nonEditableMessage,
  normalizeStatus,
} from './authorUtils.js'

const DetailRow = ({ label, children }) => (
  <Group gap="xs" align="flex-start" wrap="nowrap">
    <Text size="sm" fw={600} w={130} style={{ flexShrink: 0 }}>
      {label}
    </Text>
    <Text size="sm" c="dimmed">
      {children}
    </Text>
  </Group>
)

/** Read-only book record with the edit / delete / preview entry points. */
export const BookDetailModal = ({ book, onClose, onEdit, onDelete, onPreview }) => {
  if (!book) return null

  const status = normalizeStatus(book.status)
  const rejected = status === 'REJECTED'
  const editable = isEditableBook(book)
  const deletable = isDeletableStatus(book.status)

  return (
    <Modal opened onClose={onClose} title={book.title} size="lg">
      <Stack gap="sm">
        <Group gap="md" align="flex-start" wrap="nowrap">
          <AuthImage path={coverPath(book.id)} kind="book" width={96} height={132} alt={`Cover of ${book.title}`} />
          <Stack gap={6} style={{ flex: 1 }}>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                Status
              </Text>
              <Badge color={statusColor(status)}>{status}</Badge>
            </Group>
            <DetailRow label="Genre">{book.genre || 'Uncategorized'}</DetailRow>
            <DetailRow label="Published Date">{formatBookDate(book.publishedDate)}</DetailRow>
            <DetailRow label="Submitted Date">{formatBookDate(book.submittedDate)}</DetailRow>
          </Stack>
        </Group>

        <Stack gap={2}>
          <Text size="sm" fw={600}>
            Description
          </Text>
          <Text size="sm" c="dimmed">
            {book.description || 'No description provided.'}
          </Text>
        </Stack>

        {rejected && book.rejectionReason ? (
          <DetailRow label="Rejection Reason">{book.rejectionReason}</DetailRow>
        ) : null}

        {!rejected && !deletable ? (
          <Text size="xs" c="dimmed">
            {nonDeletableMessage()}
          </Text>
        ) : null}
        {!rejected && !editable ? (
          <Text size="xs" c="dimmed">
            {nonEditableMessage(book)}
          </Text>
        ) : null}

        <Group justify="flex-end" gap="xs" mt="sm">
          {book.filePath ? (
            <Button
              variant="default"
              leftSection={<IconEye size={16} stroke={1.5} />}
              onClick={() => onPreview(book)}
            >
              Preview Book File
            </Button>
          ) : null}
          {rejected ? null : (
            <>
              <Tooltip label={nonEditableMessage(book)} disabled={editable}>
                <Box>
                  <Button
                    variant="default"
                    leftSection={<IconEdit size={16} stroke={1.5} />}
                    disabled={!editable}
                    onClick={() => onEdit(book)}
                  >
                    Edit Details
                  </Button>
                </Box>
              </Tooltip>
              <Tooltip label={nonDeletableMessage()} disabled={deletable}>
                <Box>
                  <Button
                    variant="default"
                    color="red"
                    leftSection={<IconTrash size={16} stroke={1.5} />}
                    disabled={!deletable}
                    onClick={() => onDelete(book)}
                  >
                    Delete Book
                  </Button>
                </Box>
              </Tooltip>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}

export default BookDetailModal
