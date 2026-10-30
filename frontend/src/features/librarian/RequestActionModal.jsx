import { useState } from 'react'
import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { bookRequestService } from '../../services'
import { ApiError } from '../../services/api'

/**
 * Approve/reject confirmation for a single request or every request grouped
 * under the same title+author. Rejection requires a reason (max 500 chars).
 */
export const RequestActionModal = ({ actionRequest, onClose, onDone }) => {
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!actionRequest) return null

  const { req, action, allInGroup = [] } = actionRequest
  const targets = allInGroup.length > 0 ? allInGroup : [req]
  const isApprove = action === 'APPROVED'

  const handleConfirm = async () => {
    if (!isApprove && !rejectionReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await Promise.allSettled(targets.map((r) => bookRequestService.updateRequestStatus(r.requestId, {
        status: action,
        rejectionReason: isApprove ? undefined : rejectionReason.trim(),
      })))
      const failed = results.filter((r) => r.status === 'rejected')
      const succeeded = results.length - failed.length
      if (failed.length === 0) {
        onDone({ type: 'success', message: `${succeeded} request${succeeded !== 1 ? 's' : ''} ${action.toLowerCase()} successfully!` })
      } else if (succeeded > 0) {
        const reason = failed[0].reason instanceof ApiError ? failed[0].reason.message : 'unknown error'
        onDone({ type: 'partial', message: `${succeeded} updated, ${failed.length} failed: ${reason}` })
      } else {
        const reason = failed[0].reason instanceof ApiError ? failed[0].reason.message : `Failed to ${action.toLowerCase()} request.`
        setError(reason)
        return
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action.toLowerCase()} request.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal opened onClose={onClose} title={isApprove ? 'Approve request' : 'Reject request'} size="md">
      <Stack gap="sm">
        <Text size="sm">
          {isApprove ? 'Approve' : 'Reject'} the request for &quot;{req.title}&quot; by {req.author}?
        </Text>
        {targets.length > 1 ? (
          <Text size="sm" c="dimmed">
            This applies to all {targets.length} requests for this book:{' '}
            {targets.map((r) => r.requesterName || `User #${r.userId}`).join(', ')}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">Requested by: {req.requesterName || `User #${req.userId}`}</Text>
        )}

        {!isApprove ? (
          <Textarea
            label="Rejection reason"
            required
            rows={3}
            maxLength={500}
            placeholder="Explain why this request is being rejected..."
            value={rejectionReason}
            onChange={(event) => { setRejectionReason(event.currentTarget.value); setError('') }}
          />
        ) : null}

        {error ? <Text size="sm" c="red">{error}</Text> : null}

        <Group justify="flex-end" gap="xs" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button color={isApprove ? undefined : 'red'} onClick={handleConfirm} loading={loading}>
            {isApprove ? 'Confirm approve' : 'Confirm reject'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default RequestActionModal
