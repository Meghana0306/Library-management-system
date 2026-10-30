// @vitest-environment jsdom
import '../../features/auth/__tests__/jsdomStoragePolyfill.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

import { notifications } from '@mantine/notifications'
import apiClient, { ApiError, AUTH_STORAGE_KEY, writeAuth } from '../api.js'

const setPathname = (pathname) => {
  window.history.pushState({}, '', pathname)
}

const mockLocationAssign = () => {
  const assignSpy = vi.fn()
  const original = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, assign: assignSpy },
  })
  return {
    assignSpy,
    restore: () => Object.defineProperty(window, 'location', { configurable: true, value: original }),
  }
}

/** Axios per-request `adapter` override — bypasses the network entirely so the
 * request/response interceptors run against a scripted response. */
const errorAdapterFor = (status, data) => async (config) => {
  const error = new Error(`Request failed with status code ${status}`)
  error.config = config
  error.isAxiosError = true
  error.response = { status, data, config, headers: {} }
  throw error
}

/** Mirrors what axios hands back for a failed `responseType: 'blob'` request:
 * the JSON §4 envelope arrives as response.data, but wrapped in a Blob. */
const blobErrorAdapterFor = (status, envelopeObj) => errorAdapterFor(
  status,
  new Blob([JSON.stringify(envelopeObj)], { type: 'application/json' }),
)

const envelope = (code, message) => ({
  success: false, code, message, timestamp: '2026-01-01T00:00:00.000Z',
})

describe('api.js response interceptor', () => {
  beforeEach(() => {
    window.localStorage.clear()
    notifications.show.mockClear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('401 clears library.auth and redirects to the login page for the current portal', async () => {
    writeAuth({ token: 't1', userId: 1, username: 'stu', fullName: 'Stu Dent', role: 'STUDENT' })
    setPathname('/student/books')
    const { assignSpy, restore } = mockLocationAssign()

    await expect(
      apiClient.get('/books', {
        adapter: errorAdapterFor(401, envelope('UNAUTHENTICATED', 'Please log in again.')),
      }),
    ).rejects.toBeInstanceOf(ApiError)

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(assignSpy).toHaveBeenCalledWith('/student/login')
    restore()
  })

  it('503 AI_DISABLED shows a quiet notification and the rejection can be caught (no unhandled rejection)', async () => {
    let caught = null
    try {
      await apiClient.get('/books/generate-summary', {
        adapter: errorAdapterFor(503, envelope('AI_DISABLED', 'This feature needs an AI key configured.')),
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.code).toBe('AI_DISABLED')
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI features unavailable', color: 'gray' }),
    )
  })

  it('unwraps the §4 error envelope into an ApiError carrying code, message and status', async () => {
    let caught = null
    try {
      await apiClient.get('/books/999', {
        adapter: errorAdapterFor(404, envelope('NOT_FOUND', 'Book not found.')),
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.code).toBe('NOT_FOUND')
    expect(caught.message).toBe('Book not found.')
    expect(caught.status).toBe(404)
  })

  it('reads the §4 envelope out of a Blob error body (blob-typed requests, e.g. file streams)', async () => {
    let caught = null
    try {
      await apiClient.get('/files/stream', {
        params: { filePath: 'db://book/1' },
        responseType: 'blob',
        adapter: blobErrorAdapterFor(403, envelope('FORBIDDEN', 'This book is not approved yet.')),
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.code).toBe('FORBIDDEN')
    expect(caught.message).toBe('This book is not approved yet.')
    expect(caught.status).toBe(403)
  })
})
