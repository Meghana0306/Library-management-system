import { useRef, useState } from 'react'
import { ActionIcon, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconFile, IconUpload, IconX } from '@tabler/icons-react'
import { formatFileSize } from './authorUtils.js'

/**
 * Click-or-drag file field. Type and size validation stays with the caller so
 * the book file and the cover image can enforce their own rules.
 */
export const FileDropZone = ({
  inputId,
  accept,
  file,
  onSelect,
  onClear,
  prompt,
  replaceLabel,
  icon: Icon = IconFile,
}) => {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) onSelect(dropped)
  }

  if (file) {
    return (
      <Paper withBorder p="sm">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="xs" wrap="nowrap">
            <Icon size={16} stroke={1.5} />
            <Stack gap={0}>
              <Text size="sm">{file.name}</Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(file.size)}
              </Text>
            </Stack>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <UnstyledButton onClick={() => inputRef.current?.click()}>
              <Text size="xs" c="var(--mantine-primary-color-light-color)">
                {replaceLabel}
              </Text>
            </UnstyledButton>
            <ActionIcon variant="subtle" color="gray" aria-label={`Remove ${file.name}`} onClick={onClear}>
              <IconX size={16} stroke={1.5} />
            </ActionIcon>
          </Group>
        </Group>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(event) => {
            const selected = event.target.files?.[0]
            event.target.value = ''
            if (selected) onSelect(selected)
          }}
        />
      </Paper>
    )
  }

  return (
    <Paper
      withBorder
      p="lg"
      bg={dragging ? 'var(--mantine-color-forest-light)' : undefined}
      style={{ borderStyle: 'dashed', cursor: 'pointer' }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <Group justify="center" gap="xs">
        <IconUpload size={16} stroke={1.5} />
        <Text size="sm" c="dimmed">
          {prompt}
        </Text>
      </Group>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(event) => {
          const selected = event.target.files?.[0]
          event.target.value = ''
          if (selected) onSelect(selected)
        }}
      />
    </Paper>
  )
}

export default FileDropZone
