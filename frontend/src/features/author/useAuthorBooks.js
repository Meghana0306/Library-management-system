import { useCallback, useEffect, useState } from 'react'
import { bookService } from '../../services'

/** Loads the author's whole submission list (pending + approved + rejected). */
export const useAuthorBooks = (authorId) => {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!authorId) return []

    setLoading(true)
    setError('')
    try {
      const response = await bookService.getAuthorBooks(authorId)
      const next = Array.isArray(response.data) ? response.data : []
      setBooks(next)
      return next
    } catch (err) {
      setError(err?.message || 'Failed to load your books')
      setBooks([])
      return []
    } finally {
      setLoading(false)
    }
  }, [authorId])

  useEffect(() => {
    reload()
  }, [reload])

  return { books, loading, error, setError, reload }
}

export default useAuthorBooks
