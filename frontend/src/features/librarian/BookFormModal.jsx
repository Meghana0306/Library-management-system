import { useEffect, useRef, useState } from 'react'
import {
  Autocomplete,
  Button,
  Group,
  Image,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconPhoto, IconUpload } from '@tabler/icons-react'
import { bookService } from '../../services'
import { ApiError, coverPath } from '../../services/api'
import { PREDEFINED_GENRES as BASE_GENRES } from '../../utils/constants'
import { AiGate } from '../../components/common/AiGate.jsx'
import { AuthImage } from '../../components/common/AuthImage.jsx'
import { downloadBookFile } from './downloadFile.js'

const PREDEFINED_GENRES = [...BASE_GENRES, 'Others']
const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'REJECTED']
const FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]
const FILE_MAX_SIZE = 10 * 1024 * 1024
const COVER_TYPES = ['image/jpeg', 'image/png']
const COVER_MAX_SIZE = 5 * 1024 * 1024

const emptyForm = {
  title: '',
  genres: [],
  otherGenreText: '',
  description: '',
  file: null,
  coverImage: null,
  quantity: 1,
  status: 'APPROVED',
  authorName: '',
}

const notifyError = (err, fallback) => {
  notifications.show({
    title: 'Something went wrong',
    message: err instanceof ApiError ? err.message : fallback,
    color: 'red',
  })
}

/**
 * Add/edit book dialog. `mode` is 'ADD' or 'EDIT'; `book` supplies the
 * existing record (and its file/cover) in edit mode. AI summary generation is
 * gated by AiGate — each style button disables with a tooltip when AI is off.
 */
export const BookFormModal = ({ opened, mode, book, authors, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [aiGenerating, setAiGenerating] = useState(null)
  const [aiError, setAiError] = useState('')
  const [summaryAccepted, setSummaryAccepted] = useState(false)
  const [coverViewerOpen, setCoverViewerOpen] = useState(false)
  const fileInputRef = useRef(null)
  const coverInputRef = useRef(null)

  useEffect(() => {
    if (!opened) return
    if (mode === 'EDIT' && book) {
      const parts = (book.genre || '').split(',').map((g) => g.trim()).filter(Boolean)
      const known = parts.filter((g) => BASE_GENRES.includes(g))
      const other = parts.filter((g) => !BASE_GENRES.includes(g))
      setForm({
        title: book.title || '',
        genres: other.length > 0 ? [...known, 'Others'] : [...known],
        otherGenreText: other.join(', '),
        description: book.description || '',
        file: null,
        coverImage: null,
        quantity: book.quantity || 1,
        status: book.status || 'APPROVED',
        authorName: '',
      })
    } else {
      setForm(emptyForm)
    }
    setErrors({})
    setAiError('')
    setSummaryAccepted(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (coverInputRef.current) coverInputRef.current.value = ''
  }, [opened, mode, book])

  useEffect(() => {
    if (!form.coverImage) {
      setCoverPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(form.coverImage)
    setCoverPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [form.coverImage])

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'description') setSummaryAccepted(false)
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const toggleGenre = (genre) => {
    setForm((prev) => {
      const has = prev.genres.includes(genre)
      return {
        ...prev,
        genres: has ? prev.genres.filter((g) => g !== genre) : [...prev.genres, genre],
        otherGenreText: genre === 'Others' && has ? '' : prev.otherGenreText,
      }
    })
    setErrors((prev) => ({ ...prev, genres: '', otherGenreText: '' }))
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (!FILE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, file: 'Upload a PDF, TXT, or DOCX file.' }))
      return
    }
    if (file.size > FILE_MAX_SIZE) {
      setErrors((prev) => ({ ...prev, file: 'File size must be under 10MB.' }))
      return
    }
    setForm((prev) => ({ ...prev, file }))
    setErrors((prev) => ({ ...prev, file: '' }))
  }

  const handleCoverChange = (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (!COVER_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, coverImage: 'Upload a JPG or PNG image.' }))
      return
    }
    if (file.size > COVER_MAX_SIZE) {
      setErrors((prev) => ({ ...prev, coverImage: 'Cover image must be under 5MB.' }))
      return
    }
    setForm((prev) => ({ ...prev, coverImage: file }))
    setErrors((prev) => ({ ...prev, coverImage: '' }))
  }

  const selectedGenres = () => {
    const selected = form.genres.filter((g) => g !== 'Others')
    if (form.genres.includes('Others') && form.otherGenreText.trim()) selected.push(form.otherGenreText.trim())
    return selected
  }

  const validate = () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required'
    if (form.genres.length === 0) next.genres = 'Select at least one genre'
    if (form.genres.includes('Others') && !form.otherGenreText.trim()) {
      next.otherGenreText = 'Specify the genre in Others'
    }
    if (!form.description.trim()) {
      next.description = 'Description is required'
    } else if (form.description.trim().length < 50) {
      next.description = 'Description must be at least 50 characters'
    } else if (form.description.trim().length > 5000) {
      next.description = 'Description must not exceed 5000 characters'
    }
    if (mode === 'ADD' && !form.file) next.file = 'Please upload a book file'
    if (mode === 'ADD' && !form.authorName.trim()) next.authorName = 'Enter an author name'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleGenerateSummary = async (style) => {
    if (!form.title.trim()) {
      setErrors((prev) => ({ ...prev, title: 'Enter a title first' }))
      return
    }
    if (mode === 'ADD' && !form.file) {
      setAiError('Upload the book file first to generate a summary from the document.')
      return
    }
    setAiGenerating(style)
    setAiError('')
    setSummaryAccepted(false)
    try {
      const response = await bookService.generateBookSummary({
        title: form.title.trim(),
        genres: selectedGenres(),
        style,
        file: form.file,
      })
      setForm((prev) => ({ ...prev, description: response.data?.summary || '' }))
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : 'Failed to generate summary')
    } finally {
      setAiGenerating(null)
    }
  }

  const handleAcceptSummary = () => {
    setSummaryAccepted(true)
    setTimeout(() => setSummaryAccepted(false), 2500)
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('title', form.title.trim())
      selectedGenres().forEach((g) => payload.append('genres', g))
      payload.append('description', form.description.trim())
      payload.append('quantity', form.quantity || 1)
      if (mode === 'ADD') {
        payload.append('authorName', form.authorName.trim())
      } else {
        payload.append('status', form.status)
      }
      if (form.file) payload.append('file', form.file)
      if (form.coverImage) payload.append('coverImage', form.coverImage)

      if (mode === 'ADD') {
        await bookService.createLibrarianBook(payload)
        notifications.show({ title: 'Done', message: 'Book added successfully.', color: 'green' })
      } else {
        await bookService.updateLibrarianBook(book.id, payload)
        notifications.show({ title: 'Done', message: 'Book updated successfully.', color: 'green' })
      }
      onSaved()
    } catch (err) {
      notifyError(err, 'Failed to save book.')
    } finally {
      setSaving(false)
    }
  }

  const authorNames = (authors || []).map((a) => a.fullName || a.username).filter(Boolean)

  const handleDownloadCurrentFile = async () => {
    try {
      await downloadBookFile(book.filePath, book.title)
    } catch (err) {
      notifyError(err, 'Failed to download the file.')
    }
  }

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={mode === 'ADD' ? 'Add new book' : 'Edit book details'} size="xl">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: mode === 'ADD' ? 3 : 2 }}>
            <TextInput
              label="Title"
              required
              value={form.title}
              onChange={(e) => setField('title', e.currentTarget.value)}
              error={errors.title}
            />
            {mode === 'ADD' ? (
              <Autocomplete
                label="Author"
                required
                placeholder="Enter author name"
                data={authorNames}
                value={form.authorName}
                onChange={(value) => setField('authorName', value)}
                error={errors.authorName}
              />
            ) : (
              <Select
                label="Status"
                data={STATUS_OPTIONS}
                value={form.status}
                allowDeselect={false}
                onChange={(value) => setField('status', value)}
              />
            )}
            <NumberInput
              label="Quantity"
              min={1}
              value={form.quantity}
              onChange={(value) => setField('quantity', typeof value === 'number' ? value : 1)}
            />
          </SimpleGrid>

          <Stack gap={6}>
            <Text size="sm" fw={500}>Genres <Text span c="red">*</Text></Text>
            <Group gap={6}>
              {PREDEFINED_GENRES.map((genre) => (
                <Button
                  key={genre}
                  size="xs"
                  radius="xl"
                  variant={form.genres.includes(genre) ? 'filled' : 'default'}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </Button>
              ))}
            </Group>
            {errors.genres ? <Text size="xs" c="red">{errors.genres}</Text> : null}
          </Stack>

          {form.genres.includes('Others') ? (
            <TextInput
              label="Other genre"
              required
              value={form.otherGenreText}
              onChange={(e) => setField('otherGenreText', e.currentTarget.value)}
              error={errors.otherGenreText}
            />
          ) : null}

          <Textarea
            label="Description"
            required
            rows={5}
            value={form.description}
            onChange={(e) => setField('description', e.currentTarget.value)}
            error={errors.description}
            description={`${form.description.length}/5000 characters`}
          />

          <Group gap="xs" wrap="wrap">
            <Text size="sm" c="dimmed">Generate summary:</Text>
            {['short', 'medium', 'detailed'].map((style) => (
              <AiGate key={style} feature="summary" mode="disable">
                <Button
                  size="xs"
                  variant="default"
                  loading={aiGenerating === style}
                  onClick={() => handleGenerateSummary(style)}
                >
                  {style}
                </Button>
              </AiGate>
            ))}
            <Button size="xs" variant="light" color="green" onClick={handleAcceptSummary}>
              Use summary
            </Button>
          </Group>
          {summaryAccepted ? <Text size="xs" c="green">Summary finalized. You can still edit it before saving.</Text> : null}
          {aiError ? <Text size="xs" c="red">{aiError}</Text> : null}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Book file{mode === 'ADD' ? <Text span c="red"> *</Text> : null}
              </Text>
              <Button
                component="label"
                variant="default"
                size="sm"
                leftSection={<IconUpload size={16} stroke={1.5} />}
              >
                {form.file ? form.file.name : 'Choose file'}
                <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
              </Button>
              {errors.file ? <Text size="xs" c="red">{errors.file}</Text> : null}
            </Stack>

            <Stack gap={4}>
              <Text size="sm" fw={500}>Cover image</Text>
              <Button
                component="label"
                variant="default"
                size="sm"
                leftSection={<IconPhoto size={16} stroke={1.5} />}
              >
                {form.coverImage ? form.coverImage.name : 'Choose cover'}
                <input ref={coverInputRef} type="file" hidden onChange={handleCoverChange} />
              </Button>
              {coverPreviewUrl ? <Image src={coverPreviewUrl} alt="Cover preview" h={80} w="auto" fit="contain" /> : null}
              {errors.coverImage ? <Text size="xs" c="red">{errors.coverImage}</Text> : null}
            </Stack>
          </SimpleGrid>

          {mode === 'EDIT' && book?.filePath ? (
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                leftSection={<IconDownload size={14} stroke={1.5} />}
                onClick={handleDownloadCurrentFile}
              >
                Download current file
              </Button>
              <Button size="xs" variant="default" onClick={() => setCoverViewerOpen(true)}>
                View current cover
              </Button>
            </Group>
          ) : null}

          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving}>
              {mode === 'ADD' ? 'Add book' : 'Save changes'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={coverViewerOpen} onClose={() => setCoverViewerOpen(false)} title="Current cover" size="sm">
        {book ? <AuthImage path={coverPath(book.id)} kind="cover" size={320} /> : null}
      </Modal>
    </>
  )
}

export default BookFormModal
