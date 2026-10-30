// @vitest-environment jsdom
import '../../auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'

const AUTHOR = {
  userId: 7,
  username: 'author7',
  fullName: 'Ada Writer',
  role: 'AUTHOR',
  isAuthenticated: true,
  logout: vi.fn(),
  updateAuth: vi.fn(),
  login: vi.fn(),
}

const BOOKS = [
  {
    id: 1,
    title: 'Pending Novel',
    genre: 'Fiction',
    status: 'PENDING',
    submittedDate: '2026-01-05T10:00:00.000Z',
  },
  {
    id: 2,
    title: 'Published Novel',
    genre: 'History',
    status: 'APPROVED',
    activeBorrows: 0,
    publishedDate: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 3,
    title: 'Rejected Novel',
    genre: 'Horror',
    status: 'REJECTED',
    rejectionReason: 'Needs work',
    submittedDate: '2026-01-02T10:00:00.000Z',
  },
]

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => AUTHOR,
  default: () => AUTHOR,
}))

vi.mock('../../../services', () => ({
  bookService: {
    getAuthorBooks: vi.fn(() => Promise.resolve({ data: BOOKS })),
    getAuthorStats: vi.fn(() => Promise.resolve({ data: null })),
    getAuthorStatsTrends: vi.fn(() => Promise.resolve({ data: [] })),
    updateAuthorBook: vi.fn(() => Promise.resolve({ data: {} })),
    deleteAuthorBook: vi.fn(() => Promise.resolve({ data: {} })),
    bulkDeleteAuthorBooks: vi.fn(() => Promise.resolve({ data: { deletedCount: 0, failedCount: 0 } })),
    generateBookSummary: vi.fn(() => Promise.resolve({ data: { summary: '' } })),
    submitBook: vi.fn(() => Promise.resolve({ data: {} })),
  },
  reviewService: {
    getReviewsForAuthor: vi.fn(() => Promise.resolve({ data: [] })),
    analyzeSentiment: vi.fn(() => Promise.resolve({ data: { sentiments: {} } })),
    replyToReview: vi.fn(),
    deleteReply: vi.fn(),
    flagReview: vi.fn(),
    unflagReview: vi.fn(),
  },
  systemService: {
    getAiStatus: vi.fn(() => Promise.resolve({
      data: { aiEnabled: true, features: { summary: true, sentiment: true } },
    })),
  },
}))

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(() => Promise.reject(new Error('not available'))) },
  fileClient: { get: vi.fn(() => Promise.reject(new Error('not available'))) },
  authAPI: { uploadAvatar: vi.fn(), updateAuthorProfile: vi.fn() },
  avatarPath: (userId) => `/files/avatar/${userId}`,
  coverPath: (bookId) => `/files/cover/${bookId}`,
  previewPath: (bookId) => `/files/preview/${bookId}`,
}))

const { AuthorPortal } = await import('../AuthorPortal.jsx')
const { AiCapabilityProvider } = await import('../../../ai/AiCapabilityContext.jsx')
const { theme } = await import('../../../theme.js')

// jsdom implements neither matchMedia nor ResizeObserver; Mantine's AppShell
// and Modal touch both even with forceColorScheme set.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}

      unobserve() {}

      disconnect() {}
    }
  }
})

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

const renderPortal = () =>
  render(
    <MantineProvider theme={theme} forceColorScheme="light">
      <MemoryRouter>
        <AiCapabilityProvider>
          <AuthorPortal />
        </AiCapabilityProvider>
      </MemoryRouter>
    </MantineProvider>,
  )

describe('author portal', () => {
  it('renders the three portal tabs', async () => {
    renderPortal()
    expect(await screen.findByText('My Books')).toBeInTheDocument()
    expect(screen.getByText('Statistics')).toBeInTheDocument()
    expect(screen.getByText('Reviews')).toBeInTheDocument()
  })

  it('shows the pending, rejected and published book sections', async () => {
    renderPortal()

    const pending = (await screen.findByText('Submitted Books (Pending Review)')).closest('.mantine-Paper-root')
    expect(within(pending).getByText('Pending Novel')).toBeInTheDocument()

    const published = screen.getByText('Published / Accepted Books').closest('.mantine-Paper-root')
    expect(within(published).getByText('Published Novel')).toBeInTheDocument()

    const rejected = screen.getByText('Rejected Books').closest('.mantine-Paper-root')
    expect(within(rejected).getByText('Rejected Novel')).toBeInTheDocument()
  })

  it('renders the notification board next to the book list', async () => {
    renderPortal()
    expect(await screen.findByText('Notification Board')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search active notifications')).toBeInTheDocument()
  })

  it('opens the publishing form from the header toggle', async () => {
    renderPortal()

    fireEvent.click(await screen.findByRole('button', { name: 'Publish New Book' }))

    expect(await screen.findByRole('textbox', { name: /Book Title/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview & Submit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close Publish Form' })).toBeInTheDocument()
  })
})
