import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'
import { AuthImage, clearObjectUrlCache } from '../../components/common/AuthImage.jsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { PasswordStrengthInput } from '../auth/PasswordStrengthInput.jsx'
import { authAPI, avatarPath } from '../../services/api'
import { validatePassword } from '../../utils/passwordValidator'

const AVATAR_TYPES = ['image/jpeg', 'image/png']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const LOGOUT_DELAY_MS = 1800

const validateProfile = (form) => {
  const errors = {}
  const fullName = form.fullName.trim()
  const bio = form.bio?.trim() || ''

  if (!fullName) errors.fullName = 'Full Name is required'
  else if (fullName.length > 255) errors.fullName = 'Full Name must not exceed 255 characters'

  if (bio.length > 2000) errors.bio = 'Bio must not exceed 2000 characters'

  if (!form.currentPassword) errors.currentPassword = 'Current password is required for profile updates'

  if (form.password && form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Password and confirm password do not match'
  }

  if (form.password) {
    const result = validatePassword(form.password)
    if (!result.isValid) errors.password = result.message
  }

  return errors
}

/**
 * Author profile dialog: avatar upload, name/bio and an optional password
 * change. Changing the password invalidates the current token, so the portal
 * signs the author out once the success message has been shown.
 */
export const AuthorProfileModal = ({
  authorId,
  username,
  role,
  fullName,
  bio,
  onClose,
  onProfileSaved,
  onPasswordChanged,
}) => {
  const [form, setForm] = useState({
    fullName: fullName || '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
    bio: bio || '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [logoutPending, setLogoutPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const fileInputRef = useRef(null)

  const busy = loading || logoutPending

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (Object.keys(errors).length > 0) setErrors({})
    if (success) setSuccess('')
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please upload a JPG or PNG image')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('Profile picture must be less than 2MB')
      return
    }

    setAvatarUploading(true)
    setAvatarError('')
    setAvatarSuccess('')
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      await authAPI.uploadAvatar(authorId, formData)
      clearObjectUrlCache()
      setAvatarVersion((prev) => prev + 1)
      setAvatarSuccess('Profile picture updated!')
    } catch (err) {
      setAvatarError(err?.message || 'Failed to upload profile picture')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validateProfile(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setConfirmOpen(true)
  }

  const submitProfile = async () => {
    setConfirmOpen(false)
    setLoading(true)
    setSuccess('')
    try {
      const payload = {
        fullName: form.fullName.trim(),
        currentPassword: form.currentPassword,
        bio: form.bio.trim() || null,
      }
      if (form.password.trim()) payload.password = form.password.trim()

      const response = await authAPI.updateAuthorProfile(authorId, payload)
      const data = response?.data || {}

      onProfileSaved({
        fullName: data.fullName || payload.fullName,
        bio: data.bio ?? (payload.bio || ''),
      })
      setForm((prev) => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }))

      if (data.passwordChanged) {
        setSuccess('Profile updated successfully. Logging out...')
        setLogoutPending(true)
        setTimeout(onPasswordChanged, LOGOUT_DELAY_MS)
        return
      }

      setSuccess(data.message || 'Profile updated successfully.')
    } catch (err) {
      const message = err?.message || 'Failed to update profile'
      if (message.toLowerCase().includes('current password')) {
        setErrors({ currentPassword: message })
      } else {
        setErrors({ submit: message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title="Manage Profile"
      size="md"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      closeButtonProps={{ disabled: busy }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          {errors.submit ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
              {errors.submit}
            </Alert>
          ) : null}
          {success ? (
            <Alert color="green" variant="light" icon={<IconCircleCheck size={16} stroke={1.5} />}>
              {success}
            </Alert>
          ) : null}

          <Stack gap={6} align="center">
            <UnstyledButton
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              aria-label="Change profile picture"
            >
              <AuthImage
                key={avatarVersion}
                path={authorId ? avatarPath(authorId) : null}
                kind="avatar"
                name={form.fullName}
                size={140}
              />
            </UnstyledButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            <Text size="xs" c="dimmed">
              {avatarUploading ? 'Uploading...' : 'JPG or PNG, max 2MB. Click to change.'}
            </Text>
            {avatarError ? (
              <Text size="xs" c="red">
                {avatarError}
              </Text>
            ) : null}
            {avatarSuccess ? (
              <Text size="xs" c="green">
                {avatarSuccess}
              </Text>
            ) : null}
          </Stack>

          <TextInput label="Username" value={username || ''} disabled />
          <TextInput label="Role" value={role || 'AUTHOR'} disabled />

          <TextInput
            label="Full Name"
            maxLength={255}
            value={form.fullName}
            onChange={(event) => setField('fullName', event.currentTarget.value)}
            error={errors.fullName}
            disabled={busy}
          />

          <PasswordInput
            label="Current Password (required)"
            value={form.currentPassword}
            onChange={(event) => setField('currentPassword', event.currentTarget.value)}
            error={errors.currentPassword}
            disabled={busy}
            autoComplete="current-password"
          />

          <PasswordStrengthInput
            label="New Password"
            placeholder="Leave blank to keep current password"
            value={form.password}
            onChange={(value) => setField('password', value)}
            error={errors.password}
            disabled={busy}
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="Repeat new password"
            value={form.confirmPassword}
            onChange={(event) => setField('confirmPassword', event.currentTarget.value)}
            error={errors.confirmPassword}
            disabled={busy}
            autoComplete="new-password"
          />

          <Textarea
            label="Bio"
            rows={4}
            maxLength={2000}
            placeholder="Tell readers about yourself"
            value={form.bio}
            onChange={(event) => setField('bio', event.currentTarget.value)}
            error={errors.bio}
            disabled={busy}
            description={`${form.bio.length}/2000`}
          />

          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={logoutPending}>
              {logoutPending ? 'Logging out...' : 'Update Profile'}
            </Button>
          </Group>
        </Stack>
      </form>

      <ConfirmModal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitProfile}
        title="Confirm profile update?"
        message="Your account details will be updated with the values in this form."
        confirmLabel="Update Profile"
      />
    </Modal>
  )
}

export default AuthorProfileModal
