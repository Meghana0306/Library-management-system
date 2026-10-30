import { useEffect, useRef, useState } from 'react'
import { Avatar, Box, Button, Group, PasswordInput, Progress, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { authAPI, avatarPath } from '../../services/api'
import { AuthImage, clearObjectUrlCache } from '../../components/common/AuthImage.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { getPasswordStrengthFeedback, validatePassword } from '../../utils/passwordValidator'

const AVATAR_MAX_SIZE = 2 * 1024 * 1024
const AVATAR_VALID_TYPES = ['image/jpeg', 'image/png']

export const StudentManageProfile = ({ userId, fullName, username, role, onProfileUpdated, onForceLogout, onClose }) => {
  const [form, setForm] = useState({ fullName: '', currentPassword: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [localAvatarUrl, setLocalAvatarUrl] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    authAPI.getStudentProfile(userId)
      .then((response) => {
        const profile = response.data || {}
        setForm((prev) => ({ ...prev, fullName: profile.fullName || fullName || '' }))
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [userId])

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (avatarInputRef.current) avatarInputRef.current.value = ''

    if (!AVATAR_VALID_TYPES.includes(file.type)) {
      notifications.show({ color: 'red', message: 'Please upload a JPG or PNG image' })
      return
    }
    if (file.size > AVATAR_MAX_SIZE) {
      notifications.show({ color: 'red', message: 'Profile picture must be less than 2MB' })
      return
    }

    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      await authAPI.uploadAvatar(userId, formData)
      clearObjectUrlCache()
      setLocalAvatarUrl(URL.createObjectURL(file))
      notifications.show({ color: 'green', message: 'Profile picture updated!' })
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to upload profile picture' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const validate = () => {
    if (!form.fullName.trim()) return 'Full Name is required'
    if (!form.currentPassword) return 'Current password is required for profile updates'
    if (form.password && form.password !== form.confirmPassword) return 'Password and confirm password do not match'
    if (form.password) {
      const validation = validatePassword(form.password)
      if (!validation.isValid) return validation.message
    }
    return null
  }

  const handleSaveClick = () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setConfirmOpen(true)
  }

  const handleSave = async () => {
    setConfirmOpen(false)
    try {
      setSaving(true)
      setError('')
      const payload = { fullName: form.fullName.trim(), currentPassword: form.currentPassword }
      if (form.password) payload.password = form.password

      const response = await authAPI.updateStudentProfile(userId, payload)
      const passwordChanged = Boolean(response.data?.passwordChanged)

      notifications.show({ color: 'green', message: 'Profile updated successfully' })
      setForm((prev) => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }))
      onProfileUpdated?.({ fullName: form.fullName.trim() })

      if (passwordChanged) {
        onForceLogout?.()
      }
    } catch (err) {
      setError(err?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const passwordStrength = getPasswordStrengthFeedback(validatePassword(form.password || '').strength)

  if (loading) {
    return <Skeleton height={320} radius="sm" />
  }

  return (
    <Stack gap="md">
      {error ? <Text size="sm" c="red">{error}</Text> : null}

      <Group>
        <Box pos="relative">
          {localAvatarUrl ? (
            <Avatar src={localAvatarUrl} size={72} radius="xl" />
          ) : (
            <AuthImage path={userId ? avatarPath(userId) : null} kind="avatar" name={fullName || username} size={72} />
          )}
        </Box>
        <Stack gap={4}>
          <Button
            variant="default"
            size="xs"
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            loading={avatarUploading}
          >
            Change picture
          </Button>
          <Text size="xs" c="dimmed">JPG or PNG, max 2MB.</Text>
        </Stack>
        <input type="file" ref={avatarInputRef} accept="image/jpeg,image/png" onChange={handleAvatarChange} style={{ display: 'none' }} />
      </Group>

      <Group grow>
        <TextInput label="Username" value={username || ''} disabled />
        <TextInput label="Role" value={role || ''} disabled />
      </Group>

      <TextInput label="Full Name" value={form.fullName} onChange={(e) => setField('fullName', e.currentTarget.value)} required />
      <PasswordInput label="Current Password" required value={form.currentPassword} onChange={(e) => setField('currentPassword', e.currentTarget.value)} />
      <PasswordInput label="New Password" placeholder="Leave blank to keep current password" value={form.password} onChange={(e) => setField('password', e.currentTarget.value)} />
      <PasswordInput label="Confirm New Password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.currentTarget.value)} />

      {form.password ? (
        <Stack gap={4}>
          <Progress value={passwordStrength.percent} color={passwordStrength.color} size="sm" />
          <Text size="xs" c={passwordStrength.color}>{passwordStrength.label}</Text>
        </Stack>
      ) : null}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSaveClick} loading={saving}>Update Profile</Button>
      </Group>

      <ConfirmModal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        title="Confirm profile update?"
        message="Your profile details will be updated."
        loading={saving}
      />
    </Stack>
  )
}

export default StudentManageProfile
