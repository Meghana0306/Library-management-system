import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { systemService } from '../services'

const DISABLED = { aiEnabled: false, features: {} }

// Cached only on success, so a probe that failed (backend down, endpoint not
// deployed yet) is retried the next time a provider mounts.
let cachedStatus = null

const AiCapabilityContext = createContext({ ...DISABLED, loading: false, refresh: () => {} })

export const AiCapabilityProvider = ({ children }) => {
  const [status, setStatus] = useState(() => cachedStatus ?? DISABLED)
  const [loading, setLoading] = useState(() => !cachedStatus)

  const probe = useCallback(async () => {
    setLoading(true)
    try {
      const response = await systemService.getAiStatus()
      const data = response?.data ?? {}
      const next = {
        aiEnabled: Boolean(data.aiEnabled),
        features: data.features && typeof data.features === 'object' ? data.features : {},
      }
      cachedStatus = next
      setStatus(next)
    } catch {
      setStatus(DISABLED)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cachedStatus) {
      setStatus(cachedStatus)
      setLoading(false)
      return
    }
    probe()
  }, [probe])

  const value = useMemo(() => ({
    aiEnabled: status.aiEnabled,
    features: status.features,
    loading,
    refresh: probe,
  }), [status, loading, probe])

  return <AiCapabilityContext.Provider value={value}>{children}</AiCapabilityContext.Provider>
}

export const useAiCapability = (feature) => {
  const context = useContext(AiCapabilityContext)
  const available = feature
    ? Boolean(context.aiEnabled && context.features?.[feature])
    : Boolean(context.aiEnabled)
  return { ...context, available }
}

export default AiCapabilityContext
