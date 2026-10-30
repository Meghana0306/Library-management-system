import { useState } from 'react'
import { Center, Checkbox, Group, Pagination, Table, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react'

const resolveKey = (row, rowKey, index) => {
  if (typeof rowKey === 'function') return rowKey(row)
  if (rowKey && row?.[rowKey] != null) return row[rowKey]
  return index
}

const SortIcon = ({ active, direction }) => {
  if (!active) return <IconSelector size={14} stroke={1.5} />
  return direction === 'asc'
    ? <IconChevronUp size={14} stroke={1.5} />
    : <IconChevronDown size={14} stroke={1.5} />
}

/**
 * Dense records table. Columns are `{ key, label, sortable, render, width, align }`;
 * `render(row)` overrides the raw `row[key]` value.
 */
export const DataTable = ({
  columns,
  rows = [],
  rowKey = 'id',
  selection,
  onSort,
  pagination,
  emptyLabel = 'No records to show.',
  maxHeight = 520,
}) => {
  const [sort, setSort] = useState({ key: null, direction: 'asc' })

  const handleSort = (column) => {
    if (!column.sortable) return
    const direction = sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc'
    setSort({ key: column.key, direction })
    onSort?.({ key: column.key, direction })
  }

  const selectedSet = new Set(selection?.selected ?? [])
  const pageKeys = rows.map((row, index) => resolveKey(row, rowKey, index))
  const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selectedSet.has(key))
  const someSelected = pageKeys.some((key) => selectedSet.has(key)) && !allSelected

  const toggleAll = () => {
    if (!selection) return
    selection.onChange(allSelected ? [] : pageKeys)
  }

  const toggleRow = (key) => {
    if (!selection) return
    const next = selectedSet.has(key)
      ? (selection.selected ?? []).filter((item) => item !== key)
      : [...(selection.selected ?? []), key]
    selection.onChange(next)
  }

  return (
    <>
      <Table.ScrollContainer minWidth={640} mah={maxHeight} type="native">
        <Table stickyHeader>
          <Table.Thead>
            <Table.Tr>
              {selection ? (
                <Table.Th w={40}>
                  <Checkbox
                    aria-label="Select all rows"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </Table.Th>
              ) : null}
              {columns.map((column) => (
                <Table.Th key={column.key} w={column.width} ta={column.align}>
                  {column.sortable ? (
                    <UnstyledButton onClick={() => handleSort(column)} fz="sm" fw={600}>
                      <Group gap={4} wrap="nowrap">
                        <span>{column.label}</span>
                        <SortIcon active={sort.key === column.key} direction={sort.direction} />
                      </Group>
                    </UnstyledButton>
                  ) : (
                    column.label
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length + (selection ? 1 : 0)}>
                  <Text size="sm" c="dimmed" ta="center" py="lg">
                    {emptyLabel}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row, index) => {
                const key = resolveKey(row, rowKey, index)
                return (
                  <Table.Tr key={key} bg={selectedSet.has(key) ? 'var(--mantine-color-forest-light)' : undefined}>
                    {selection ? (
                      <Table.Td>
                        <Checkbox
                          aria-label="Select row"
                          checked={selectedSet.has(key)}
                          onChange={() => toggleRow(key)}
                        />
                      </Table.Td>
                    ) : null}
                    {columns.map((column) => (
                      <Table.Td key={column.key} ta={column.align}>
                        {column.render ? column.render(row) : row[column.key]}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                )
              })
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {pagination && pagination.total > 1 ? (
        <Center mt="sm">
          <Pagination
            size="sm"
            value={pagination.page}
            total={pagination.total}
            onChange={pagination.onChange}
          />
        </Center>
      ) : null}
    </>
  )
}

export default DataTable
