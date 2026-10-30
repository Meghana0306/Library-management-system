import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconBooks, IconFeather, IconShieldLock } from '@tabler/icons-react'
import { ColorSchemeToggle } from '../components/common/ColorSchemeToggle.jsx'
import classes from './landing.module.css'

const ROLES = [
  {
    id: 'student',
    label: 'Student / Staff',
    description: 'Browse the catalogue, borrow and read books, track your reading history.',
    icon: IconBooks,
    path: '/student',
  },
  {
    id: 'author',
    label: 'Author',
    description: 'Submit books for approval, follow their performance and reply to reviews.',
    icon: IconFeather,
    path: '/author',
  },
  {
    id: 'librarian',
    label: 'Librarian',
    description: 'Approve submissions, manage the collection, users and book requests.',
    icon: IconShieldLock,
    path: '/librarian',
  },
]

export const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <Box mih="100vh">
      <Container size="lg" py={56}>
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={10} maw={640}>
              <Group gap={8} wrap="nowrap">
                <ThemeIcon variant="transparent" color="amber" size={22} p={0}>
                  <IconBooks size={20} stroke={1.5} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.6}>
                  Library Management System
                </Text>
              </Group>
              <Title order={1}>Choose your reading room.</Title>
              <Text className={classes.tagline}>
                One catalogue, three ways in — readers borrow, authors publish, librarians
                keep the collection honest.
              </Text>
            </Stack>
            <ColorSchemeToggle />
          </Group>

          <Divider />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {ROLES.map((role) => {
              const Icon = role.icon
              return (
                <Card key={role.id} className={classes.portalCard} padding="lg">
                  <Box className={classes.spine} />
                  <Stack gap="sm" align="flex-start" h="100%">
                    <ThemeIcon variant="light" color="forest" size={34} radius="md">
                      <Icon size={18} stroke={1.5} />
                    </ThemeIcon>
                    <Title order={3}>{role.label}</Title>
                    <Text size="sm" c="dimmed" style={{ flexGrow: 1 }}>
                      {role.description}
                    </Text>
                    <Button variant="default" onClick={() => navigate(role.path)}>
                      Continue
                    </Button>
                  </Stack>
                </Card>
              )
            })}
          </SimpleGrid>

          <Text size="xs" c="dimmed">
            Demo deployment — accounts are self-registered from each portal&apos;s login page.
          </Text>
        </Stack>
      </Container>
    </Box>
  )
}

export default LandingPage
