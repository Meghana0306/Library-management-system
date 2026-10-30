import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Group, Select, SimpleGrid, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBooks } from '@tabler/icons-react'
import { bookService, borrowService } from '../../services'
import { EmptyState } from '../../components/common/EmptyState.jsx'
import { SearchToolbar } from '../../components/common/SearchToolbar.jsx'
import { PDFPreviewModal } from '../../components/common/PDFPreviewModal.jsx'
import { PREDEFINED_GENRES } from '../../utils/constants'
import { BookCard } from './components/BookCard.jsx'
import { BookDetailModal } from './components/BookDetailModal.jsx'
import { BookReviewModal } from './BookReviewModal.jsx'

const normalizeGenres = (value) => String(value || '')
  .split(/[;,]/)
  .map((genre) => genre.trim())
  .filter(Boolean)

export const AvailableBooks = ({ userId, onSelectBooks, onReviewSaved }) => {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [genreFilter, setGenreFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [publishedFrom, setPublishedFrom] = useState('')
  const [publishedTo, setPublishedTo] = useState('')
  const [selectedBookIds, setSelectedBookIds] = useState([])
  const [bookRatings, setBookRatings] = useState({})
  const [detailBook, setDetailBook] = useState(null)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [reviewBook, setReviewBook] = useState(null)

  const loadBooks = async () => {
    try {
      setLoading(true)
      const response = await bookService.getAllBooks()
      const bookList = response.data || []
      setBooks(bookList)
      setBookRatings(Object.fromEntries(bookList.map((book) => [
        book.id,
        { averageRating: book.averageRating ?? null, reviewCount: book.reviewCount ?? 0 },
      ])))
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load available books.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBooks() }, [])

  useEffect(() => {
    if (!userId) return
    borrowService.getRecommendations(userId, 5)
      .then((res) => setRecommendations(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRecommendations([]))
  }, [userId])

  const filteredBooks = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return books.filter((book) => {
      const title = (book.title || '').toLowerCase()
      const author = (book.author || '').toLowerCase()
      const genres = normalizeGenres(book.genre)
      const publishedDate = String(book.publishedDate || '').slice(0, 10)
      const quantity = Number(book.quantity) || 0
      const availabilityStatus = quantity <= 0 ? 'unavailable' : quantity <= 2 ? 'limited' : 'available'

      return (!keyword || title.includes(keyword) || author.includes(keyword))
        && (genreFilter === 'all' || genres.includes(genreFilter))
        && (availabilityFilter === 'all' || availabilityStatus === availabilityFilter)
        && (!publishedFrom || !publishedDate || publishedDate >= publishedFrom)
        && (!publishedTo || !publishedDate || publishedDate <= publishedTo)
    })
  }, [books, searchTerm, genreFilter, availabilityFilter, publishedFrom, publishedTo])

  const borrowableBooks = filteredBooks.filter((book) => Number(book.quantity) > 0)
  const selectedBooks = selectedBookIds.map((id) => filteredBooks.find((book) => book.id === id)).filter(Boolean)
  const allBorrowableSelected = borrowableBooks.length > 0 && selectedBookIds.length === borrowableBooks.length
  const hasActiveFilters = Boolean(
    searchTerm.trim() || genreFilter !== 'all' || availabilityFilter !== 'all' || publishedFrom || publishedTo,
  )

  useEffect(() => {
    setSelectedBookIds((prev) => {
      const next = prev.filter((id) => borrowableBooks.some((book) => book.id === id))
      return next.length === prev.length ? prev : next
    })
  }, [borrowableBooks])

  const clearFilters = () => {
    setSearchTerm('')
    setGenreFilter('all')
    setAvailabilityFilter('all')
    setPublishedFrom('')
    setPublishedTo('')
  }

  const toggleSelect = (bookId) => {
    setSelectedBookIds((prev) => (prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]))
  }

  const toggleSelectAll = () => {
    setSelectedBookIds(allBorrowableSelected ? [] : borrowableBooks.map((book) => book.id))
  }

  const openDetail = (book) => setDetailBook(book)

  const handleBorrow = (book) => onSelectBooks?.([book])
  const handleBorrowSelected = () => selectedBooks.length > 0 && onSelectBooks?.(selectedBooks)

  return (
    <Stack gap="lg">
      <Title order={3}>Available Books</Title>

      <SearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search by title or author..."
        actions={(
          <Button variant="default" onClick={clearFilters} disabled={!hasActiveFilters}>
            Clear filters
          </Button>
        )}
      >
        <Select
          label="Genre"
          value={genreFilter}
          onChange={(value) => setGenreFilter(value || 'all')}
          data={[{ value: 'all', label: 'All genres' }, ...PREDEFINED_GENRES.map((g) => ({ value: g, label: g }))]}
          w={180}
          allowDeselect={false}
        />
        <Select
          label="Availability"
          value={availabilityFilter}
          onChange={(value) => setAvailabilityFilter(value || 'all')}
          data={[
            { value: 'all', label: 'All books' },
            { value: 'available', label: 'Available' },
            { value: 'limited', label: 'Limited availability' },
            { value: 'unavailable', label: 'Unavailable' },
          ]}
          w={180}
          allowDeselect={false}
        />
        <TextInput label="Published from" type="date" value={publishedFrom} onChange={(e) => setPublishedFrom(e.currentTarget.value)} w={160} />
        <TextInput label="Published to" type="date" value={publishedTo} onChange={(e) => setPublishedTo(e.currentTarget.value)} w={160} />
      </SearchToolbar>

      {recommendations.length > 0 ? (
        <Stack gap="xs">
          <Title order={4}>Recommended For You</Title>
          <Text size="xs" c="dimmed">Based on your borrowing history and library popularity.</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {recommendations.map((item) => (
              <BookCard
                key={`rec-${item.bookId}`}
                recommended
                recommendReason={item.reason}
                book={{ id: item.bookId, title: item.title, author: item.author, genre: item.genre, quantity: books.find((b) => b.id === item.bookId)?.quantity }}
                onBorrow={handleBorrow}
              />
            ))}
          </SimpleGrid>
        </Stack>
      ) : null}

      <Group justify="space-between" wrap="wrap">
        <Checkbox
          label="Select all"
          checked={allBorrowableSelected}
          onChange={toggleSelectAll}
          disabled={borrowableBooks.length === 0}
        />
        <Group gap="xs">
          <Text size="sm" c="dimmed">Selected {selectedBooks.length} · Available {borrowableBooks.length}</Text>
          <Button onClick={handleBorrowSelected} disabled={selectedBooks.length === 0}>
            Borrow selected
          </Button>
        </Group>
      </Group>

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} height={260} radius="sm" />)}
        </SimpleGrid>
      ) : filteredBooks.length === 0 ? (
        <EmptyState
          icon={IconBooks}
          title="No books to show"
          description={hasActiveFilters ? 'No books match your search or filters.' : 'No books available at the moment.'}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              selected={selectedBookIds.includes(book.id)}
              onToggleSelect={toggleSelect}
              onBorrow={handleBorrow}
              onViewPDF={(b) => setPdfPreview({ title: b.title, filePath: b.filePath })}
              onOpenDetail={openDetail}
              rating={bookRatings[book.id]}
            />
          ))}
        </SimpleGrid>
      )}

      <PDFPreviewModal
        isOpen={Boolean(pdfPreview)}
        onClose={() => setPdfPreview(null)}
        filePath={pdfPreview?.filePath}
        bookTitle={pdfPreview?.title}
      />

      {detailBook ? (
        <BookDetailModal
          book={detailBook}
          onClose={() => setDetailBook(null)}
          onBorrow={(book) => { handleBorrow(book); setDetailBook(null) }}
          onWriteReview={(book) => { setReviewBook(book); setDetailBook(null) }}
        />
      ) : null}

      {reviewBook && userId ? (
        <BookReviewModal
          bookId={reviewBook.id}
          bookTitle={reviewBook.title}
          userId={userId}
          existingReview={null}
          onClose={() => setReviewBook(null)}
          onSaved={() => {
            setReviewBook(null)
            loadBooks()
            onReviewSaved?.()
          }}
        />
      ) : null}
    </Stack>
  )
}

export default AvailableBooks
