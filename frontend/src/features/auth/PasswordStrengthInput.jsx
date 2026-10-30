import { useState } from 'react'
import { Group, PasswordInput, Popover, Progress, Stack, Text } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { getPasswordStrengthFeedback, validatePassword } from '../../utils/passwordValidator'

const REQUIREMENTS = [
  { re: /.{8,}/, label: 'At least 8 characters' },
  { re: /[A-Z]/, label: 'One uppercase letter' },
  { re: /[a-z]/, label: 'One lowercase letter' },
  { re: /\d/, label: 'One digit' },
  { re: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, label: 'One special character' },
]

const RequirementRow = ({ meets, label }) => (
  <Group gap={6} wrap="nowrap">
    {meets ? (
      <IconCheck size={16} stroke={1.5} color="var(--mantine-color-green-light-color)" />
    ) : (
      <IconX size={16} stroke={1.5} color="var(--mantine-color-red-light-color)" />
    )}
    <Text size="xs" c={meets ? 'dimmed' : undefined}>
      {label}
    </Text>
  </Group>
)

/**
 * Registration password field: strength meter + colour + label sourced from
 * utils/passwordValidator, plus a requirement checklist popover shown while
 * the field is focused.
 */
export const PasswordStrengthInput = ({
  label = 'Password',
  placeholder = 'Min 8 chars, uppercase, lowercase, digit, special char',
  value,
  onChange,
  error,
  disabled,
  autoComplete = 'new-password',
}) => {
  const [focused, setFocused] = useState(false)
  const { strength } = validatePassword(value)
  const feedback = getPasswordStrengthFeedback(strength)

  return (
    <Stack gap={4}>
      <Popover opened={focused && Boolean(value)} position="bottom" width="target" withinPortal>
        <Popover.Target>
          <PasswordInput
            label={label}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            error={error}
            disabled={disabled}
            autoComplete={autoComplete}
          />
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={6}>
            {REQUIREMENTS.map((req) => (
              <RequirementRow key={req.label} meets={req.re.test(value || '')} label={req.label} />
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
      {value ? (
        <Stack gap={2}>
          <Progress value={feedback.percent} color={feedback.color} size={4} />
          <Text size="xs" c="dimmed">
            {feedback.label}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  )
}

export default PasswordStrengthInput
