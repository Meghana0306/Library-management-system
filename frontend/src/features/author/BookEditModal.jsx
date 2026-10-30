import { useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { bookService } from '../../services'
import { AiSummaryButtons } from './AiSummaryButtons.jsx'
import { isAiUnavailableError, isEditableBook, nonEditableMessage } from './authorUtils.js'

const validate = (form) => {
  const errors = {}
  const title = form.title.trim()
  const genre = form.genre.trim()
  const description = form.description.trim()

  if (!title) errors.title = 'Title is required'
  else if (title.length > 255) errors.title = 'Title must not exceed 255 characters'

  if (!genre) errors.genre = 'Genre is required'
  else if (genre.length > 100) errors.genre = 'Genre must not exceed 100 characters'

  if (!description) errors.description = 'Description is required'
  else if (description.length > 1000) errors.description = 'Description must not exceed 1000 characters'

  return errors
}

/** Edit dialog for a PENDING/APPROVED book, with AI-assisted description drafts. */
export const BookEditModal = ({ book, authorId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: book?.title || '',
    genre: book?.genre || '',
    description: book?.description || '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [aiError, setAiError] = useState('')

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleGenerate = async (style) => {
    if (!form.title.trim()) {
      setErrors((prev) => ({ ...prev, title: 'Enter a title first to generate a summary' }))
      return
    }

    setGenerating(style)
    setAiError('')
    try {
      const genres = form.genre ? form.genre.split(',').map((item) => item.trim()).filter(Boolean) : []
      const response = await bookService.generateBookSummary({ title: form.title.trim(), genres, style })
      setField('description', response.data?.summary || '')
    } catch (err) {
      if (!isAiUnavailableError(err)) {
        setAiError(err?.message || 'Failed to generate summary. Please try again.')
      }
    } finally {
      setGenerating(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!book || !authorId) return

    if (!isEditableBook(book)) {
      setErrors({ submit: nonEditableMessage(book) })
      return
    }

    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const payload = {
        authorId,
        title: form.title.trim(),
        genre: form.genre.trim(),
        description: form.description.trim(),
      }
      await bookService.updateAuthorBook(authorId, book.id, payload)
      notifications.show({ message: 'Book details updated successfully.', color: 'green', withBorder: true })
      onSaved(payload)
    } catch (err) {
      setErrors({ submit: err?.message || 'Failed to update book' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title="Edit Book Details"
      size="lg"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      closeButtonProps={{ disabled: loading }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          {errors.submit ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
              {errors.submit}
            </Alert>
          ) : null}

          <TextInput
            label="Title"
            maxLength={255}
            value={form.title}
            onChange={(event) => setField('title', event.currentTarget.value)}
            error={errors.title}
            disabled={loading}
          />

          <TextInput
            label="Genre"
            maxLength={100}
            value={form.genre}
            onChange={(event) => setField('genre', event.currentTarget.value)}
            error={errors.genre}
            disabled={loading}
          />

          <AiSummaryButtons generating={generating} disabled={loading} onGenerate={handleGenerate} />

          {aiError ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
              {aiError}
            </Alert>
          ) : null}

          <Textarea
            label="Description"
            rows={6}
            maxLength={1000}
            value={form.description}
            onChange={(event) => setField('description', event.currentTarget.value)}
            error={errors.description}
            disabled={loading || Boolean(generating)}
            description={`${form.description.length} / 1000 characters`}
          />

          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={Boolean(generating)}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

export default BookEditModal
