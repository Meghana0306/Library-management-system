import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Loader, Paper, Select, SegmentedControl, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { librarianService } from '../../services'
import { ApiError } from '../../services/api'
import { formatDateTime, loadLocalMap, saveLocalMap } from '../../utils/helpers'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'

const READ_MAP_KEY = 'librarianNotificationReadMap'
const DELETED_MAP_KEY = 'librarianNotificationDeletedMap'

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const PRIORITY_COLOR = { HIGH: 'red', MEDIUM: 'orange', LOW: 'gray' }

const CATEGORY_META = {
  BOOK_SUBMISSION: { label: 'Book Submission', tone: 'info' },
  USER_ACCOUNT: { label: 'User Account', tone: 'neutral' },
  BORROWING: { label: 'Borrowing', tone: 'warning' },
  ANNOUNCEMENT: { label: 'Announcement', tone: 'neutral' },
  GENERAL: { label: 'General', tone: 'neutral' },
}

const getCategoryMeta = (category) => CATEGORY_META[category || 'GENERAL'] || CATEGORY_META.GENERAL
const buildKey = (item, index) =>
  `${item.id || item.notificationId || item.category || 'GENERAL'}-${item.timestamp || ''}-${item.title || ''}-${index}`

/** Notification list: categories, priorities, search, and local read/archive state. */
export const NotificationBoard = ({ onUnreadCountChange }) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [view, setView] = useState('ACTIVE')
  const [readMap, setReadMap] = useState(() => loadLocalMap(READ_MAP_KEY))
  const [deletedMap, setDeletedMap] = useState(() => loadLocalMap(DELETED_MAP_KEY))

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await librarianService.getNotifications({ limit: 60 })
      setItems(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      notifications.show({
        title: 'Something went wrong',
        message: err instanceof ApiError ? err.message : 'Failed to load notifications.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const withKeys = useMemo(
    () => items.map((item, index) => ({ ...item, _key: buildKey(item, index) })),
    [items],
  )

  const activeItems = useMemo(() => withKeys.filter((item) => !deletedMap[item._key]), [withKeys, deletedMap])
  const unreadCount = activeItems.filter((item) => !readMap[item._key]).length

  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

  const scoped = useMemo(
    () => withKeys.filter((item) => (view === 'ARCHIVED' ? deletedMap[item._key] : !deletedMap[item._key])),
    [withKeys, view, deletedMap],
  )

  const categoryCounts = useMemo(() => scoped.reduce((acc, item) => {
    const key = item.category || 'GENERAL'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {}), [scoped])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return scoped
      .filter((item) => category === 'ALL' || item.category === category)
      .filter((item) => !keyword
        || (item.title || '').toLowerCase().includes(keyword)
        || (item.message || '').toLowerCase().includes(keyword)
        || (item.category || '').toLowerCase().includes(keyword))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 3
        const pb = PRIORITY_ORDER[b.priority] ?? 3
        if (pa !== pb) return pa - pb
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      })
  }, [scoped, category, search])

  const markAsRead = (key) => {
    const next = { ...readMap, [key]: true }
    setReadMap(next)
    saveLocalMap(READ_MAP_KEY, next)
  }

  const markAllAsRead = () => {
    const next = { ...readMap }
    filtered.forEach((item) => { next[item._key] = true })
    setReadMap(next)
    saveLocalMap(READ_MAP_KEY, next)
  }

  const archiveNotification = (key) => {
    const next = { ...deletedMap, [key]: true }
    setDeletedMap(next)
    saveLocalMap(DELETED_MAP_KEY, next)
  }

  const restoreNotification = (key) => {
    const next = { ...deletedMap }
    delete next[key]
    setDeletedMap(next)
    saveLocalMap(DELETED_MAP_KEY, next)
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Notification board"
        description="Submissions, account changes, borrowing activity and announcements in one feed."
        actions={view === 'ACTIVE' ? <Button variant="default" onClick={markAllAsRead}>Mark all read</Button> : null}
      />

      <Group gap="xs">
        <Badge color="forest">Unread: {unreadCount}</Badge>
        <Badge color="gray" variant="outline">Submissions: {categoryCounts.BOOK_SUBMISSION || 0}</Badge>
        <Badge color="gray" variant="outline">User updates: {categoryCounts.USER_ACCOUNT || 0}</Badge>
        <Badge color="gray" variant="outline">Borrowing: {categoryCounts.BORROWING || 0}</Badge>
        <Badge color="gray" variant="outline">Announcements: {categoryCounts.ANNOUNCEMENT || 0}</Badge>
      </Group>

      <SearchToolbar value={search} onChange={setSearch} placeholder="Search notifications">
        <Select
          value={category}
          onChange={(value) => setCategory(value || 'ALL')}
          data={[
            { value: 'ALL', label: 'All Categories' },
            { value: 'BOOK_SUBMISSION', label: 'Book Submission' },
            { value: 'USER_ACCOUNT', label: 'User Account' },
            { value: 'BORROWING', label: 'Borrowing' },
            { value: 'ANNOUNCEMENT', label: 'Announcement' },
            { value: 'GENERAL', label: 'General' },
          ]}
          allowDeselect={false}
          w={180}
        />
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[{ value: 'ACTIVE', label: 'Active' }, { value: 'ARCHIVED', label: 'Archived' }]}
        />
      </SearchToolbar>

      {loading ? (
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading notifications...</Text>
        </Group>
      ) : filtered.length === 0 ? (
        <EmptyState title="No notifications found" />
      ) : (
        <Stack gap="xs">
          {filtered.map((item) => {
            const isUnread = !readMap[item._key]
            return (
              <Paper key={item._key} p="sm" withBorder>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group gap={6}>
                      <Badge color="gray">{getCategoryMeta(item.category).label}</Badge>
                      <Badge color={PRIORITY_COLOR[item.priority] || 'gray'}>{item.priority || 'LOW'}</Badge>
                      {isUnread ? <Badge color="forest" variant="dot">Unread</Badge> : null}
                    </Group>
                    <Text fw={600} size="sm">{item.title}</Text>
                    <Text size="sm" c="dimmed">{item.message}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">{formatDateTime(item.timestamp)}</Text>
                      <Text size="xs" c="dimmed">· {getCategoryMeta(item.category).tone}</Text>
                    </Group>
                  </Stack>
                  <Group gap={4} wrap="nowrap">
                    <Button size="xs" variant="default" disabled={!isUnread} onClick={() => markAsRead(item._key)}>
                      {isUnread ? 'Mark as read' : 'Read'}
                    </Button>
                    {view === 'ACTIVE' ? (
                      <Button size="xs" color="red" variant="light" onClick={() => archiveNotification(item._key)}>
                        Archive
                      </Button>
                    ) : (
                      <Button size="xs" variant="default" onClick={() => restoreNotification(item._key)}>
                        Unarchive
                      </Button>
                    )}
                  </Group>
                </Group>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

export default NotificationBoard
