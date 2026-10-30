import { useEffect, useState } from 'react'
import { Alert, Box, Center, Loader, Modal } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import apiClient from '../../services/api'

/**
 * Read-only PDF preview. `filePath` is either a `blob:` URL from a local File
 * (upload previews) or a server file path streamed as an authenticated blob.
 */
export const PDFPreviewModal = ({ isOpen, onClose, filePath, bookTitle }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)

  useEffect(() => {
    if (!isOpen || !filePath) {
      setPdfUrl(null)
      return undefined
    }

    if (filePath.startsWith('blob:')) {
      setPdfUrl(filePath)
      setError(null)
      setLoading(false)
      return undefined
    }

    let active = true
    let createdUrl = null
    setLoading(true)
    setError(null)
    setPdfUrl(null)

    apiClient
      .get('/files/stream', { params: { filePath }, responseType: 'blob' })
      .then((response) => {
        if (!active) return
        createdUrl = URL.createObjectURL(response.data)
        setPdfUrl(createdUrl)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err?.message || 'Failed to load PDF')
        setLoading(false)
      })

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [isOpen, filePath])

  return (
    <Modal
      opened={Boolean(isOpen)}
      onClose={onClose}
      title={bookTitle || 'Book preview'}
      size="xl"
      padding="md"
    >
      <Box h="70vh">
        {loading ? (
          <Center h="100%">
            <Loader size="sm" />
          </Center>
        ) : null}

        {error ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} stroke={1.5} />}>
            {error}
          </Alert>
        ) : null}

        {pdfUrl && !loading && !error ? (
          <iframe
            src={pdfUrl}
            title={`Preview of ${bookTitle || 'book'}`}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : null}
      </Box>
    </Modal>
  )
}

export default PDFPreviewModal
