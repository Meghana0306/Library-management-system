const SESSION_VERSION = 1

export const PORTAL_SESSION_KEYS = {
  student: 'studentPortalSession',
  author: 'authorPortalSession',
  librarian: 'librarianPortalSession',
}

// Per-tab, cleared on browser close: matches the pre-rebuild student/author
// portals. The librarian portal used localStorage originally but moves to
// sessionStorage here too, for consistency and cleaner logout semantics.
export const savePortalSession = (sessionKey, payload) => {
  if (!sessionKey || !payload) return
  sessionStorage.setItem(sessionKey, JSON.stringify({
    version: SESSION_VERSION,
    updatedAt: new Date().toISOString(),
    ...payload,
  }))
}

/** Returns null for anything missing, malformed or written by a newer version. */
export const loadPortalSession = (sessionKey) => {
  if (!sessionKey) return null
  const raw = sessionStorage.getItem(sessionKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.version || parsed.version > SESSION_VERSION) return null
    return parsed
  } catch {
    sessionStorage.removeItem(sessionKey)
    return null
  }
}

export const clearPortalSession = (sessionKey) => {
  if (!sessionKey) return
  sessionStorage.removeItem(sessionKey)
}

export const clearAllPortalSessions = () => {
  Object.values(PORTAL_SESSION_KEYS).forEach((key) => sessionStorage.removeItem(key))
}
