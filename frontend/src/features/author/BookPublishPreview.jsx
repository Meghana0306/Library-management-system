import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Group, Image, Modal, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconAlertCircle, IconFile } from '@tabler/icons-react'
import { PDFPreviewModal } from '../../components/common/PDFPreviewModal.jsx'
import { formatFileSize } from './authorUtils.js'

const useLocalFileUrl = (file) => {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setUrl('')
      return undefined
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  return url
}

const Section = ({ title, children }) => (
  <Stack gap={4}>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4}>
      {title}
    </Text>
    {children}
  </Stack>
)

/** Read-only confirmation of everything about to be submitted. */
export const BookPublishPreview = ({
  opened,
  onClose,
  onSubmit,
  loading,
  submitStage,
  submitError,
  authorName,
  values,
  genres,
}) => {
  const [pdfOpen, setPdfOpen] = useState(false)
  const coverUrl = useLocalFileUrl(values.coverImage)
  const fileUrl = useLocalFileUrl(values.file)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Book Preview"
      size="lg"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      closeButtonProps={{ disabled: loading }}
    >
      <Stack gap="md">
        {submitError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
            {submitError}
          </Alert>
        ) : null}
        {loading && submitStage ? (
          <Text size="sm" c="dimmed" role="status" aria-live="polite">
            {submitStage}
          </Text>
        ) : null}

        <Section title="Title">
          <Text fw={600}>{values.title}</Text>
        </Section>

        {coverUrl ? (
          <Section title="Cover image">
            <Image src={coverUrl} alt={`Cover image for ${values.title}`} w={140} radius="sm" />
            <Text size="xs" c="dimmed">
              {values.coverImage?.name} ({formatFileSize(values.coverImage?.size)})
            </Text>
          </Section>
        ) : null}

        <Section title="Author">
          <Text size="sm">{authorName}</Text>
        </Section>

        <Section title="Genre(s)">
          <Group gap={4} wrap="wrap">
            {genres.map((genre) => (
              <Badge key={genre} color="gray">
                {genre}
              </Badge>
            ))}
          </Group>
        </Section>

        <Section title="Description">
          <Text size="sm" c="dimmed">
            {values.description}
          </Text>
        </Section>

        <Section title="File">
          <Paper withBorder p="sm">
            <UnstyledButton onClick={() => setPdfOpen(true)} style={{ width: '100%' }}>
              <Group gap="xs" wrap="nowrap">
                <IconFile size={16} stroke={1.5} />
                <Stack gap={0}>
                  <Text size="sm">
                    {values.file?.name} ({formatFileSize(values.file?.size)})
                  </Text>
                  <Text size="xs" c="dimmed">
                    Click to preview file
                  </Text>
                </Stack>
              </Group>
            </UnstyledButton>
          </Paper>
        </Section>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Edit
          </Button>
          <Button onClick={onSubmit} loading={loading}>
            Confirm &amp; Submit
          </Button>
        </Group>
      </Stack>

      <PDFPreviewModal
        isOpen={pdfOpen}
        onClose={() => setPdfOpen(false)}
        filePath={fileUrl}
        bookTitle={values.title || 'Book Preview'}
      />
    </Modal>
  )
}

export default BookPublishPreview
