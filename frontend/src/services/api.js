import axios from 'axios'
import { notifications } from '@mantine/notifications'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const REQUEST_TIMEOUT_MS = 15000

export const AUTH_STORAGE_KEY = 'library.auth'
const LEGACY_TOKEN_KEY = 'token'

/** Error codes from the shared backend error envelope. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  AI_DISABLED: 'AI_DISABLED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
}

/** Normalised shape every rejected request is unwrapped into. */
export class ApiError extends Error {
  constructor({ code, message, status, timestamp, payload }) {
    super(message || 'Something went wrong.')
    this.name = 'ApiError'
    this.code = code || ERROR_CODES.INTERNAL_ERROR
    this.status = status ?? 0
    this.timestamp = timestamp || new Date().toISOString()
    this.payload = payload ?? null
  }
}

const hasWindow = () => typeof window !== 'undefined'

/**
 * Moves the pre-overhaul standalone `token` key into the single `library.auth`
 * record, then removes it. Runs once at module load and is a no-op afterwards.
 */
const migrateLegacyAuth = () => {
  if (!hasWindow()) return
  const legacyToken = window.localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacyToken) return

  if (!window.localStorage.getItem(AUTH_STORAGE_KEY)) {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: legacyToken, userId: null, username: '', fullName: '', role: '' }),
    )
  }
  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
}

migrateLegacyAuth()

export const readAuth = () => {
  if (!hasWindow()) return null
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.token) return null
    return parsed
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export const writeAuth = (auth) => {
  if (!hasWindow() || !auth?.token) return null
  const record = {
    token: auth.token,
    userId: auth.userId ?? null,
    username: auth.username ?? '',
    fullName: auth.fullName ?? '',
    role: String(auth.role ?? '').toUpperCase(),
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record))
  return record
}

export const clearAuth = () => {
  if (!hasWindow()) return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
}

/** Which portal's login page the current URL belongs to. */
export const loginPathForLocation = (pathname = '') => {
  if (pathname.startsWith('/author')) return '/author/login'
  if (pathname.startsWith('/librarian')) return '/librarian/login'
  if (pathname.startsWith('/student')) return '/student/login'
  return null
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Blob/image requests deliberately bypass the interceptors below: a missing
 * avatar or cover is a 404 that must stay silent, never a toast or a logout.
 */
export const fileClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
})

const attachToken = (config) => {
  const auth = readAuth()
  if (auth?.token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
}

apiClient.interceptors.request.use(attachToken)
fileClient.interceptors.request.use(attachToken)

const notify = (title, message, color = 'red') => {
  notifications.show({ title, message, color, withBorder: true })
}

const handleUnauthenticated = () => {
  clearAuth()
  if (!hasWindow()) return
  const { pathname } = window.location
  const target = loginPathForLocation(pathname) ?? '/'
  if (pathname === target) return
  window.location.assign(target)
}

/**
 * `responseType: 'blob'` requests (file streams/downloads) get their error
 * body back as a Blob too, even though the server still sent the JSON §4
 * envelope — axios doesn't parse it for us. Read it out by hand so the real
 * server message reaches the caller instead of axios's generic HTTP text.
 */
const resolveErrorEnvelope = async (data) => {
  if (data instanceof Blob) {
    if (!data.type || !data.type.includes('json')) return {}
    try {
      const parsed = JSON.parse(await data.text())
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? data : {}
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      const aborted = error.code === 'ECONNABORTED'
      const apiError = new ApiError({
        code: ERROR_CODES.NETWORK_ERROR,
        message: aborted
          ? 'The server took too long to respond. Please try again.'
          : 'Cannot reach the server. Check your connection and try again.',
        status: 0,
      })
      notify(aborted ? 'Request timed out' : 'Connection problem', apiError.message)
      return Promise.reject(apiError)
    }

    const { status, data } = error.response
    const envelope = await resolveErrorEnvelope(data)
    const apiError = new ApiError({
      code: envelope.code || `HTTP_${status}`,
      message: envelope.message || error.message,
      status,
      timestamp: envelope.timestamp,
      payload: data,
    })

    if (status === 401) {
      handleUnauthenticated()
    } else if (status === 403) {
      notify('Not allowed', apiError.message || 'You do not have access to that.')
    } else if (apiError.code === ERROR_CODES.AI_DISABLED || apiError.code === ERROR_CODES.AI_UNAVAILABLE) {
      notify('AI features unavailable', apiError.message || 'This feature needs an AI key configured.', 'gray')
    }

    return Promise.reject(apiError)
  },
)

export const authAPI = {
  register: (registrationData) =>
    apiClient.post('/auth/register', registrationData),

  login: (credentials) =>
    apiClient.post('/auth/login', credentials),

  loginLibrarian: (credentials) =>
    apiClient.post('/auth/login/librarian', credentials),

  loginAuthor: (credentials) =>
    apiClient.post('/auth/login/author', credentials),

  updateAuthorProfile: (userId, profileData) =>
    apiClient.put(`/auth/profile/author/${userId}`, profileData),

  getStudentProfile: (userId) =>
    apiClient.get(`/auth/profile/student/${userId}`),

  updateStudentProfile: (userId, profileData) =>
    apiClient.put(`/auth/profile/student/${userId}`, profileData),

  uploadAvatar: (userId, formData) =>
    apiClient.post(`/auth/profile/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

/**
 * Paths are relative to the API base and are meant for `AuthImage`/`useObjectUrl`,
 * which fetch them as authenticated blobs. They are NOT usable as a raw <img src>.
 */
export const avatarPath = (userId) => `/files/avatar/${userId}`

export const coverPath = (bookId) => `/files/cover/${bookId}`

export const previewPath = (bookId) => `/files/preview/${bookId}`

export default apiClient
