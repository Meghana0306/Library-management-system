import { Button, Group, Stack, Text, ThemeIcon, Timeline, Title } from '@mantine/core'
import { IconBook2, IconCheck, IconClock } from '@tabler/icons-react'

const STEPS = [
  { title: 'Submitted', description: 'Your book is now in the review queue', icon: IconCheck },
  { title: 'Under Review', description: 'A librarian will review your submission', icon: IconClock },
  { title: 'Published', description: 'Your book will be available to students', icon: IconBook2 },
]

/** Step 3 of the publishing flow. */
export const PublishSuccess = ({ title, onBackToDashboard }) => (
  <Stack gap="md">
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" color="green" size={32} radius="sm">
        <IconCheck size={16} stroke={1.5} />
      </ThemeIcon>
      <Title order={3}>Book Submitted Successfully!</Title>
    </Group>

    <Stack gap={2}>
      <Text fw={600}>&quot;{title}&quot;</Text>
      <Text size="sm" c="dimmed">
        has been submitted for librarian approval
      </Text>
    </Stack>

    <Timeline active={0} bulletSize={24} lineWidth={2}>
      {STEPS.map(({ title: stepTitle, description, icon: Icon }) => (
        <Timeline.Item key={stepTitle} bullet={<Icon size={16} stroke={1.5} />} title={stepTitle}>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>

    <Text size="sm" c="dimmed">
      You can track the status in your dashboard while it is being reviewed.
    </Text>

    <Group justify="flex-end">
      <Button onClick={onBackToDashboard}>Back to Dashboard</Button>
    </Group>
  </Stack>
)

export default PublishSuccess
