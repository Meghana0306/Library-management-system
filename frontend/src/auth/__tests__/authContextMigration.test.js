// @vitest-environment jsdom
import '../../features/auth/__tests__/jsdomStoragePolyfill.js'
import { afterEach, describe, expect, it } from 'vitest'

// The legacy `token` key must be seeded BEFORE services/api.js is ever
// imported: migrateLegacyAuth() runs once, at module load. A dynamic import
// (rather than a static one) lets this file set localStorage first and then
// trigger that module-load side effect on its own terms.
describe('legacy auth key migration', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('moves the legacy `token` key into library.auth and removes it', async () => {
    window.localStorage.setItem('token', 'legacy-token-xyz')

    const { AUTH_STORAGE_KEY, readAuth } = await import('../../services/api.js')

    expect(window.localStorage.getItem('token')).toBeNull()
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    expect(readAuth()).toMatchObject({ token: 'legacy-token-xyz' })
  })
})
