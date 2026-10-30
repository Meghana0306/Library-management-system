import { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { IconBooks } from '@tabler/icons-react'
import { AuthImage } from '../../components/common/AuthImage.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { coverPath } from '../../services/api'
import { statusColor } from '../../theme'
import { formatBookDate, isDeletableStatus, nonDeletableMessage, normalizeStatus } from './authorUtils.js'

const BookRow = ({ book, selected, onToggleSelect, onOpen }) => {
  const selectable = isDeletableStatus(book.status)

  return (
    <Table.Tr bg={selected ? 'var(--mantine-color-forest-light)' : undefined}>
      <Table.Td w={40}>
        <Tooltip label={nonDeletableMessage()} disabled={selectable}>
          <Box>
            <Checkbox
              aria-label={`Select ${book.title}`}
              checked={selected}
              disabled={!selectable}
              onChange={() => onToggleSelect(book.id)}
            />
          </Box>
        </Tooltip>
      </Table.Td>
      <Table.Td w={44}>
        <AuthImage path={coverPath(book.id)} kind="book" width={32} height={44} alt={`Cover of ${book.title}`} />
      </Table.Td>
      <Table.Td>
        <UnstyledButton onClick={() => onOpen(book)} style={{ display: 'block', width: '100%' }}>
          <Text size="sm" fw={500} lineClamp={1}>
            {book.title}
          </Text>
          <Text size="xs" c="dimmed">
            {book.genre || 'Uncategorized'}
          </Text>
        </UnstyledButton>
      </Table.Td>
      <Table.Td w={110}>
        <Badge color={statusColor(book.status)}>{normalizeStatus(book.status)}</Badge>
      </Table.Td>
      <Table.Td w={120} ta="right">
        <Text size="xs" c="dimmed">
          {formatBookDate(book.publishedDate || book.submittedDate)}
        </Text>
      </Table.Td>
    </Table.Tr>
  )
}

/**
 * One collapsible section of the author's book list (pending, rejected or
 * published). Shows `maxVisible` rows until expanded.
 */
export const BookListSection = ({
  title,
  books,
  maxVisible = 6,
  loading,
  emptyMessage,
  selectedBookIds,
  onToggleSelect,
  onOpen,
}) => {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? books : books.slice(0, maxVisible)
  const hiddenCount = Math.max(0, books.length - maxVisible)

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" align="center" mb="sm">
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Badge color="gray">{books.length}</Badge>
      </Group>

      {loading ? (
        <Stack gap="xs">
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
        </Stack>
      ) : books.length === 0 ? (
        <EmptyState compact icon={IconBooks} title={emptyMessage} />
      ) : (
        <>
          <Table>
            <Table.Tbody>
              {visible.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  selected={selectedBookIds.includes(book.id)}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                />
              ))}
            </Table.Tbody>
          </Table>

          {hiddenCount > 0 ? (
            <Button
              size="compact-sm"
              variant="subtle"
              color="gray"
              mt="xs"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? 'Show less' : `View list (${hiddenCount} more)`}
            </Button>
          ) : null}
        </>
      )}
    </Paper>
  )
}

export default BookListSection
