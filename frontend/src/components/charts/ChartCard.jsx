import { Group, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { ResponsiveContainer } from 'recharts'

/**
 * Bordered panel around a single recharts chart, with the loading and empty
 * states handled here so individual charts stay declarative.
 */
export const ChartCard = ({
  title,
  description,
  height = 260,
  loading = false,
  isEmpty = false,
  emptyLabel = 'No data for this period yet.',
  actions,
  children,
}) => (
  <Paper withBorder radius="sm" p="md">
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="sm">
      <Stack gap={2}>
        <Text fw={600} size="sm">
          {title}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="xs">{actions}</Group> : null}
    </Group>

    {loading ? (
      <Skeleton height={height} radius="sm" />
    ) : isEmpty ? (
      <Group h={height} justify="center">
        <Text size="sm" c="dimmed">
          {emptyLabel}
        </Text>
      </Group>
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    )}
  </Paper>
)

export default ChartCard
