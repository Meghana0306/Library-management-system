// @vitest-environment jsdom
import './jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { theme } from '../../../theme.js'
import { AuthProvider } from '../../../auth/AuthContext.jsx'
import { StudentAuthPage } from '../../student/StudentAuthPage.jsx'
import { AuthorAuthPage } from '../../author/AuthorAuthPage.jsx'
import { LibrarianAuthPage } from '../../librarian/LibrarianAuthPage.jsx'

// jsdom implements neither matchMedia nor ResizeObserver; Mantine's
// MantineProvider and the Select/Combobox dropdown (used by the registration
// account-type field) touch both even with forceColorScheme set.
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

const renderPage = (Page) =>
  render(
    <MantineProvider theme={theme} forceColorScheme="light">
      <MemoryRouter>
        <AuthProvider>
          <Page />
        </AuthProvider>
      </MemoryRouter>
    </MantineProvider>,
  )

describe('portal auth pages', () => {
  it('renders the login form for student/staff', () => {
    renderPage(StudentAuthPage)
    expect(screen.getByRole('heading', { name: 'Student / Staff sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders the login form for authors', () => {
    renderPage(AuthorAuthPage)
    expect(screen.getByRole('heading', { name: 'Author sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders the login form for librarians', () => {
    renderPage(LibrarianAuthPage)
    expect(screen.getByRole('heading', { name: 'Librarian sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('switches to the registration form via "Create an account"', () => {
    renderPage(StudentAuthPage)
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows the account-type dropdown on student registration only', () => {
    renderPage(StudentAuthPage)
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('textbox', { name: 'Account type' })).toBeInTheDocument()
  })
})
