// @vitest-environment jsdom
import '../../auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

vi.mock('../../../services', () => ({
  bookService: {
    getPendingBooks: vi.fn().mockResolvedValue({ data: [] }),
    getAllBooks: vi.fn().mockResolvedValue({ data: [] }),
    getManageBooks: vi.fn().mockResolvedValue({ data: [] }),
    approveBook: vi.fn().mockResolvedValue({ data: {} }),
    createLibrarianBook: vi.fn().mockResolvedValue({ data: {} }),
    updateLibrarianBook: vi.fn().mockResolvedValue({ data: {} }),
    deleteLibrarianBook: vi.fn().mockResolvedValue({ data: {} }),
    bulkDeleteBooks: vi.fn().mockResolvedValue({ data: {} }),
    bulkUpdateBooks: vi.fn().mockResolvedValue({ data: {} }),
    getBookHistory: vi.fn().mockResolvedValue({ data: [] }),
    generateBookSummary: vi.fn().mockResolvedValue({ data: { summary: '' } }),
    getDownloadedBookStats: vi.fn().mockResolvedValue({
      data: { summary: { totalBooks: 0, publishedBooks: 0, pendingBooks: 0, rejectedBooks: 0, totalBorrows: 0, totalReviews: 0, overallAverageRating: null }, books: [], ratingDistribution: {} },
    }),
    getDownloadedBookTrends: vi.fn().mockResolvedValue({ data: [] }),
  },
  borrowService: {
    getAllBorrowingRecords: vi.fn().mockResolvedValue({ data: [] }),
  },
  librarianService: {
    getAllUsers: vi.fn().mockResolvedValue({
      data: [
        { id: 1, username: 'stu1', fullName: 'Student One', email: 's1@example.com', role: 'STUDENT', employeeId: '', active: true },
        { id: 2, username: 'lib1', fullName: 'Lib One', email: 'l1@example.com', role: 'LIBRARIAN', employeeId: 'E1', active: true },
      ],
    }),
    createUser: vi.fn().mockResolvedValue({ data: {} }),
    updateUser: vi.fn().mockResolvedValue({ data: {} }),
    bulkUpdateUsers: vi.fn().mockResolvedValue({ data: {} }),
    bulkActivateUsers: vi.fn().mockResolvedValue({ data: {} }),
    bulkDeactivateUsers: vi.fn().mockResolvedValue({ data: {} }),
    activateUser: vi.fn().mockResolvedValue({ data: {} }),
    deactivateUser: vi.fn().mockResolvedValue({ data: {} }),
    getProfile: vi.fn().mockResolvedValue({ data: { username: 'librarian', role: 'LIBRARIAN', fullName: 'Librarian Person', employeeId: '' } }),
    updateProfile: vi.fn().mockResolvedValue({ data: { user: {}, passwordChanged: false } }),
    getNotifications: vi.fn().mockResolvedValue({ data: [] }),
  },
  bookRequestService: {
    getAllRequests: vi.fn().mockResolvedValue({ data: { requests: [] } }),
    updateRequestStatus: vi.fn().mockResolvedValue({ data: {} }),
    updateRequestPriority: vi.fn().mockResolvedValue({ data: {} }),
    downloadRequest: vi.fn().mockResolvedValue({ data: {} }),
    resolveWithAlternative: vi.fn().mockResolvedValue({ data: {} }),
  },
  reviewService: {},
  readingHistoryService: {},
  systemService: {
    getAiStatus: vi.fn().mockResolvedValue({ data: { aiEnabled: false, features: {} } }),
  },
}))

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

afterEach(() => {
  cleanup()
})

// Imported after the polyfill/mocks above so services/api.js (which reads
// localStorage at module load) and the mocked services/index.js are both
// already in place.
const { theme } = await import('../../../theme.js')
const { AuthProvider } = await import('../../../auth/AuthContext.jsx')
const { AUTH_STORAGE_KEY } = await import('../../../services/api.js')
const { LibrarianPortal } = await import('../LibrarianPortal.jsx')

window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
  token: 'test-token',
  userId: 9,
  username: 'librarian',
  fullName: 'Librarian Person',
  role: 'LIBRARIAN',
}))

const renderPortal = () => render(
  <MantineProvider theme={theme} forceColorScheme="light">
    <Notifications />
    <MemoryRouter>
      <AuthProvider>
        <LibrarianPortal />
      </AuthProvider>
    </MemoryRouter>
  </MantineProvider>,
)

describe('librarian portal', () => {
  it('renders all 8 tabs and shows mocked user rows on Manage Users', async () => {
    renderPortal()

    const tabLabels = [
      'Book Approvals',
      'Manage Books',
      'Manage Users',
      'My Profile',
      'Borrow Records',
      'Notification Board',
      'Book Requests',
      'Download Stats',
    ]
    tabLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Manage Users'))

    await waitFor(() => {
      expect(screen.getByText('stu1')).toBeInTheDocument()
    })
    expect(screen.getByText('lib1')).toBeInTheDocument()
  })
})
