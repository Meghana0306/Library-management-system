// @vitest-environment jsdom
import '../../../features/auth/__tests__/jsdomStoragePolyfill.js'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from '../../../theme.js'
import { DataTable } from '../DataTable.jsx'

// jsdom implements neither matchMedia nor ResizeObserver; MantineProvider
// touches both even with forceColorScheme set.
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

const COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age' },
]

const ROWS = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
]

const renderTable = (props) => render(
  <MantineProvider theme={theme} forceColorScheme="light">
    <DataTable columns={COLUMNS} rows={ROWS} {...props} />
  </MantineProvider>,
)

describe('DataTable', () => {
  it('renders one row per record', () => {
    renderTable()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('fires the sort callback with the column key and toggled direction', () => {
    const onSort = vi.fn()
    renderTable({ onSort })

    const nameHeader = screen.getByRole('button', { name: 'Name' })
    fireEvent.click(nameHeader)
    expect(onSort).toHaveBeenNthCalledWith(1, { key: 'name', direction: 'asc' })

    fireEvent.click(nameHeader)
    expect(onSort).toHaveBeenNthCalledWith(2, { key: 'name', direction: 'desc' })
  })

  it('toggles an individual row via its selection checkbox', () => {
    const onChange = vi.fn()
    renderTable({ selection: { selected: [], onChange } })

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: 'Select row' })
    fireEvent.click(rowCheckboxes[0])

    expect(onChange).toHaveBeenCalledWith([1])
  })
})
