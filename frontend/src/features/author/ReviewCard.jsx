import { useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconFlag, IconFlagOff, IconMessage } from '@tabler/icons-react'
import { reviewService } from '../../services'
import { ConfirmModal } from '../../components/common/ConfirmModal.jsx'
import { SentimentBadge, StarRating } from './ReviewPrimitives.jsx'
import { formatReviewDate } from './authorUtils.js'

export const REPLY_TEMPLATES = [
  { label: 'Thank reader', text: 'Thank you so much for taking the time to read and review my book! Your support means a lot to me.' },
  { label: 'Appreciate praise', text: "I'm thrilled you enjoyed the book! Your kind words are truly encouraging and motivate me to keep writing." },
  { label: 'Acknowledge feedback', text: 'Thank you for your honest feedback. I take all reader opinions seriously and will keep your thoughts in mind for future work.' },
  { label: 'Respond to criticism', text: "I'm sorry the book didn't fully meet your expectations. I appreciate you sharing your thoughts — it helps me grow as an author." },
  { label: 'Invite further reading', text: "Thank you for your review! If you enjoyed this one, I hope you'll check out my other works in the library." },
]

const REPLY_MAX = 1000
const FLAG_REASON_MAX = 500

const FlagModal = ({ opened, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('')

  return (
    <ConfirmModal
      opened={opened}
      onClose={onCancel}
      onConfirm={() => onConfirm(reason)}
      title="Flag Inappropriate Review"
      confirmLabel="Flag Review"
      danger
    >
      <Text size="sm" c="dimmed">
        This review will be marked for librarian moderation. Optionally describe the issue.
      </Text>
      <Textarea
        mt="sm"
        rows={3}
        maxLength={FLAG_REASON_MAX}
        placeholder="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        description={`${reason.length} / ${FLAG_REASON_MAX}`}
      />
    </ConfirmModal>
  )
}

/** One reader review with the author's reply and moderation controls. */
export const ReviewCard = ({ review, authorId, sentiment, onUpdate }) => {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState(review.authorReply || '')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagLoading, setFlagLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const textareaRef = useRef(null)

  const hasReply = Boolean(review.authorReply)

  const openReply = () => {
    setReplyText(review.authorReply || '')
    setReplyError('')
    setReplyOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handlePostReply = async () => {
    const text = replyText.trim()
    if (!text) {
      setReplyError('Reply cannot be empty')
      return
    }
    if (text.length > REPLY_MAX) {
      setReplyError(`Reply must not exceed ${REPLY_MAX} characters`)
      return
    }

    setReplyLoading(true)
    setReplyError('')
    try {
      const response = await reviewService.replyToReview(review.reviewId, authorId, text)
      onUpdate(response.data)
      setReplyOpen(false)
    } catch (err) {
      setReplyError(err?.message || 'Failed to post reply')
    } finally {
      setReplyLoading(false)
    }
  }

  const handleDeleteReply = async () => {
    setReplyLoading(true)
    setActionError('')
    try {
      const response = await reviewService.deleteReply(review.reviewId, authorId)
      onUpdate(response.data)
      setReplyOpen(false)
    } catch (err) {
      setActionError(err?.message || 'Failed to delete reply')
    } finally {
      setReplyLoading(false)
    }
  }

  const handleFlag = async (reason) => {
    setFlagOpen(false)
    setFlagLoading(true)
    setActionError('')
    try {
      const response = await reviewService.flagReview(review.reviewId, authorId, reason)
      onUpdate(response.data)
    } catch (err) {
      setActionError(err?.message || 'Failed to flag review')
    } finally {
      setFlagLoading(false)
    }
  }

  const handleUnflag = async () => {
    setFlagLoading(true)
    setActionError('')
    try {
      const response = await reviewService.unflagReview(review.reviewId, authorId)
      onUpdate(response.data)
    } catch (err) {
      setActionError(err?.message || 'Failed to unflag review')
    } finally {
      setFlagLoading(false)
    }
  }

  return (
    <Paper withBorder p="md" bg={review.flagged ? 'var(--mantine-color-red-light)' : undefined}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Group gap="xs" wrap="nowrap">
          <Avatar size={32} radius="xl" color="forest">
            {(review.reviewerName || '?')[0].toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            <Text size="sm" fw={500}>
              {review.reviewerName || 'Anonymous'}
            </Text>
            <Text size="xs" c="dimmed">
              {formatReviewDate(review.createdAt)}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <StarRating rating={review.rating} />
          <SentimentBadge sentiment={sentiment} />
          {review.flagged ? (
            <Tooltip label={review.flagReason || 'Flagged for review'}>
              <Badge size="xs" color="red" leftSection={<IconFlag size={12} stroke={1.5} />}>
                Flagged
              </Badge>
            </Tooltip>
          ) : null}
        </Group>
      </Group>

      {review.reviewText ? (
        <Text size="sm" mt="sm">
          {review.reviewText}
        </Text>
      ) : null}

      {hasReply && !replyOpen ? (
        <Paper withBorder p="sm" mt="sm" bg="var(--app-inset)">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.4}>
            Your reply
          </Text>
          <Text size="sm" mt={4}>
            {review.authorReply}
          </Text>
          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">
              {formatReviewDate(review.authorReplyAt)}
            </Text>
            <Group gap={4}>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={openReply}>
                Edit
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                loading={replyLoading}
                onClick={handleDeleteReply}
              >
                Delete
              </Button>
            </Group>
          </Group>
        </Paper>
      ) : null}

      {replyOpen ? (
        <Stack gap="xs" mt="sm">
          <Text size="sm" fw={500}>
            {hasReply ? 'Edit your reply' : 'Write a reply'}
          </Text>
          <Group gap={4} wrap="wrap">
            <Text size="xs" c="dimmed">
              Templates:
            </Text>
            {REPLY_TEMPLATES.map((template) => (
              <Button
                key={template.label}
                size="compact-xs"
                variant="default"
                title={template.text}
                disabled={replyLoading}
                onClick={() => {
                  setReplyText(template.text)
                  setReplyError('')
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}
              >
                {template.label}
              </Button>
            ))}
          </Group>
          <Textarea
            ref={textareaRef}
            rows={3}
            maxLength={REPLY_MAX}
            value={replyText}
            placeholder="Write a thoughtful reply to this review…"
            onChange={(event) => {
              setReplyText(event.currentTarget.value)
              setReplyError('')
            }}
            error={replyError}
            description={`${replyText.length} / ${REPLY_MAX}`}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="compact-sm" onClick={() => setReplyOpen(false)} disabled={replyLoading}>
              Cancel
            </Button>
            <Button size="compact-sm" loading={replyLoading} onClick={handlePostReply}>
              {hasReply ? 'Update Reply' : 'Post Reply'}
            </Button>
          </Group>
        </Stack>
      ) : null}

      {actionError ? (
        <Alert color="red" variant="light" mt="sm" icon={<IconAlertCircle size={16} stroke={1.5} />}>
          {actionError}
        </Alert>
      ) : null}

      <Group gap={4} mt="sm">
        {!replyOpen && !hasReply ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconMessage size={16} stroke={1.5} />}
            onClick={openReply}
          >
            Reply
          </Button>
        ) : null}
        {review.reviewText ? (
          review.flagged ? (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconFlagOff size={16} stroke={1.5} />}
              loading={flagLoading}
              onClick={handleUnflag}
            >
              Remove Flag
            </Button>
          ) : (
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              leftSection={<IconFlag size={16} stroke={1.5} />}
              loading={flagLoading}
              onClick={() => setFlagOpen(true)}
            >
              Flag
            </Button>
          )
        ) : null}
      </Group>

      <FlagModal opened={flagOpen} onCancel={() => setFlagOpen(false)} onConfirm={handleFlag} />
    </Paper>
  )
}

export default ReviewCard
