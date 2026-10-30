import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Select, Skeleton, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBellRinging } from '@tabler/icons-react'
import { borrowService } from '../../services'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { formatDateTime, loadLocalMap, saveLocalMap } from '../../utils/helpers'

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const CATEGORY_META = {
  DUE_REMINDER: { label: 'Due Reminder' },
  BORROWING_UPDATE: { label: 'Borrowing Update' },
  BOOK_DELETION: { label: 'Book Deletion' },
  ANNOUNCEMENT: { label: 'Announcement' },
  AUTHOR_REPLY: { label: 'Author Reply' },
  BOOK_REQUEST_UPDATE: { label: 'Request Update' },
  GENERAL: { label: 'General' },
}

const buildKey = (item) => {
  if (item?.notificationId != null) return `notification-${item.notificationId}`
  if (item?.id != null) return `id-${item.id}`
  return `${item?.category || 'GENERAL'}-${item?.referenceBookId || 'none'}-${item?.title || ''}-${item?.message || ''}`
}

const isPersisted = (item) => item?.notificationId != null
const getCategoryMeta = (category) => CATEGORY_META[category || 'GENERAL'] || CATEGORY_META.GENERAL

const getNotificationErrorMessage = (err) => {
  const text = String(err?.message || '')
  const lowered = text.toLowerCase()
  if (lowered.includes('jdbcconnectionexception') || lowered.includes('entitymanager') || lowered.includes('unable to acquire jdbc connection')) {
    return 'Notification service is temporarily unavailable. Please try again shortly.'
  }
  return text || 'Failed to load notifications'
}

export const StudentNotificationBoard = ({ userId, onUnreadCountChange }) => {
  const readKey = userId ? `student-notification-read-${userId}` : ''
  const archivedKey = userId ? `student-notification-archived-${userId}` : ''
  const deletedKey = userId ? `student-notification-deleted-${userId}` : ''

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [view, setView] = useState('ACTIVE')
  const [readMap, setReadMap] = useState(() => (readKey ? loadLocalMap(readKey) : {}))
  const [archivedMap, setArchivedMap] = useState(() => (archivedKey ? loadLocalMap(archivedKey) : {}))
  // No in-app action ever marks a notification "deleted" (persisted ones are removed via
  // the API and re-fetched; computed ones are archived instead) — this only guards against
  // stray legacy data, so there is no setter to go with it.
  const [deletedMap] = useState(() => (deletedKey ? loadLocalMap(deletedKey) : {}))

  const loadNotifications = async () => {
    if (!userId) { setItems([]); return }
    setLoading(true)
    try {
      const response = await borrowService.getStudentNotifications(userId)
      setItems(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      notifications.show({ color: 'red', message: getNotificationErrorMessage(err) })
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotifications() }, [userId])

  const scopedNotifications = useMemo(() => items
    .map((item) => ({ ...item, _key: buildKey(item) }))
    .filter((item) => !deletedMap[item._key])
    .filter((item) => (view === 'ARCHIVED' ? archivedMap[item._key] : !archivedMap[item._key])), [items, view, archivedMap, deletedMap])

  const activeNotifications = useMemo(() => items
    .map((item) => ({ ...item, _key: buildKey(item) }))
    .filter((item) => !deletedMap[item._key] && !archivedMap[item._key]), [items, archivedMap, deletedMap])

  const filteredNotifications = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return scopedNotifications
      .filter((item) => category === 'ALL' || (item.category || 'GENERAL') === category)
      .filter((item) => !keyword || `${item.title || ''} ${item.message || ''} ${item.category || ''}`.toLowerCase().includes(keyword))
      .sort((left, right) => {
        const leftPriority = PRIORITY_ORDER[left.priority] ?? 3
        const rightPriority = PRIORITY_ORDER[right.priority] ?? 3
        if (leftPriority !== rightPriority) return leftPriority - rightPriority
        return new Date(right.timestamp || 0) - new Date(left.timestamp || 0)
      })
  }, [scopedNotifications, category, search])

  const isReadItem = (item) => (isPersisted(item) ? Boolean(item.isRead) : Boolean(readMap[item._key]))
  const unreadCount = activeNotifications.filter((item) => !isReadItem(item)).length

  useEffect(() => { onUnreadCountChange?.(unreadCount) }, [onUnreadCountChange, unreadCount])

  const archiveItem = (key) => {
    if (!archivedKey) return
    const next = { ...archivedMap, [key]: true }
    setArchivedMap(next)
    saveLocalMap(archivedKey, next)
  }

  const markAsRead = async (item) => {
    if (isPersisted(item)) {
      try {
        await borrowService.markNotificationRead(item.notificationId)
        await loadNotifications()
      } catch {
        if (readKey) {
          const next = { ...readMap, [item._key]: true }
          setReadMap(next)
          saveLocalMap(readKey, next)
        }
      }
    } else if (readKey) {
      const next = { ...readMap, [item._key]: true }
      setReadMap(next)
      saveLocalMap(readKey, next)
    }
  }

  const deleteOrArchive = async (item) => {
    if (isPersisted(item)) {
      try {
        await borrowService.deleteNotification(item.notificationId)
        await loadNotifications()
      } catch {
        archiveItem(item._key)
      }
    } else {
      archiveItem(item._key)
    }
  }

  const restore = (key) => {
    if (!archivedKey) return
    const next = { ...archivedMap }
    delete next[key]
    setArchivedMap(next)
    saveLocalMap(archivedKey, next)
  }

  const markAllAsRead = async () => {
    try {
      await borrowService.markAllNotificationsRead(userId)
    } catch {
      // Best-effort: computed (non-persisted) notifications below still get marked locally.
    }
    if (readKey) {
      const next = { ...readMap }
      filteredNotifications.filter((item) => !isPersisted(item)).forEach((item) => { next[item._key] = true })
      setReadMap(next)
      saveLocalMap(readKey, next)
    }
    await loadNotifications()
  }

  const columns = [
    {
      key: 'notification',
      label: 'Notification',
      render: (item) => (
        <Stack gap={2}>
          <Group gap={6}>
            <Badge variant="light">{getCategoryMeta(item.category).label}</Badge>
            <Badge color={item.priority === 'HIGH' ? 'red' : item.priority === 'MEDIUM' ? 'orange' : 'gray'}>{item.priority || 'LOW'}</Badge>
            {isPersisted(item) ? <Text size="xs" c="dimmed" title="Saved notification">●</Text> : null}
          </Group>
          <Text size="sm" fw={600}>{item.title || 'Notification'}</Text>
          <Text size="xs" c="dimmed">{item.message || '-'}</Text>
        </Stack>
      ),
    },
    { key: 'timestamp', label: 'Received', render: (item) => formatDateTime(item.timestamp) },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => {
        const read = isReadItem(item)
        return (
          <Group gap="xs" wrap="nowrap">
            <Button size="compact-xs" variant="default" disabled={read} onClick={() => markAsRead(item)}>
              {read ? 'Read' : 'Mark as Read'}
            </Button>
            {view === 'ACTIVE' ? (
              <Button size="compact-xs" variant="subtle" color="red" onClick={() => deleteOrArchive(item)}>
                {isPersisted(item) ? 'Delete' : 'Archive'}
              </Button>
            ) : (
              <Button size="compact-xs" variant="subtle" onClick={() => restore(item._key)}>Restore</Button>
            )}
          </Group>
        )
      },
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Notification Board</Title>
        <Badge size="lg" color={unreadCount > 0 ? 'red' : 'gray'}>Unread: {unreadCount}</Badge>
      </Group>

      <SearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search notifications"
        actions={<Button variant="default" onClick={markAllAsRead}>Mark All Read</Button>}
      >
        <Select
          label="Category"
          value={category}
          onChange={(value) => setCategory(value || 'ALL')}
          data={[{ value: 'ALL', label: 'All Categories' }, ...Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label }))]}
          w={180}
          allowDeselect={false}
        />
        <Select
          label="View"
          value={view}
          onChange={(value) => setView(value || 'ACTIVE')}
          data={[{ value: 'ACTIVE', label: 'Active' }, { value: 'ARCHIVED', label: 'Archived' }]}
          w={140}
          allowDeselect={false}
        />
      </SearchToolbar>

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState icon={IconBellRinging} title="No notifications found" />
      ) : (
        <DataTable columns={columns} rows={filteredNotifications} rowKey="_key" emptyLabel="No notifications found." />
      )}
    </Stack>
  )
}

export default StudentNotificationBoard
