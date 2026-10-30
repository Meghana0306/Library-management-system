import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconFile, IconPhoto } from '@tabler/icons-react'
import { bookService } from '../../services'
import { PREDEFINED_GENRES as BASE_GENRES } from '../../utils/constants'
import { AiSummaryButtons } from './AiSummaryButtons.jsx'
import { FileDropZone } from './FileDropZone.jsx'
import { BookPublishPreview } from './BookPublishPreview.jsx'
import { PublishSuccess } from './PublishSuccess.jsx'
import { useBookDraft } from './useBookDraft.js'
import { isAiUnavailableError } from './authorUtils.js'

const PREDEFINED_GENRES = [...BASE_GENRES, 'Others']

const BOOK_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]
const BOOK_FILE_MAX_BYTES = 10 * 1024 * 1024
const COVER_TYPES = ['image/jpeg', 'image/png']
const COVER_MAX_BYTES = 5 * 1024 * 1024

const EMPTY_FORM = {
  title: '',
  genres: [],
  otherGenreText: '',
  description: '',
  file: null,
  coverImage: null,
}

const friendlySubmitError = (message) => {
  if (!message) return 'Failed to submit book'
  if (message.toLowerCase().includes('author not found')) {
    return 'Your author session is no longer valid. Please log out, sign in again, and retry.'
  }
  return message
}

/** Three-step publishing flow: form → preview → success. */
export const BookPublishing = ({ authorId, authorName, onSubmitSuccess, onCancel }) => {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitStage, setSubmitStage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [aiError, setAiError] = useState('')
  const [summaryAccepted, setSummaryAccepted] = useState(false)

  const restoreDraft = useCallback((draft) => {
    setForm((prev) => ({ ...prev, ...draft, file: null, coverImage: null }))
  }, [])

  const draft = useBookDraft({ authorId, values: form, active: step < 3, onRestore: restoreDraft })

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const selectedGenres = () => {
    const chosen = form.genres.filter((genre) => genre !== 'Others')
    if (form.genres.includes('Others') && form.otherGenreText.trim()) {
      chosen.push(form.otherGenreText.trim())
    }
    return chosen
  }

  const toggleGenre = (genre) => {
    setForm((prev) => {
      const has = prev.genres.includes(genre)
      return {
        ...prev,
        genres: has ? prev.genres.filter((item) => item !== genre) : [...prev.genres, genre],
        otherGenreText: genre === 'Others' && has ? '' : prev.otherGenreText,
      }
    })
    if (errors.genres || errors.otherGenreText) {
      setErrors((prev) => ({ ...prev, genres: '', otherGenreText: '' }))
    }
  }

  const handleBookFile = (file) => {
    if (!BOOK_FILE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, file: 'Please upload a PDF, TXT, or DOCX file' }))
      return
    }
    if (file.size > BOOK_FILE_MAX_BYTES) {
      setErrors((prev) => ({ ...prev, file: 'File size must be less than 10MB' }))
      return
    }
    setField('file', file)
  }

  const handleCoverFile = (file) => {
    if (!COVER_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, coverImage: 'Please upload a JPG or PNG image file' }))
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      setErrors((prev) => ({ ...prev, coverImage: 'Cover image size must be less than 5MB' }))
      return
    }
    setField('coverImage', file)
  }

  const handleGenerate = async (style) => {
    if (!form.title.trim()) {
      setErrors((prev) => ({ ...prev, title: 'Enter a title first to generate a summary' }))
      return
    }

    setGenerating(style)
    setAiError('')
    setSummaryAccepted(false)
    try {
      const response = await bookService.generateBookSummary({
        title: form.title.trim(),
        genres: selectedGenres(),
        style,
      })
      setField('description', response.data?.summary || '')
    } catch (err) {
      if (!isAiUnavailableError(err)) {
        setAiError(err?.message || 'Failed to generate summary. Please try again.')
      }
    } finally {
      setGenerating(null)
    }
  }

  const validate = () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required'
    if (form.genres.length === 0) next.genres = 'Please select at least one genre'
    if (form.genres.includes('Others') && !form.otherGenreText.trim()) {
      next.otherGenreText = 'Please specify your genre in Others'
    }
    if (!form.description.trim()) next.description = 'Description is required'
    else if (form.description.trim().length < 50) next.description = 'Description must be at least 50 characters'
    else if (form.description.length > 5000) next.description = 'Description must not exceed 5000 characters'
    if (!form.file) next.file = 'Please upload a book file'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    if (!authorId) {
      setErrors((prev) => ({ ...prev, submit: 'Author session is invalid. Please sign in again.' }))
      return
    }

    setLoading(true)
    setSubmitStage('Uploading and saving book...')
    setErrors((prev) => ({ ...prev, submit: '' }))
    try {
      const payload = new FormData()
      payload.append('authorId', String(authorId))
      payload.append('title', form.title)
      payload.append('description', form.description)
      selectedGenres().forEach((genre) => payload.append('genres', genre))
      payload.append('file', form.file)
      if (form.coverImage) payload.append('coverImage', form.coverImage)

      await bookService.submitBook(payload)

      draft.clear()
      setStep(3)
      setPreviewOpen(false)
      setErrors({})
    } catch (err) {
      setErrors({ submit: friendlySubmitError(err?.message) })
    } finally {
      setLoading(false)
      setSubmitStage('')
    }
  }

  if (step === 3) {
    return (
      <PublishSuccess
        title={form.title}
        onBackToDashboard={() => {
          setForm(EMPTY_FORM)
          setStep(1)
          onSubmitSuccess?.()
          onCancel?.()
        }}
      />
    )
  }

  const genreSummary = selectedGenres()

  return (
    <Stack gap="md">
      {errors.submit ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
          {errors.submit}
        </Alert>
      ) : null}

      <Paper withBorder p="sm">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="xs" c="dimmed">
            Auto-save {draft.savedAt ? `active (last saved ${new Date(draft.savedAt).toLocaleTimeString()})` : 'active'}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => {
              setForm(EMPTY_FORM)
              setErrors({})
              draft.clear('Draft cleared.')
            }}
          >
            Discard Draft
          </Button>
        </Group>
        {draft.notice ? (
          <Text size="xs" c="dimmed" mt={4}>
            {draft.notice}
          </Text>
        ) : null}
      </Paper>

      <TextInput
        label="Book Title"
        withAsterisk
        placeholder="Enter the book title"
        value={form.title}
        onChange={(event) => setField('title', event.currentTarget.value)}
        error={errors.title}
      />

      <TextInput label="Author Name" value={authorName || ''} disabled />

      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Genre(s) <Text span size="xs" c="dimmed">Select all that apply</Text>
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs" verticalSpacing={4}>
          {PREDEFINED_GENRES.map((genre) => (
            <Checkbox
              key={genre}
              label={genre}
              checked={form.genres.includes(genre)}
              onChange={() => toggleGenre(genre)}
            />
          ))}
        </SimpleGrid>
        {form.genres.includes('Others') ? (
          <TextInput
            label="Please specify"
            withAsterisk
            placeholder="Enter custom genre"
            value={form.otherGenreText}
            onChange={(event) => setField('otherGenreText', event.currentTarget.value)}
            error={errors.otherGenreText}
          />
        ) : null}
        {errors.genres ? (
          <Text size="xs" c="red">
            {errors.genres}
          </Text>
        ) : null}
        {genreSummary.length > 0 ? (
          <Text size="xs" c="dimmed">
            Selected: {genreSummary.join(', ')}
          </Text>
        ) : null}
      </Stack>

      <Stack gap={6}>
        <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
          <Text size="sm" fw={500}>
            Description / Abstract <Text span size="xs" c="dimmed">Minimum 50 characters</Text>
          </Text>
          <AiSummaryButtons
            label="AI Generate"
            generating={generating}
            disabled={loading}
            onGenerate={handleGenerate}
          />
        </Group>

        {aiError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
            {aiError}
          </Alert>
        ) : null}

        <Textarea
          rows={6}
          placeholder="Provide a brief summary or abstract of your book, or use AI to generate one..."
          value={form.description}
          onChange={(event) => {
            setField('description', event.currentTarget.value)
            setSummaryAccepted(false)
          }}
          error={errors.description}
        />

        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="xs" c={form.description.length > 5000 ? 'red' : 'dimmed'}>
            {form.description.length} / 5000 characters
          </Text>
          {form.description.length >= 50 && !summaryAccepted ? (
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => {
                setSummaryAccepted(true)
                setTimeout(() => setSummaryAccepted(false), 3000)
              }}
            >
              Accept Summary
            </Button>
          ) : null}
        </Group>

        {summaryAccepted ? (
          <Text size="xs" c="green">
            Summary accepted! You can still edit it before submitting.
          </Text>
        ) : null}
      </Stack>

      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Upload Book File <Text span size="xs" c="dimmed">PDF, TXT, or DOCX (max 10MB)</Text>
        </Text>
        <FileDropZone
          inputId="book-file"
          accept=".pdf,.txt,.doc,.docx"
          file={form.file}
          onSelect={handleBookFile}
          onClear={() => setField('file', null)}
          prompt="Click to upload or drag and drop"
          replaceLabel="Choose another file"
          icon={IconFile}
        />
        {errors.file ? (
          <Text size="xs" c="red">
            {errors.file}
          </Text>
        ) : null}
      </Stack>

      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Upload Cover Image (Optional) <Text span size="xs" c="dimmed">JPG or PNG (max 5MB)</Text>
        </Text>
        <FileDropZone
          inputId="cover-image-file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          file={form.coverImage}
          onSelect={handleCoverFile}
          onClear={() => setField('coverImage', null)}
          prompt="Click to upload an optional cover image"
          replaceLabel="Choose another image"
          icon={IconPhoto}
        />
        {errors.coverImage ? (
          <Text size="xs" c="red">
            {errors.coverImage}
          </Text>
        ) : null}
      </Stack>

      <Group justify="flex-end" gap="xs">
        {onCancel ? (
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        ) : null}
        <Button
          onClick={() => {
            if (validate()) setPreviewOpen(true)
          }}
          disabled={loading}
        >
          Preview &amp; Submit
        </Button>
      </Group>

      <BookPublishPreview
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        submitStage={submitStage}
        submitError={errors.submit}
        authorName={authorName}
        values={form}
        genres={genreSummary}
      />
    </Stack>
  )
}

export default BookPublishing
