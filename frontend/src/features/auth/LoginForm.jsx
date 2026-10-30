import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'
import { portalPathForRole } from '../../auth/AuthContext.jsx'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/api'

/**
 * Shared login form. `loginFn` is one of authAPI.login / loginAuthor /
 * loginLibrarian; `acceptedRoles` gates which returned role is allowed to
 * proceed on this portal (the generic /auth/login endpoint accepts any role,
 * so the student portal is the one that actually depends on this check).
 */
export const LoginForm = ({
  loginFn,
  acceptedRoles,
  wrongRoleMessage,
  prefillUsername,
  registeredNotice,
  onSwitchToRegister,
}) => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const form = useForm({
    initialValues: { username: prefillUsername || '', password: '' },
    validate: {
      username: (value) => (value.trim().length === 0 ? 'Username is required' : null),
      password: (value) => (value.length === 0 ? 'Password is required' : null),
    },
  })

  const handleSubmit = async (values) => {
    setError('')
    setLoading(true)
    try {
      const response = await loginFn({ username: values.username.trim(), password: values.password })
      const data = response.data
      if (!data?.success) {
        setError(data?.message || 'Login failed')
        return
      }
      const role = String(data.role || '').toUpperCase()
      if (!acceptedRoles.includes(role)) {
        setError(wrongRoleMessage)
        return
      }
      login({
        token: data.token,
        userId: data.userId,
        username: data.username || values.username.trim(),
        fullName: data.fullName,
        role,
      })
      navigate(portalPathForRole(role))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="sm">
        {registeredNotice ? (
          <Alert icon={<IconCircleCheck size={16} stroke={1.5} />} color="green" variant="light">
            Registration successful. Sign in with your new account.
          </Alert>
        ) : null}
        {error ? (
          <Alert icon={<IconAlertCircle size={16} stroke={1.5} />} color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <TextInput
          label="Username"
          placeholder="your.username"
          autoComplete="username"
          disabled={loading}
          {...form.getInputProps('username')}
        />
        <PasswordInput
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
          {...form.getInputProps('password')}
        />
        <Button type="submit" fullWidth loading={loading}>
          Sign in
        </Button>
        <Text size="sm" c="dimmed" ta="center">
          Don&apos;t have an account?{' '}
          <Anchor component="button" type="button" size="sm" onClick={onSwitchToRegister} disabled={loading}>
            Create an account
          </Anchor>
        </Text>
      </Stack>
    </form>
  )
}

export default LoginForm
