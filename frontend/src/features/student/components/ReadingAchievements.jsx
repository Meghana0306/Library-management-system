import { Group, Paper, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core'
import {
  IconAward,
  IconBook,
  IconBooks,
  IconCircleCheck,
  IconLock,
  IconTrophy,
  IconWorld,
} from '@tabler/icons-react'

const ACHIEVEMENTS = [
  { id: 'first_book', icon: IconBook, label: 'First Book', desc: 'Borrowed your first book', check: (h) => h.length >= 1 },
  { id: 'five_books', icon: IconBooks, label: '5-Book Club', desc: 'Borrowed 5 books', check: (h) => h.length >= 5 },
  { id: 'ten_books', icon: IconTrophy, label: '10-Book Club', desc: 'Borrowed 10 books', check: (h) => h.length >= 10 },
  {
    id: 'genre_explorer',
    icon: IconWorld,
    label: 'Genre Explorer',
    desc: 'Read books in 3+ different genres',
    check: (h) => new Set(h.map((r) => r.genre).filter(Boolean)).size >= 3,
  },
  {
    id: 'speed_reader',
    icon: IconAward,
    label: 'Speed Reader',
    desc: 'Finished a book in under 3 days',
    check: (h) => h.some((r) => r.status?.toUpperCase() === 'RETURNED' && r.readingDurationDays != null && r.readingDurationDays <= 3),
  },
  {
    id: 'completionist',
    icon: IconCircleCheck,
    label: 'Completionist',
    desc: 'Reached 100% progress on a book',
    check: (h) => h.some((r) => Number(r.readingProgress) >= 100),
  },
]

/** Earned/locked reading achievements, rendered as a dense wrapped chip list (not a card grid). */
export const ReadingAchievements = ({ history }) => (
  <Group gap="sm" wrap="wrap">
    {ACHIEVEMENTS.map((achievement) => {
      const earned = achievement.check(history)
      const Icon = achievement.icon
      return (
        <Tooltip key={achievement.id} label={achievement.desc}>
          <Paper withBorder p="sm" radius="sm" w={160} opacity={earned ? 1 : 0.55}>
            <Stack gap={4} align="center">
              <ThemeIcon variant="light" color={earned ? 'forest' : 'gray'} size={32} radius="sm">
                {earned ? <Icon size={18} stroke={1.5} /> : <IconLock size={18} stroke={1.5} />}
              </ThemeIcon>
              <Text size="xs" fw={600} ta="center">{achievement.label}</Text>
            </Stack>
          </Paper>
        </Tooltip>
      )
    })}
  </Group>
)

export default ReadingAchievements
