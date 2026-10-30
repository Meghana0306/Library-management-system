import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Anchor, Container, Group, Paper, Stack } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { PageHeader } from '../../components/common/PageHeader.jsx'
import { ColorSchemeToggle } from '../../components/common/ColorSchemeToggle.jsx'
import { LoginForm } from './LoginForm.jsx'
import { RegistrationForm } from './RegistrationForm.jsx'

/**
 * Shared shell for the three portal sign-in pages. Opens on login (user
 * decision); "Create an account" switches to registration, and a successful
 * registration switches back to login with the username prefilled and a
 * success note shown. Used by StudentAuthPage / AuthorAuthPage /
 * LibrarianAuthPage — each just supplies its login function, accepted roles
 * and registration variant.
 */
export const PortalAuthPage = ({
  title,
  loginDescription,
  loginFn,
  acceptedRoles,
  wrongRoleMessage,
  registrationVariant,
}) => {
  const [mode, setMode] = useState('login')
  const [prefillUsername, setPrefillUsername] = useState('')
  const [registeredNotice, setRegisteredNotice] = useState(false)

  const handleSwitchToRegister = () => {
    setRegisteredNotice(false)
    setMode('register')
  }

  const handleSwitchToLogin = () => {
    setRegisteredNotice(false)
    setPrefillUsername('')
    setMode('login')
  }

  const handleRegistered = (username) => {
    setPrefillUsername(username)
    setRegisteredNotice(true)
    setMode('login')
  }

  return (
    <Container size={420} py={64}>
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Anchor component={Link} to="/" size="sm" c="dimmed" underline="hover">
            <Group gap={4} wrap="nowrap">
              <IconArrowLeft size={16} stroke={1.5} />
              Back to portals
            </Group>
          </Anchor>
          <ColorSchemeToggle variant="subtle" />
        </Group>

        <PageHeader title={title} description={mode === 'login' ? loginDescription : undefined} order={1} />

        <Paper withBorder p="lg" shadow="xs">
          {mode === 'login' ? (
            <LoginForm
              loginFn={loginFn}
              acceptedRoles={acceptedRoles}
              wrongRoleMessage={wrongRoleMessage}
              prefillUsername={prefillUsername}
              registeredNotice={registeredNotice}
              onSwitchToRegister={handleSwitchToRegister}
            />
          ) : (
            <RegistrationForm
              variant={registrationVariant}
              onRegistered={handleRegistered}
              onCancel={handleSwitchToLogin}
            />
          )}
        </Paper>
      </Stack>
    </Container>
  )
}

export default PortalAuthPage
