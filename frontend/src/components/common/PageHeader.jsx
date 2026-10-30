import { Group, Stack, Text, Title } from '@mantine/core'

/**
 * Left-aligned page heading. `actions` sits on the right of the title row and
 * should carry at most one filled button.
 */
export const PageHeader = ({ title, description, actions, order = 2 }) => (
  <Stack gap={4} mb="md">
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Title order={order}>{title}</Title>
      {actions ? <Group gap="xs">{actions}</Group> : null}
    </Group>
    {description ? (
      <Text size="sm" c="dimmed" maw={720}>
        {description}
      </Text>
    ) : null}
  </Stack>
)

export default PageHeader
