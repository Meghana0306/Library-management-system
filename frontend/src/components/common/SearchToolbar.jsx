import { ActionIcon, Group, TextInput } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'

/**
 * Search field plus an inline slot for filter controls. Children are rendered
 * to the right of the input and wrap on narrow viewports.
 */
export const SearchToolbar = ({
  value,
  onChange,
  placeholder = 'Search',
  width = 260,
  children,
  actions,
}) => (
  <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap" mb="sm">
    <Group gap="sm" align="flex-end" wrap="wrap">
      <TextInput
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        w={width}
        leftSection={<IconSearch size={16} stroke={1.5} />}
        rightSection={
          value ? (
            <ActionIcon variant="subtle" color="gray" onClick={() => onChange('')} aria-label="Clear search">
              <IconX size={16} stroke={1.5} />
            </ActionIcon>
          ) : null
        }
      />
      {children}
    </Group>
    {actions ? <Group gap="xs">{actions}</Group> : null}
  </Group>
)

export default SearchToolbar
