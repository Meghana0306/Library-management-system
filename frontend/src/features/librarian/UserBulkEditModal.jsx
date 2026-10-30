import { useState } from 'react'
import { Select, Text } from '@mantine/core'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'

const ROLE_DATA = [
  { value: '', label: 'No change' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AUTHOR', label: 'Author' },
  { value: 'LIBRARIAN', label: 'Librarian' },
]

const STATUS_DATA = [
  { value: '', label: 'No change' },
  { value: 'true', label: 'Activate' },
  { value: 'false', label: 'Deactivate' },
]

/** Bulk role/status update for the selected users; both fields are optional. */
export const UserBulkEditModal = ({ opened, count, onClose, onSubmit, loading }) => {
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')

  const handleConfirm = () => {
    const payload = {}
    if (role) payload.role = role
    if (active !== '') payload.active = active === 'true'
    onSubmit(payload)
  }

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={loading}
      title="Bulk edit users"
      confirmLabel="Apply changes"
    >
      <Text size="sm" mb="sm">Apply a role and/or status change to {count} selected user(s).</Text>
      <Select label="Role" data={ROLE_DATA} value={role} onChange={(value) => setRole(value || '')} mb="sm" />
      <Select label="Status" data={STATUS_DATA} value={active} onChange={(value) => setActive(value || '')} />
    </ConfirmModal>
  )
}

export default UserBulkEditModal
