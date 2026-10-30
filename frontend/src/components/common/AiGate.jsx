import { Children, cloneElement, isValidElement } from 'react'
import { Box, Tooltip } from '@mantine/core'
import { useAiCapability } from '../../ai/AiCapabilityContext.jsx'

const DEFAULT_TOOLTIP = 'AI features are turned off on this server.'

/**
 * Renders AI-dependent UI only when the backend reports the feature as usable.
 *
 * mode="hide" (default) removes the children entirely; mode="disable" keeps a
 * single child visible but disabled, with a tooltip explaining why.
 */
export const AiGate = ({ feature, mode = 'hide', tooltip = DEFAULT_TOOLTIP, fallback = null, children }) => {
  const { available } = useAiCapability(feature)

  if (available) return children
  if (mode !== 'disable') return fallback

  const child = Children.only(children)
  if (!isValidElement(child)) return fallback

  return (
    <Tooltip label={tooltip} withArrow>
      <Box display="inline-block" style={{ cursor: 'not-allowed' }}>
        {cloneElement(child, { disabled: true })}
      </Box>
    </Tooltip>
  )
}

export default AiGate
