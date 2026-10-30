import { useNavigate } from 'react-router-dom'
import {
  AppShell,
  Badge,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBooks, IconChevronDown, IconLogout } from '@tabler/icons-react'
import { AuthImage } from '../common/AuthImage.jsx'
import { ColorSchemeToggle } from '../common/ColorSchemeToggle.jsx'
import { avatarPath } from '../../services/api'
import { useAuth } from '../../auth/useAuth'
import classes from './portalShell.module.css'

/**
 * Chrome shared by all three portals: the green identity band, per-portal
 * navigation on a tinted rail and a content column on the paper background.
 * Portals supply `navItems` and own everything below the header.
 */
export const PortalShell = ({
  portalName,
  navItems = [],
  activeTab,
  onTabChange,
  headerActions,
  onLogout,
  children,
}) => {
  const navigate = useNavigate()
  const { fullName, username, userId, role, logout } = useAuth()
  const [opened, { toggle }] = useDisclosure(false)
  const hasNav = navItems.length > 0
  const displayName = fullName || username || 'Account'

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    logout()
    navigate('/')
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={hasNav ? { width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } } : undefined}
      padding="md"
    >
      <AppShell.Header className={classes.header} withBorder={false}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {hasNav ? (
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
                className={classes.burger}
              />
            ) : null}
            <Box className={classes.mark}>
              <IconBooks size={20} stroke={1.5} />
            </Box>
            <Text component="span" className={classes.wordmark}>
              Library Management
            </Text>
            {portalName ? (
              <>
                <Divider orientation="vertical" my={14} className={classes.divider} />
                <Text size="sm" className={classes.portalName}>
                  {portalName}
                </Text>
              </>
            ) : null}
          </Group>

          <Group gap="xs" wrap="nowrap" className={classes.actions}>
            {headerActions}
            <ColorSchemeToggle />
            <Menu position="bottom-end" width={200} withinPortal>
              <Menu.Target>
                <UnstyledButton className={classes.account}>
                  <Group gap="xs" wrap="nowrap">
                    <AuthImage
                      path={userId ? avatarPath(userId) : null}
                      kind="avatar"
                      name={displayName}
                      size={28}
                    />
                    <Box visibleFrom="sm">
                      <Text size="sm" lh={1.2} className={classes.accountName}>
                        {displayName}
                      </Text>
                    </Box>
                    <IconChevronDown size={14} stroke={1.5} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{role || 'Signed in'}</Menu.Label>
                <Menu.Item
                  leftSection={<IconLogout size={16} stroke={1.5} />}
                  onClick={handleLogout}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {hasNav ? (
        <AppShell.Navbar p="xs" className={classes.navbar}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.value}
                variant="light"
                active={item.value === activeTab}
                className={classes.navLink}
                label={item.label}
                leftSection={Icon ? <Icon size={16} stroke={1.5} /> : null}
                rightSection={
                  item.badge ? (
                    <Badge size="sm" color="amber" variant="filled" circle>
                      {item.badge}
                    </Badge>
                  ) : null
                }
                onClick={() => {
                  onTabChange?.(item.value)
                  if (opened) toggle()
                }}
              />
            )
          })}
        </AppShell.Navbar>
      ) : null}

      <AppShell.Main className={classes.main}>{children}</AppShell.Main>
    </AppShell>
  )
}

export default PortalShell
