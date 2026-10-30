import { Group, Paper, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core'

/** Compact metric tile: label, one number, optional supporting line. */
export const StatCard = ({ label, value, hint, icon: Icon, loading = false }) => (
  <Paper withBorder radius="sm" p="md">
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4}>
          {label}
        </Text>
        {loading ? (
          <Skeleton height={26} width={72} radius="sm" mt={4} />
        ) : (
          <Text fz={24} fw={600} lh={1.2}>
            {value}
          </Text>
        )}
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
      {Icon ? (
        <ThemeIcon variant="light" color="gray" size={32} radius="sm">
          <Icon size={16} stroke={1.5} />
        </ThemeIcon>
      ) : null}
    </Group>
  </Paper>
)

export default StatCard
