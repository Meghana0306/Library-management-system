// This Node/jsdom/vitest combination leaves `window.localStorage` undefined
// (Node's experimental global Web Storage API shadows jsdom's own storage
// implementation — see --no-experimental-webstorage). services/api.js reads
// localStorage at module load time (migrateLegacyAuth), so this must be
// imported before anything that transitively imports services/api.js.
const makeMemoryStorage = () => {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

if (typeof window !== 'undefined' && !window.localStorage) {
  window.localStorage = makeMemoryStorage()
}
