import { Button, Group, Text } from '@mantine/core'
import { AiGate } from '../../components/common/AiGate.jsx'

export const SUMMARY_STYLES = [
  { style: 'short', label: 'Short', hint: '40–80 words — a punchy teaser' },
  { style: 'medium', label: 'Medium', hint: '150–250 words — engaging catalog description' },
  { style: 'detailed', label: 'Detailed', hint: '300–500 words — comprehensive synopsis' },
]

/**
 * The three summary-generation styles. Each button is wrapped in AiGate so the
 * whole row turns into a disabled, explained control when the server reports no
 * AI key, rather than failing on click.
 */
export const AiSummaryButtons = ({ generating, disabled, onGenerate, label = 'AI summary' }) => (
  <Group gap={6} wrap="wrap">
    <Text size="xs" c="dimmed">
      {label}
    </Text>
    {SUMMARY_STYLES.map(({ style, label: styleLabel, hint }) => (
      <AiGate key={style} feature="summary" mode="disable">
        <Button
          size="compact-xs"
          variant="default"
          title={hint}
          loading={generating === style}
          disabled={Boolean(generating) || disabled}
          onClick={() => onGenerate(style)}
        >
          {styleLabel}
        </Button>
      </AiGate>
    ))}
  </Group>
)

export default AiSummaryButtons
