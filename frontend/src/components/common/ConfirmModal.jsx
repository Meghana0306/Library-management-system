import { Button, Group, Modal, Text } from '@mantine/core'

/**
 * Replaces window.confirm across the app. The confirm button is the only filled
 * button in the dialog; cancel stays a default-variant button.
 */
export const ConfirmModal = ({
  opened,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  children,
}) => (
  <Modal opened={opened} onClose={onClose} title={title} size="sm">
    {message ? <Text size="sm">{message}</Text> : null}
    {children}
    <Group justify="flex-end" gap="xs" mt="lg">
      <Button variant="default" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button color={danger ? 'red' : undefined} onClick={onConfirm} loading={loading}>
        {confirmLabel}
      </Button>
    </Group>
  </Modal>
)

export default ConfirmModal
