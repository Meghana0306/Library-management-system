import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Box, Button, Group, Loader, Paper, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useAuth } from '../../auth/useAuth'
import { librarianService } from '../../services'
import { ApiError, authAPI, avatarPath } from '../../services/api'
import { validatePassword } from '../../utils/passwordValidator'
import { AuthImage } from '../../components/common/AuthImage.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { PasswordStrengthInput } from '../auth/PasswordStrengthInput.jsx'

const AVATAR_MAX_SIZE = 2 * 1024 * 1024
const AVATAR_VALID_TYPES = ['image/jpeg', 'image/png']

/** The librarian's own profile: avatar upload, editable fields, password change. */
export const ManageOwnProfile = () => {
  const { userId, fullName: authFullName, updateAuth, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '', role: '', fullName: '', employeeId: '',
    currentPassword: '', password: '', confirmPassword: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirming, setConfirming] = useState(false)

  const [localAvatarPreview, setLocalAvatarPreview] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const avatarInputRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    librarianService.getProfile(userId)
      .then((response) => {
        const profile = response.data || {}
        setForm((prev) => ({
          ...prev,
          username: profile.username || '',
          role: profile.role || '',
          fullName: profile.fullName || '',
          employeeId: profile.employeeId || '',
        }))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => () => {
    if (localAvatarPreview) URL.revokeObjectURL(localAvatarPreview)
  }, [localAvatarPreview])

  const onChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (avatarInputRef.current) avatarInputRef.current.value = ''

    if (!AVATAR_VALID_TYPES.includes(file.type)) {
      setAvatarError('Please upload a JPG or PNG image')
      return
    }
    if (file.size > AVATAR_MAX_SIZE) {
      setAvatarError('Profile picture must be less than 2MB')
      return
    }

    setAvatarUploading(true)
    setAvatarError('')
    setAvatarSuccess('')
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      await authAPI.uploadAvatar(userId, formData)
      setLocalAvatarPreview(URL.createObjectURL(file))
      setAvatarSuccess('Profile picture updated!')
      setTimeout(() => setAvatarSuccess(''), 2500)
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Failed to upload profile picture')
    } finally {
      setAvatarUploading(false)
    }
  }

  const validate = () => {
    if (!form.fullName.trim()) {
      setError('Full Name is required')
      return false
    }
    if (!form.currentPassword) {
      setError('Current password is required for profile updates')
      return false
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError('Password and confirm password do not match')
      return false
    }
    if (form.password) {
      const check = validatePassword(form.password)
      if (!check.isValid) {
        setError(check.message)
        return false
      }
    }
    return true
  }

  const handleSaveClick = () => {
    if (validate()) setConfirming(true)
  }

  const handleConfirm = async () => {
    setConfirming(false)
    setSaving(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        employeeId: form.employeeId.trim(),
        currentPassword: form.currentPassword,
      }
      if (form.password) payload.password = form.password

      const response = await librarianService.updateProfile(userId, payload)
      const updated = response.data?.user || response.data || {}
      const passwordChanged = !!response.data?.passwordChanged

      setSuccess('Profile updated successfully')
      setForm((prev) => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }))
      updateAuth({ fullName: updated.fullName || form.fullName.trim() })

      if (passwordChanged) {
        notifications.show({
          title: 'Signed out',
          message: 'Profile updated successfully. Please sign in again with your new password.',
          color: 'forest',
        })
        logout()
        navigate('/librarian/login')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Stack gap="md">
        <PageHeader title="My profile" />
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading profile...</Text>
        </Group>
      </Stack>
    )
  }

  return (
    <Stack gap="md" maw={640}>
      <PageHeader title="My profile" description="Update your details and credentials with current-password confirmation." />

      {error ? <Text size="sm" c="red">{error}</Text> : null}
      {success ? <Text size="sm" c="green">{success}</Text> : null}

      <Paper p="md" withBorder>
        <Group gap="md" align="flex-start">
          <Box
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            {localAvatarPreview ? (
              <Avatar src={localAvatarPreview} size={80} radius="xl" />
            ) : (
              <AuthImage path={avatarPath(userId)} kind="avatar" name={form.fullName || authFullName} size={80} />
            )}
          </Box>
          <input
            type="file"
            ref={avatarInputRef}
            accept="image/jpeg,image/png"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>Profile picture</Text>
            <Text size="xs" c="dimmed">JPG or PNG, max 2MB. Click the avatar to change it.</Text>
            {avatarUploading ? <Text size="xs">Uploading...</Text> : null}
            {avatarError ? <Text size="xs" c="red">{avatarError}</Text> : null}
            {avatarSuccess ? <Text size="xs" c="green">{avatarSuccess}</Text> : null}
          </Stack>
        </Group>
      </Paper>

      <TextInput label="Username" value={form.username} disabled />
      <TextInput label="Role" value={form.role} disabled />
      <TextInput label="Full Name" value={form.fullName} onChange={(e) => onChange('fullName', e.currentTarget.value)} />
      <TextInput
        label="Employee ID"
        placeholder="Optional for librarians"
        value={form.employeeId}
        onChange={(e) => onChange('employeeId', e.currentTarget.value)}
      />
      <TextInput
        label="Current password"
        type="password"
        required
        value={form.currentPassword}
        onChange={(e) => onChange('currentPassword', e.currentTarget.value)}
      />
      <PasswordStrengthInput
        label="New password"
        placeholder="Leave blank to keep your current password"
        value={form.password}
        onChange={(value) => onChange('password', value)}
      />
      <TextInput
        label="Confirm new password"
        type="password"
        value={form.confirmPassword}
        onChange={(e) => onChange('confirmPassword', e.currentTarget.value)}
      />

      <Group justify="flex-end">
        <Button onClick={handleSaveClick} loading={saving}>Update profile</Button>
      </Group>

      <ConfirmModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleConfirm}
        title="Confirm profile update?"
        confirmLabel="Confirm"
      />
    </Stack>
  )
}

export default ManageOwnProfile
