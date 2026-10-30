import { useEffect, useState } from 'react'
import { Button, Group, Modal, PasswordInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'

const ROLE_DATA = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AUTHOR', label: 'Author' },
  { value: 'LIBRARIAN', label: 'Librarian' },
]

const roleUsesEmployeeId = (role) => role === 'STAFF' || role === 'LIBRARIAN'

const emptyForm = { username: '', fullName: '', email: '', role: 'STUDENT', password: '', employeeId: '', bio: '' }

/**
 * Add/edit user dialog. `mode` is 'CREATE' or 'EDIT'; `user` supplies the
 * initial values in edit mode. Save opens a second ConfirmModal step before
 * calling the API, replacing the old window.confirm().
 */
export const UserFormModal = ({ opened, mode, user, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!opened) return
    if (mode === 'EDIT' && user) {
      setForm({
        username: user.username || '',
        fullName: user.fullName || '',
        email: user.email || '',
        role: user.role || 'STUDENT',
        password: '',
        employeeId: user.employeeId || '',
        bio: '',
      })
    } else {
      setForm(emptyForm)
    }
    setErrors({})
    setConfirming(false)
  }, [opened, mode, user])

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const needsEmployeeId = roleUsesEmployeeId(form.role)
  const needsBio = mode === 'CREATE' && form.role === 'AUTHOR'

  const validate = () => {
    const next = {}
    if (!form.fullName.trim()) next.fullName = 'Full Name is required'
    if (!form.email.trim()) next.email = 'Email is required'
    if (mode === 'CREATE') {
      if (!form.username.trim()) next.username = 'Username is required'
      if (!form.password) next.password = 'Temporary password is required'
      if (needsEmployeeId && !form.employeeId.trim()) next.employeeId = 'Employee ID is required for this role'
    }
    if (needsBio && form.bio.trim().length > 2000) next.bio = 'Bio must not exceed 2000 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSaveClick = () => {
    if (validate()) setConfirming(true)
  }

  const handleConfirm = () => {
    const payload = mode === 'CREATE'
      ? {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          employeeId: needsEmployeeId ? form.employeeId.trim() : '',
          ...(needsBio ? { bio: form.bio.trim() || null } : {}),
        }
      : {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          employeeId: needsEmployeeId ? form.employeeId.trim() : '',
          role: form.role,
        }
    onSubmit(payload)
  }

  return (
    <>
      <Modal
        opened={opened && !confirming}
        onClose={onClose}
        title={mode === 'CREATE' ? 'Add new user' : `Edit user: ${user?.username || ''}`}
        size="md"
      >
        <Stack gap="sm">
          {mode === 'CREATE' ? (
            <TextInput
              label="Username"
              value={form.username}
              onChange={(e) => set('username', e.currentTarget.value)}
              error={errors.username}
            />
          ) : (
            <TextInput label="Username" value={form.username} disabled />
          )}
          <TextInput
            label="Full Name"
            value={form.fullName}
            onChange={(e) => set('fullName', e.currentTarget.value)}
            error={errors.fullName}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.currentTarget.value)}
            error={errors.email}
          />
          <Select
            label="Role"
            data={ROLE_DATA}
            value={form.role}
            allowDeselect={false}
            onChange={(value) => set('role', value)}
          />
          {needsEmployeeId ? (
            <TextInput
              label="Employee ID"
              placeholder="Required for Staff and Librarian accounts"
              value={form.employeeId}
              onChange={(e) => set('employeeId', e.currentTarget.value)}
              error={errors.employeeId}
            />
          ) : null}
          {needsBio ? (
            <Textarea
              label="Biography"
              placeholder="Short biography for the author"
              rows={4}
              maxLength={2000}
              value={form.bio}
              onChange={(e) => set('bio', e.currentTarget.value)}
              error={errors.bio}
            />
          ) : null}
          {mode === 'CREATE' ? (
            <PasswordInput
              label="Temporary password"
              value={form.password}
              onChange={(e) => set('password', e.currentTarget.value)}
              error={errors.password}
            />
          ) : null}
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveClick}>{mode === 'CREATE' ? 'Create user' : 'Save changes'}</Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleConfirm}
        loading={loading}
        title={mode === 'CREATE' ? 'Create account?' : 'Save changes?'}
        confirmLabel={mode === 'CREATE' ? 'Create' : 'Save'}
      >
        <Text size="sm">
          {mode === 'CREATE'
            ? `Create a new ${form.role.toLowerCase()} account for ${form.username || 'this user'}?`
            : `Save changes for ${user?.username}?`}
        </Text>
      </ConfirmModal>
    </>
  )
}

export default UserFormModal
