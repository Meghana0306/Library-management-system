import { useState } from 'react'
import { NumberInput, Select, Text } from '@mantine/core'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'

const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'REJECTED']

/** Optional status/quantity change applied to every selected book. */
export const BulkEditBooksModal = ({ opened, count, onClose, onSubmit, loading }) => {
  const [status, setStatus] = useState('')
  const [quantity, setQuantity] = useState('')

  const handleConfirm = () => {
    const payload = {}
    if (status) payload.status = status
    if (quantity !== '') payload.quantity = Number(quantity)
    onSubmit(payload)
  }

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={loading}
      title="Bulk edit books"
      confirmLabel="Apply changes"
    >
      <Text size="sm" mb="sm">Apply changes to {count} selected book(s). Leave a field blank to keep it unchanged.</Text>
      <Select
        label="Status (optional)"
        data={[{ value: '', label: 'No change' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        value={status}
        onChange={(value) => setStatus(value || '')}
        mb="sm"
      />
      <NumberInput
        label="Quantity (optional)"
        min={1}
        value={quantity}
        onChange={(value) => setQuantity(value === '' ? '' : value)}
      />
    </ConfirmModal>
  )
}

/** Confirms permanent deletion of every selected book. */
export const BulkDeleteBooksModal = ({ opened, count, onClose, onSubmit, loading }) => (
  <ConfirmModal
    opened={opened}
    onClose={onClose}
    onConfirm={onSubmit}
    loading={loading}
    danger
    title="Delete selected books"
    confirmLabel="Delete selected"
    message={`Delete ${count} selected book(s)? This cannot be undone.`}
  />
)

export default BulkEditBooksModal
