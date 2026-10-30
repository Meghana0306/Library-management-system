import { useState } from 'react'
import { Alert, Anchor, Button, PasswordInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'
import { authAPI, ApiError } from '../../services/api'
import { isValidEmail, validatePassword } from '../../utils/passwordValidator'
import { PasswordStrengthInput } from './PasswordStrengthInput.jsx'

const ROLE_DATA = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'STAFF', label: 'Staff' },
]

/**
 * Shared registration form for all three portals. `variant` selects which
 * portal-specific extra field is shown (student: role dropdown, author: bio,
 * librarian: employee id) and fixes the `role` sent to authAPI.register for
 * the non-student variants.
 */
export const RegistrationForm = ({ variant, onRegistered, onCancel }) => {
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    initialValues: {
      username: '',
      email: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      role: 'STUDENT',
      bio: '',
      employeeId: '',
    },
    validate: {
      username: (value) => {
        if (value.trim().length === 0) return 'Username is required'
        if (value.trim().length < 3) return 'Username must be at least 3 characters'
        return null
      },
      email: (value) => {
        if (value.trim().length === 0) return 'Email is required'
        if (!isValidEmail(value)) return 'Please enter a valid email'
        return null
      },
      fullName: (value) => (value.trim().length === 0 ? 'Full Name is required' : null),
      password: (value) => {
        const result = validatePassword(value)
        return result.isValid ? null : result.message
      },
      confirmPassword: (value, values) => (value !== values.password ? 'Passwords do not match' : null),
      bio: (value) =>
        variant === 'author' && value && value.length > 1000 ? 'Bio must not exceed 1000 characters' : null,
    },
  })

  const handleSubmit = async (values) => {
    setSubmitError('')
    setLoading(true)
    try {
      const payload = {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
        role: variant === 'student' ? values.role : variant.toUpperCase(),
      }
      if (variant === 'author') payload.bio = values.bio.trim() || null
      if (variant === 'librarian') payload.employeeId = values.employeeId.trim() || null

      const response = await authAPI.register(payload)
      if (!response.data?.success) {
        setSubmitError(response.data?.message || 'Registration failed')
        return
      }

      const registeredUsername = values.username.trim()
      setSuccess(true)
      form.reset()
      setTimeout(() => onRegistered(registeredUsername), 1500)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Alert icon={<IconCircleCheck size={16} stroke={1.5} />} color="green" variant="light">
        Registration successful. Redirecting to sign in…
      </Alert>
    )
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="sm">
        {submitError ? (
          <Alert icon={<IconAlertCircle size={16} stroke={1.5} />} color="red" variant="light">
            {submitError}
          </Alert>
        ) : null}

        <TextInput
          label="Username"
          placeholder="Enter a unique username"
          autoComplete="username"
          disabled={loading}
          {...form.getInputProps('username')}
        />
        <TextInput
          label="Email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          disabled={loading}
          {...form.getInputProps('email')}
        />
        <TextInput
          label="Full Name"
          placeholder="Enter your full name"
          autoComplete="name"
          disabled={loading}
          {...form.getInputProps('fullName')}
        />

        {variant === 'student' ? (
          <Select
            label="Account type"
            data={ROLE_DATA}
            allowDeselect={false}
            disabled={loading}
            {...form.getInputProps('role')}
          />
        ) : null}

        <PasswordStrengthInput
          value={form.values.password}
          onChange={(value) => form.setFieldValue('password', value)}
          error={form.errors.password}
          disabled={loading}
        />
        <PasswordInput
          label="Confirm Password"
          placeholder="Confirm your password"
          autoComplete="new-password"
          disabled={loading}
          {...form.getInputProps('confirmPassword')}
        />

        {variant === 'author' ? (
          <Textarea
            label="Bio (optional)"
            placeholder="Tell us about yourself as an author..."
            description={`${form.values.bio.length}/1000 characters`}
            autosize
            minRows={3}
            maxLength={1000}
            disabled={loading}
            {...form.getInputProps('bio')}
          />
        ) : null}

        {variant === 'librarian' ? (
          <TextInput
            label="Employee ID (optional)"
            placeholder="Enter your employee ID (optional)"
            disabled={loading}
            {...form.getInputProps('employeeId')}
          />
        ) : null}

        <Button type="submit" fullWidth loading={loading}>
          Register
        </Button>
        <Text size="sm" c="dimmed" ta="center">
          Already have an account?{' '}
          <Anchor component="button" type="button" size="sm" onClick={onCancel} disabled={loading}>
            Sign in
          </Anchor>
        </Text>
      </Stack>
    </form>
  )
}

export default RegistrationForm
