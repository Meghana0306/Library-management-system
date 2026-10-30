import {
  Badge,
  Button,
  Chip,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { IconArchive, IconArchiveOff, IconBell, IconMailOpened, IconTrash } from '@tabler/icons-react'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { NOTIFICATION_CATEGORIES, categoryLabel } from './useAuthorNotifications.js'
import { formatNotificationDate } from './authorUtils.js'

const CATEGORY_COLOR = {
  APPROVAL: 'green',
  REJECTION: 'red',
  DELETION: 'orange',
  ANNOUNCEMENT: 'gray',
}

const PRIORITY_LABEL = { HIGH: 'Urgent', MEDIUM: 'Notable' }
const PRIORITY_COLOR = { HIGH: 'red', MEDIUM: 'orange' }

const NotificationItem = ({ item, unread, archived, onToggleRead, onArchive, onRestore, onDelete }) => {
  const priority = String(item.priority || 'LOW').toUpperCase()

  return (
    <Paper withBorder p="xs" bg={unread ? 'var(--mantine-color-forest-light)' : undefined}>
      <Group justify="space-between" align="center" gap="xs" wrap="nowrap" mb={4}>
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" color={CATEGORY_COLOR[item.category] || 'gray'}>
            {categoryLabel(item.category)}
          </Badge>
          {PRIORITY_LABEL[priority] ? (
            <Badge size="xs" color={PRIORITY_COLOR[priority]}>
              {PRIORITY_LABEL[priority]}
            </Badge>
          ) : null}
        </Group>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {formatNotificationDate(item.timestamp)}
        </Text>
      </Group>

      <Text size="sm" fw={unread ? 600 : 500}>
        {item.title}
      </Text>
      <Text size="xs" c="dimmed">
        {item.message}
      </Text>

      <Group gap={4} mt="xs">
        {archived ? null : (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconMailOpened size={16} stroke={1.5} />}
            onClick={() => onToggleRead(item.id)}
          >
            {unread ? 'Mark Read' : 'Mark Unread'}
          </Button>
        )}
        {archived ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArchiveOff size={16} stroke={1.5} />}
            onClick={() => onRestore(item.id)}
          >
            Restore
          </Button>
        ) : (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArchive size={16} stroke={1.5} />}
            onClick={() => onArchive(item.id)}
          >
            Archive
          </Button>
        )}
        <Button
          size="compact-xs"
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={16} stroke={1.5} />}
          onClick={() => onDelete(item.id)}
        >
          Delete
        </Button>
      </Group>
    </Paper>
  )
}

/**
 * Author-side notification board. Active/archived views, category filter chips
 * with counts, search, and per-item read/archive/delete actions. Everything is
 * client-side state persisted by `useAuthorNotifications`.
 */
export const AuthorNotifications = ({
  notifications,
  categoryCounts,
  unreadCount,
  readNotificationIds,
  view,
  onViewChange,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onToggleRead,
  onArchive,
  onRestore,
  onDelete,
  onMarkAllRead,
}) => {
  const archived = view === 'ARCHIVED'

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" align="center" wrap="nowrap" mb="sm">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} size="sm">
            Notification Board
          </Text>
          {archived ? null : (
            <Badge size="sm" color={unreadCount > 0 ? 'forest' : 'gray'}>
              Unread: {unreadCount}
            </Badge>
          )}
        </Group>
        {archived ? null : (
          <Button size="compact-xs" variant="subtle" color="gray" onClick={onMarkAllRead}>
            Mark All Read
          </Button>
        )}
      </Group>

      <SegmentedControl
        fullWidth
        size="xs"
        value={view}
        onChange={onViewChange}
        data={[{ value: 'ACTIVE', label: 'Active' }, { value: 'ARCHIVED', label: 'Archived' }]}
        mb="sm"
      />

      <SearchToolbar
        value={search}
        onChange={onSearchChange}
        placeholder={`Search ${archived ? 'archived' : 'active'} notifications`}
        width="100%"
      >
        <Chip.Group value={filter} onChange={onFilterChange}>
          <Group gap={4} wrap="wrap">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <Chip key={category} value={category} size="xs" variant="outline">
                {categoryLabel(category)} ({categoryCounts?.[category] ?? 0})
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </SearchToolbar>

      {notifications.length === 0 ? (
        <EmptyState
          compact
          icon={IconBell}
          title="No notifications available."
          description="Approval, rejection and deletion updates show up here."
        />
      ) : (
        <ScrollArea.Autosize mah={560} type="auto">
          <Stack gap="xs">
            {notifications.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                archived={archived}
                unread={!readNotificationIds.includes(item.id)}
                onToggleRead={onToggleRead}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Paper>
  )
}

export default AuthorNotifications
