import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUserPlus } from '@tabler/icons-react'
import { borrowService, librarianService } from '../../services'
import { ApiError } from '../../services/api'
import { getDueDate } from '../../utils/helpers'
import { DataTable } from '../../components/common/DataTable.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { statusColor } from '../../theme.js'
import { UserFormModal } from './UserFormModal.jsx'
import { UserBulkEditModal } from './UserBulkEditModal.jsx'

const notifyError = (err, fallback) => {
  notifications.show({
    title: 'Something went wrong',
    message: err instanceof ApiError ? err.message : fallback,
    color: 'red',
  })
}

const notifySuccess = (message) => notifications.show({ title: 'Done', message, color: 'green' })

/** Librarian user administration: search/filter, CRUD and bulk role/status ops. */
export const ManageAllUsers = () => {
  const [users, setUsers] = useState([])
  const [activityMap, setActivityMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState([])

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('CREATE')
  const [formUser, setFormUser] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'activate'|'deactivate', users }

  const loadActivity = async () => {
    try {
      const response = await borrowService.getAllBorrowingRecords()
      const records = Array.isArray(response.data) ? response.data : []
      const next = {}
      records.forEach((record) => {
        const userId = record.user?.id || record.userId
        if (!userId) return
        const current = next[userId] || { borrowedCount: 0, lastBorrowedAt: null, overdueBorrowings: 0 }
        const status = (record.status || '').toUpperCase()
        if (status === 'BORROWED') {
          current.borrowedCount += 1
          const dueDate = getDueDate(record)
          if (dueDate && Date.now() > dueDate.getTime()) current.overdueBorrowings += 1
        }
        const borrowedAt = record.borrowedDate || record.createdAt || null
        if (borrowedAt && (!current.lastBorrowedAt || new Date(borrowedAt) > new Date(current.lastBorrowedAt))) {
          current.lastBorrowedAt = borrowedAt
        }
        next[userId] = current
      })
      setActivityMap(next)
    } catch {
      setActivityMap({})
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (roleFilter !== 'ALL') params.role = roleFilter
      if (statusFilter !== 'ALL') params.active = statusFilter === 'ACTIVE'
      const response = await librarianService.getAllUsers(params)
      setUsers(Array.isArray(response.data) ? response.data : [])
      setSelectedIds([])
    } catch (err) {
      notifyError(err, 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    loadActivity()
  }, [search, roleFilter, statusFilter])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  )

  const openCreate = () => {
    setFormMode('CREATE')
    setFormUser(null)
    setFormOpen(true)
  }

  const openEdit = (user) => {
    setFormMode('EDIT')
    setFormUser(user)
    setFormOpen(true)
  }

  const handleFormSubmit = async (payload) => {
    setFormLoading(true)
    try {
      if (formMode === 'CREATE') {
        await librarianService.createUser(payload)
        notifySuccess(`User ${payload.username} created successfully.`)
      } else {
        await librarianService.updateUser(formUser.id, payload)
        notifySuccess('User updated successfully.')
      }
      setFormOpen(false)
      await Promise.all([loadUsers(), loadActivity()])
    } catch (err) {
      notifyError(err, 'Failed to save user.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleBulkSubmit = async (payload) => {
    setBulkLoading(true)
    try {
      await librarianService.bulkUpdateUsers({ userIds: selectedIds, ...payload })
      notifySuccess('Bulk update completed successfully.')
      setBulkOpen(false)
      setSelectedIds([])
      await Promise.all([loadUsers(), loadActivity()])
    } catch (err) {
      notifyError(err, 'Bulk update failed.')
    } finally {
      setBulkLoading(false)
    }
  }

  const runToggle = async () => {
    if (!confirmAction) return
    setBulkLoading(true)
    try {
      const ids = confirmAction.users.map((u) => u.id)
      if (confirmAction.bulk) {
        if (confirmAction.type === 'activate') await librarianService.bulkActivateUsers(ids)
        else await librarianService.bulkDeactivateUsers(ids)
        notifySuccess(`${ids.length} user(s) ${confirmAction.type === 'activate' ? 'activated' : 'deactivated'}.`)
        setSelectedIds([])
      } else {
        const user = confirmAction.users[0]
        if (confirmAction.type === 'activate') await librarianService.activateUser(user.id)
        else await librarianService.deactivateUser(user.id)
        notifySuccess(`User ${user.username} has been ${confirmAction.type === 'activate' ? 'activated' : 'deactivated'}.`)
      }
      setConfirmAction(null)
      await Promise.all([loadUsers(), loadActivity()])
    } catch (err) {
      notifyError(err, 'Failed to update user status.')
    } finally {
      setBulkLoading(false)
    }
  }

  const columns = [
    { key: 'username', label: 'Username', sortable: true },
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (u) => <Badge color={statusColor(u.role)}>{u.role}</Badge> },
    { key: 'employeeId', label: 'Employee ID', render: (u) => u.employeeId || '—' },
    {
      key: 'active',
      label: 'Status',
      render: (u) => (
        <Badge color={u.active ? 'green' : 'gray'}>{u.active ? 'Active' : 'Deactivated'}</Badge>
      ),
    },
    {
      key: 'activity',
      label: 'Activity',
      render: (u) => {
        const activity = activityMap[u.id]
        return (
          <Stack gap={0}>
            <Text size="xs">Borrowed: {activity?.borrowedCount ?? 0}</Text>
            <Text size="xs" c={activity?.overdueBorrowings ? 'red' : 'dimmed'}>
              Overdue: {activity?.overdueBorrowings ?? 0}
            </Text>
            <Text size="xs" c="dimmed">
              Last borrowed: {activity?.lastBorrowedAt ? new Date(activity.lastBorrowedAt).toLocaleDateString() : 'N/A'}
            </Text>
          </Stack>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (u) => (
        <Group gap={4} wrap="nowrap">
          <Button size="xs" variant="default" onClick={() => openEdit(u)}>Edit</Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            disabled={!u.active}
            onClick={() => setConfirmAction({ type: 'deactivate', users: [u], bulk: false })}
          >
            Deactivate
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={u.active}
            onClick={() => setConfirmAction({ type: 'activate', users: [u], bulk: false })}
          >
            Activate
          </Button>
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <PageHeader
        title="Manage all users"
        description="Search, edit, and moderate accounts across every role."
        actions={(
          <Button leftSection={<IconUserPlus size={16} stroke={1.5} />} onClick={openCreate}>
            Add user
          </Button>
        )}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search username, full name, email, employee ID"
      >
        <Select
          value={roleFilter}
          onChange={(value) => setRoleFilter(value || 'ALL')}
          data={[
            { value: 'ALL', label: 'All Roles' },
            { value: 'STUDENT', label: 'Student' },
            { value: 'STAFF', label: 'Staff' },
            { value: 'AUTHOR', label: 'Author' },
            { value: 'LIBRARIAN', label: 'Librarian' },
          ]}
          allowDeselect={false}
          w={150}
        />
        <Select
          value={statusFilter}
          onChange={(value) => setStatusFilter(value || 'ALL')}
          data={[
            { value: 'ALL', label: 'All Status' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Deactivated' },
          ]}
          allowDeselect={false}
          w={150}
        />
      </SearchToolbar>

      {selectedIds.length > 0 ? (
        <Group gap="xs">
          <Text size="sm" c="dimmed">{selectedIds.length} selected</Text>
          <Button size="xs" variant="default" onClick={() => setBulkOpen(true)}>Bulk edit</Button>
          <Button
            size="xs"
            variant="default"
            onClick={() => setConfirmAction({
              type: 'activate',
              users: sortedUsers.filter((u) => selectedIds.includes(u.id)),
              bulk: true,
            })}
          >
            Activate selected
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={() => setConfirmAction({
              type: 'deactivate',
              users: sortedUsers.filter((u) => selectedIds.includes(u.id)),
              bulk: true,
            })}
          >
            Deactivate selected
          </Button>
        </Group>
      ) : null}

      {loading ? (
        <Skeleton height={280} radius="sm" />
      ) : sortedUsers.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search or filter combination." />
      ) : (
        <DataTable
          columns={columns}
          rows={sortedUsers}
          selection={{ selected: selectedIds, onChange: setSelectedIds }}
          emptyLabel="No users found."
        />
      )}

      <UserFormModal
        opened={formOpen}
        mode={formMode}
        user={formUser}
        loading={formLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <UserBulkEditModal
        opened={bulkOpen}
        count={selectedIds.length}
        loading={bulkLoading}
        onClose={() => setBulkOpen(false)}
        onSubmit={handleBulkSubmit}
      />

      <ConfirmModal
        opened={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runToggle}
        loading={bulkLoading}
        danger={confirmAction?.type === 'deactivate'}
        title={confirmAction?.type === 'activate' ? 'Activate account(s)?' : 'Deactivate account(s)?'}
        confirmLabel={confirmAction?.type === 'activate' ? 'Activate' : 'Deactivate'}
        message={confirmAction ? (
          confirmAction.bulk
            ? `${confirmAction.type === 'activate' ? 'Activate' : 'Deactivate'} ${confirmAction.users.length} selected user(s)?`
            : `${confirmAction.type === 'activate' ? 'Activate' : 'Deactivate'} account ${confirmAction.users[0]?.username}?`
        ) : ''}
      />
    </Stack>
  )
}

export default ManageAllUsers
