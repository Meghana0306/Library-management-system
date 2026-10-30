// @vitest-environment jsdom
import '../../features/auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthProvider } from '../AuthContext.jsx'
import { useAuth } from '../useAuth.js'
import { AUTH_STORAGE_KEY } from '../../services/api.js'

const SAMPLE_LOGIN = { token: 'abc123', userId: 5, username: 'stu1', fullName: 'Stu One', role: 'student' }

const TestConsumer = () => {
  const { isAuthenticated, role, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? `in:${role}` : 'out'}</span>
      <button onClick={() => login(SAMPLE_LOGIN)}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

const renderConsumer = () => render(
  <AuthProvider>
    <TestConsumer />
  </AuthProvider>,
)

describe('AuthContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('login persists {token, userId, username, fullName, role} under library.auth', () => {
    renderConsumer()
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in:STUDENT')
    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY))
    expect(stored).toEqual({
      token: 'abc123', userId: 5, username: 'stu1', fullName: 'Stu One', role: 'STUDENT',
    })
  })

  it('logout clears the auth record from state and storage', () => {
    renderConsumer()
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
})
