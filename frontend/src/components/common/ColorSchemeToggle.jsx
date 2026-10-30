import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

/**
 * Light/dark switch. Used in the portal header band and on the signed-out
 * pages (landing, 404, portal sign-in) so the choice is reachable before
 * anyone has an account.
 */
export const ColorSchemeToggle = ({ variant = 'default' }) => {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computed === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Tooltip label={label}>
      <ActionIcon
        variant={variant}
        aria-label={label}
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <IconSun size={16} stroke={1.5} /> : <IconMoon size={16} stroke={1.5} />}
      </ActionIcon>
    </Tooltip>
  )
}

export default ColorSchemeToggle
