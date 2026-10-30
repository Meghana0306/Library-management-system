import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react'
import { borrowService } from '../../services'
import { EmptyState } from '../../components/common/EmptyState.jsx'

const MAX_BORROW_LIMIT = 5

/** Confirmation step shown in place of the Available Books grid once books are selected. */
export const BorrowBook = ({ books = [], userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [borrowCount, setBorrowCount] = useState(0)
  const [borrowDurationDays, setBorrowDurationDays] = useState(14)
  const [minSelfReturnSeconds, setMinSelfReturnSeconds] = useState(0)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const selectedBooks = books.filter((book, index, arr) => book?.id && arr.findIndex((item) => item?.id === book.id) === index)
  const availableBooks = selectedBooks.filter((book) => Number(book.quantity) > 0)
  const unavailableBooks = selectedBooks.filter((book) => !(Number(book.quantity) > 0))
  const remainingLimit = Math.max(0, MAX_BORROW_LIMIT - borrowCount)

  const checkBorrowCount = async () => {
    if (!userId) return
    try {
      const response = await borrowService.getUserActiveBorrowCount(userId)
      const activeCount = Number(response?.data?.count)
      setBorrowCount(Number.isNaN(activeCount) ? 0 : activeCount)
      const durationDays = Number(response?.data?.borrowDurationDays)
      if (!Number.isNaN(durationDays) && durationDays > 0) setBorrowDurationDays(durationDays)
      const minimumSeconds = Number(response?.data?.minSelfReturnSeconds)
      if (!Number.isNaN(minimumSeconds) && minimumSeconds >= 0) setMinSelfReturnSeconds(minimumSeconds)
    } catch {
      // Non-blocking: borrow count display may be stale but borrowing can still proceed.
    }
  }

  useEffect(() => { checkBorrowCount() }, [userId])

  const dueDate = (() => {
    const date = new Date()
    date.setDate(date.getDate() + borrowDurationDays)
    return date
  })()

  const handleBorrowClick = () => {
    setError('')
    if (selectedBooks.length === 0) {
      setError('Please select at least one book to borrow')
      return
    }
    if (availableBooks.length === 0) {
      setError('None of the selected books are currently available')
      return
    }
    if (unavailableBooks.length > 0) {
      setError(`${unavailableBooks.length} selected book${unavailableBooks.length > 1 ? 's are' : ' is'} unavailable. Deselect and try again.`)
      return
    }
    if (borrowCount >= MAX_BORROW_LIMIT) {
      setError(`You have reached the maximum borrowing limit of ${MAX_BORROW_LIMIT} books`)
      return
    }
    if (availableBooks.length > remainingLimit) {
      setError(`You can borrow ${remainingLimit} more book${remainingLimit === 1 ? '' : 's'} only. Reduce your selection and try again.`)
      return
    }
    setShowConfirmation(true)
  }

  const handleConfirmBorrow = async () => {
    if (availableBooks.length === 0 || !userId) {
      setError('Missing required information')
      return
    }
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        availableBooks.map((book) => borrowService.borrowBook(book.id, userId)),
      )
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (successCount > 0 && failedCount === 0) {
        notifications.show({ color: 'green', message: `Successfully borrowed ${successCount} book${successCount > 1 ? 's' : ''}.` })
      } else if (successCount > 0) {
        notifications.show({ color: 'green', message: `Borrowed ${successCount} book${successCount > 1 ? 's' : ''}.` })
        notifications.show({ color: 'orange', message: `${failedCount} book${failedCount > 1 ? 's' : ''} could not be borrowed. Please retry.` })
      } else {
        const firstError = results.find((result) => result.status === 'rejected')
        notifications.show({ color: 'red', message: firstError?.reason?.message || 'Failed to borrow selected books' })
      }

      setShowConfirmation(false)
      await checkBorrowCount()

      if (successCount > 0) {
        setTimeout(() => {
          onSuccess?.()
          onClose?.()
        }, 1200)
      }
    } catch (err) {
      setError(err?.message || 'Failed to borrow book')
    } finally {
      setLoading(false)
    }
  }

  if (selectedBooks.length === 0) {
    return <EmptyState title="No books selected" description="Select a book from the catalogue to borrow it." />
  }

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        {error ? <Alert color="red" icon={<IconAlertTriangle size={16} stroke={1.5} />}>{error}</Alert> : null}

        {!showConfirmation ? (
          <Stack gap="md">
            <Title order={4}>Borrow Book{selectedBooks.length > 1 ? 's' : ''}</Title>

            <Stack gap={4}>
              <Text size="sm" fw={600}>Selected Books ({selectedBooks.length})</Text>
              <List size="sm" spacing={4}>
                {selectedBooks.map((book) => (
                  <List.Item key={book.id}>
                    <Text span fw={600}>{book.title}</Text> — {book.author} ({book.quantity || 0} copies)
                  </List.Item>
                ))}
              </List>
            </Stack>

            <Stack gap={2}>
              <Text size="sm">
                Your current borrows: <Badge color={borrowCount >= MAX_BORROW_LIMIT ? 'red' : 'gray'}>{borrowCount}/{MAX_BORROW_LIMIT}</Badge>
              </Text>
              <Text size="sm">Books to borrow: {availableBooks.length}</Text>
              <Text size="sm">Remaining limit after borrow: {Math.max(0, remainingLimit - availableBooks.length)}</Text>
              {borrowCount >= MAX_BORROW_LIMIT ? <Text size="sm" c="red">You have reached your borrowing limit. Return a book to borrow more.</Text> : null}
              {availableBooks.length > remainingLimit ? <Text size="sm" c="red">Selected books exceed your remaining limit ({remainingLimit}).</Text> : null}
              {unavailableBooks.length > 0 ? (
                <Text size="sm" c="red">{unavailableBooks.length} selected book{unavailableBooks.length > 1 ? 's are' : ' is'} unavailable.</Text>
              ) : null}
            </Stack>

            <Group>
              <Button
                onClick={handleBorrowClick}
                disabled={loading || borrowCount >= MAX_BORROW_LIMIT || availableBooks.length === 0 || availableBooks.length > remainingLimit}
              >
                Proceed to Confirm
              </Button>
              <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Title order={4}>Confirm Borrowing</Title>

            <Stack gap={4}>
              <Text size="sm"><Text span fw={600}>Books:</Text> {availableBooks.length}</Text>
              <Text size="sm"><Text span fw={600}>Titles:</Text> {availableBooks.map((book) => book.title).join(', ')}</Text>
              <Text size="sm"><Text span fw={600}>Borrow date:</Text> {new Date().toLocaleDateString()}</Text>
              <Text size="sm"><Text span fw={600}>Due date:</Text> {dueDate.toLocaleDateString()}</Text>
              <Text size="sm"><Text span fw={600}>Borrow duration:</Text> {borrowDurationDays} days</Text>
            </Stack>

            <Alert color="forest" variant="light" icon={<IconInfoCircle size={16} stroke={1.5} />}>
              Please return the book by the due date to avoid late fees.
              {minSelfReturnSeconds > 0 ? ` Self-return is available after ${minSelfReturnSeconds} seconds from borrow time.` : ''}
            </Alert>

            <Group>
              <Button onClick={handleConfirmBorrow} loading={loading}>Confirm &amp; Borrow</Button>
              <Button variant="default" onClick={() => setShowConfirmation(false)} disabled={loading}>Cancel</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

export default BorrowBook
