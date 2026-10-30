// @vitest-environment jsdom
import '../../auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { theme } from '../../../theme.js'
import { AuthProvider } from '../../../auth/AuthContext.jsx'
import { AUTH_STORAGE_KEY } from '../../../services/api.js'
import { StudentPortal } from '../StudentPortal.jsx'

// Avatar/cover images go through AuthImage's own axios instance (fileClient),
// which this test does not want hitting the network — it stays silent on
// failure (no toast, no crash) but a real request would still be slow/flaky
// under jsdom. Everything else about services/api.js (readAuth, ApiError,
// avatarPath, ...) stays real.
vi.mock('../../../services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fileClient: { get: vi.fn().mockRejectedValue(new Error('no network in tests')) },
  }
})

// vi.mock factories are hoisted above all other module code, so the mocked
// book data has to live inside the factory rather than in an outer const.
vi.mock('../../../services', () => ({
  bookService: {
    getAllBooks: vi.fn().mockResolvedValue({
      data: [{
        id: 1,
        title: 'Mock Book One',
        author: 'Author A',
        genre: 'Fiction',
        quantity: 3,
        description: 'A short mocked summary.',
        filePath: null,
        averageRating: 4.5,
        reviewCount: 2,
        publishedDate: '2020-01-01',
      }],
    }),
  },
  borrowService: {
    getRecommendations: vi.fn().mockResolvedValue({ data: [] }),
    getUserActiveBorrowCount: vi.fn().mockResolvedValue({ data: { count: 0, borrowDurationDays: 14, minSelfReturnSeconds: 0 } }),
    getUserActiveBorrowings: vi.fn().mockResolvedValue({ data: [] }),
    autoReturnExpiredBooks: vi.fn().mockResolvedValue({ data: {} }),
    getStudentNotifications: vi.fn().mockResolvedValue({ data: [] }),
    markNotificationRead: vi.fn().mockResolvedValue({ data: {} }),
    markAllNotificationsRead: vi.fn().mockResolvedValue({ data: {} }),
    deleteNotification: vi.fn().mockResolvedValue({ data: {} }),
    returnBook: vi.fn().mockResolvedValue({ data: {} }),
    returnBooksInBulk: vi.fn().mockResolvedValue({ data: {} }),
    borrowBook: vi.fn().mockResolvedValue({ data: {} }),
  },
  reviewService: {
    getReviewsForBook: vi.fn().mockResolvedValue({ data: { averageRating: 0, reviewCount: 0, reviews: [] } }),
    getReviewsByUser: vi.fn().mockResolvedValue({ data: { reviews: [] } }),
    submitReview: vi.fn().mockResolvedValue({ data: {} }),
    updateReview: vi.fn().mockResolvedValue({ data: {} }),
  },
  bookRequestService: {
    getUserRequests: vi.fn().mockResolvedValue({ data: { requests: [] } }),
    submitRequest: vi.fn().mockResolvedValue({ data: {} }),
  },
  readingHistoryService: {
    getReadingHistory: vi.fn().mockResolvedValue({ data: { history: [], totalRecords: 0 } }),
    updateReadingProgress: vi.fn().mockResolvedValue({ data: {} }),
  },
  systemService: {
    getAiStatus: vi.fn().mockResolvedValue({ data: { aiEnabled: false, features: {} } }),
  },
  librarianService: {},
}))

// jsdom implements neither matchMedia nor ResizeObserver; Mantine's AppShell,
// Select and MultiSelect (used by the Available Books filters) touch both.
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
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    token: 'test-token',
    userId: 42,
    username: 'student1',
    fullName: 'Sam Student',
    role: 'STUDENT',
  }))
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
})

const renderPortal = () =>
  render(
    <MantineProvider theme={theme} forceColorScheme="light">
      <MemoryRouter initialEntries={['/student']}>
        <AuthProvider>
          <StudentPortal />
        </AuthProvider>
      </MemoryRouter>
    </MantineProvider>,
  )

describe('StudentPortal', () => {
  it('renders all six tabs', () => {
    const { container } = renderPortal()
    // "Available Books" is both the nav label and the Available Books panel's
    // heading, so the tab labels are asserted via the nav's own label class
    // rather than screen.getByText (which would find the duplicate).
    const navLabels = Array.from(container.querySelectorAll('.mantine-NavLink-label')).map((el) => el.textContent)
    expect(navLabels).toEqual([
      'Available Books',
      'Borrowed Books',
      'Notification Board',
      'Reading History',
      'My Reviews',
      'Request a Book',
    ])
  })

  it('shows mocked books in the Available Books tab', async () => {
    renderPortal()
    await waitFor(() => expect(screen.getByText('Mock Book One')).toBeInTheDocument())
    expect(screen.getByText(/Author A/)).toBeInTheDocument()
  })
})
