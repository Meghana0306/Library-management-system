import { Box, Paper, Stack, Text, ThemeIcon } from '@mantine/core'

/**
 * Line-art shelf: three books and a rule. Strokes use `currentColor` so the
 * glyph picks up whatever muted colour the surrounding scheme provides.
 */
const ShelfGlyph = ({ size = 80 }) => (
  <Box
    component="svg"
    viewBox="0 0 64 64"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    role="presentation"
  >
    <path d="M14 20h8v28h-8z" />
    <path d="M24 24h7v24h-7z" />
    <path d="M33.5 27.5l6.8-1.9 6 21.6-6.8 1.9z" />
    <path d="M14 26h8M24 30h7M35 33l12-3.3" />
    <path d="M8 48h48" />
    <path d="M11 48v6M53 48v6" />
  </Box>
)

/**
 * The single empty-state used everywhere: a bordered panel, one glyph, one
 * line of explanation and at most one action. `icon` still overrides the glyph
 * with a tabler icon where a specific one reads better than the shelf.
 */
export const EmptyState = ({
  icon: Icon,
  title = 'Nothing here yet',
  description,
  action,
  compact = false,
}) => (
  <Paper withBorder radius="md" p={compact ? 'md' : 'xl'}>
    <Stack align="center" gap="xs">
      {Icon ? (
        <ThemeIcon variant="light" color="gray" size={36} radius="md">
          <Icon size={18} stroke={1.5} />
        </ThemeIcon>
      ) : (
        <Box c="dimmed" opacity={0.7} lh={0}>
          <ShelfGlyph size={compact ? 56 : 80} />
        </Box>
      )}
      <Text fw={600} size="sm">
        {title}
      </Text>
      {description ? (
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          {description}
        </Text>
      ) : null}
      {action}
    </Stack>
  </Paper>
)

export default EmptyState
