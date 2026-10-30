// @vitest-environment jsdom
import '../../../features/auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider, Button } from '@mantine/core'
import { theme } from '../../../theme.js'
import { AiGate } from '../AiGate.jsx'
import AiCapabilityContext from '../../../ai/AiCapabilityContext.jsx'

// jsdom implements neither matchMedia nor ResizeObserver; MantineProvider and
// the Tooltip used by AiGate's disable mode touch both.
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

// Wraps children with the raw context (not the AiCapabilityProvider, which
// probes systemService.getAiStatus() and caches the result at module scope)
// so each test controls aiEnabled/features directly and independently.
const renderWithCapability = (value, ui) => render(
  <MantineProvider theme={theme} forceColorScheme="light">
    <AiCapabilityContext.Provider value={{ aiEnabled: false, features: {}, loading: false, refresh: vi.fn(), ...value }}>
      {ui}
    </AiCapabilityContext.Provider>
  </MantineProvider>,
)

describe('AiGate', () => {
  it('hides children (mode="hide") when the feature is disabled', () => {
    renderWithCapability(
      { aiEnabled: false, features: { summary: false } },
      <AiGate feature="summary"><button>Generate summary</button></AiGate>,
    )
    expect(screen.queryByRole('button', { name: 'Generate summary' })).not.toBeInTheDocument()
  })

  it('renders children when the feature is enabled', () => {
    renderWithCapability(
      { aiEnabled: true, features: { summary: true } },
      <AiGate feature="summary"><button>Generate summary</button></AiGate>,
    )
    expect(screen.getByRole('button', { name: 'Generate summary' })).toBeInTheDocument()
  })

  it('mode="disable" keeps the child visible but disabled, wrapped in a tooltip', async () => {
    renderWithCapability(
      { aiEnabled: false, features: { summary: false } },
      <AiGate feature="summary" mode="disable" tooltip="Needs an AI key">
        <Button>Generate summary</Button>
      </AiGate>,
    )

    const button = screen.getByRole('button', { name: 'Generate summary' })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()

    // The disabled button itself can't receive hover events, so the tooltip
    // trigger is the wrapping Box AiGate renders around it.
    fireEvent.mouseEnter(button.parentElement)
    await waitFor(() => expect(screen.getByText('Needs an AI key')).toBeInTheDocument())
  })
})
