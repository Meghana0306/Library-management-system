import { useNavigate } from 'react-router-dom'
import { Button, Container, Stack, Text, Title } from '@mantine/core'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Container size="sm" py={64}>
      <Stack gap="sm" align="flex-start">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.6}>
          404
        </Text>
        <Title order={1}>Page not found</Title>
        <Text size="sm" c="dimmed">
          That address does not exist. It may have been moved or the link may be out of date.
        </Text>
        <Button variant="default" onClick={() => navigate('/')}>
          Back to portals
        </Button>
      </Stack>
    </Container>
  )
}

export default NotFoundPage
