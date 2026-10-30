import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBooks, IconChartBar, IconMessage, IconPlus, IconUser, IconX } from '@tabler/icons-react'
import { PortalShell } from '../../components/layout/PortalShell.jsx'
import { useAuth } from '../../auth/useAuth'
import { PORTAL_SESSION_KEYS, clearPortalSession, loadPortalSession, savePortalSession } from '../../utils/portalSession'
import { AuthorBooksTab } from './AuthorBooksTab.jsx'
import { AuthorNotifications } from './AuthorNotifications.jsx'
import { AuthorProfileModal } from './AuthorProfileModal.jsx'
import { AuthorReviews } from './AuthorReviews.jsx'
import { AuthorStats } from './AuthorStats.jsx'
import { BookPublishing } from './BookPublishing.jsx'
import { useAuthorBooks } from './useAuthorBooks.js'
import { useAuthorNotifications } from './useAuthorNotifications.js'

const SESSION_KEY = PORTAL_SESSION_KEYS.author

const NAV_ITEMS = [
  { value: 'books', label: 'My Books', icon: IconBooks },
  { value: 'stats', label: 'Statistics', icon: IconChartBar },
  { value: 'reviews', label: 'Reviews', icon: IconMessage },
]

export const AuthorPortal = () => {
  const navigate = useNavigate()
  const { userId: authorId, username, fullName, role, logout, updateAuth } = useAuth()
  const [session] = useState(() => loadPortalSession(SESSION_KEY))

  const [tab, setTab] = useState(session?.mainTab || 'books')
  const [publishOpen, setPublishOpen] = useState(Boolean(session?.showPublishForm))
  const [profileOpen, setProfileOpen] = useState(Boolean(session?.showProfilePopup))
  const [detailBookId, setDetailBookId] = useState(session?.selectedBookId ?? null)
  const [selectedBookIds, setSelectedBookIds] = useState(
    Array.isArray(session?.selectedBookIds) ? session.selectedBookIds : [],
  )
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(Boolean(session?.showBulkDeleteDialog))
  const [notificationView, setNotificationView] = useState(session?.notificationView || 'ACTIVE')
  const [notificationFilter, setNotificationFilter] = useState(session?.notificationFilter || 'ALL')
  const [notificationSearch, setNotificationSearch] = useState(session?.notificationSearch || '')
  const [bio, setBio] = useState(session?.bio || '')

  const { books, loading, error, reload } = useAuthorBooks(authorId)
  const board = useAuthorNotifications({
    authorId,
    books,
    view: notificationView,
    filter: notificationFilter,
    search: notificationSearch,
  })

  useEffect(() => {
    if (!session) return
    notifications.show({
      message: 'Recovered your previous author session successfully.',
      color: 'gray',
      autoClose: 3500,
      withBorder: true,
    })
  }, [session])

  useEffect(() => {
    if (!authorId) return
    savePortalSession(SESSION_KEY, {
      mainTab: tab,
      showPublishForm: publishOpen,
      showProfilePopup: profileOpen,
      showBulkDeleteDialog: bulkDeleteOpen,
      selectedBookId: detailBookId,
      selectedBookIds,
      notificationView,
      notificationFilter,
      notificationSearch,
      bio,
    })
  }, [
    authorId,
    tab,
    publishOpen,
    profileOpen,
    bulkDeleteOpen,
    detailBookId,
    selectedBookIds,
    notificationView,
    notificationFilter,
    notificationSearch,
    bio,
  ])

  // A book deleted elsewhere (or by a failed restore) must not stay selected.
  useEffect(() => {
    setSelectedBookIds((prev) => {
      const known = new Set(books.map((book) => book.id))
      const next = prev.filter((id) => known.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [books])

  const handleLogout = () => {
    clearPortalSession(SESSION_KEY)
    logout()
    navigate('/')
  }

  const handlePasswordChanged = () => {
    clearPortalSession(SESSION_KEY)
    logout()
    navigate('/author/login')
  }

  const notificationsPanel = (
    <AuthorNotifications
      notifications={board.notifications}
      categoryCounts={board.categoryCounts}
      unreadCount={board.unreadCount}
      readNotificationIds={board.readNotificationIds}
      view={notificationView}
      onViewChange={setNotificationView}
      filter={notificationFilter}
      onFilterChange={setNotificationFilter}
      search={notificationSearch}
      onSearchChange={setNotificationSearch}
      onToggleRead={board.toggleRead}
      onArchive={board.archive}
      onRestore={board.restore}
      onDelete={board.remove}
      onMarkAllRead={board.markAllRead}
    />
  )

  return (
    <PortalShell
      portalName="Author portal"
      navItems={NAV_ITEMS}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={handleLogout}
      headerActions={(
        <>
          <Button
            variant="default"
            leftSection={<IconUser size={16} stroke={1.5} />}
            onClick={() => setProfileOpen(true)}
          >
            Profile
          </Button>
          <Button
            variant={publishOpen ? 'default' : 'filled'}
            leftSection={publishOpen
              ? <IconX size={16} stroke={1.5} />
              : <IconPlus size={16} stroke={1.5} />}
            onClick={() => setPublishOpen((prev) => !prev)}
          >
            {publishOpen ? 'Close Publish Form' : 'Publish New Book'}
          </Button>
        </>
      )}
    >
      {tab === 'books' ? (
        <AuthorBooksTab
          authorId={authorId}
          books={books}
          loading={loading}
          error={error}
          reload={reload}
          selectedBookIds={selectedBookIds}
          onSelectionChange={setSelectedBookIds}
          detailBookId={detailBookId}
          onDetailChange={setDetailBookId}
          bulkDeleteOpen={bulkDeleteOpen}
          onBulkDeleteOpenChange={setBulkDeleteOpen}
          onDeletionNotification={board.addDeletionNotification}
          notificationsPanel={notificationsPanel}
        />
      ) : null}

      {tab === 'stats' ? <AuthorStats authorId={authorId} /> : null}
      {tab === 'reviews' ? <AuthorReviews authorId={authorId} /> : null}

      <Modal
        opened={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish New Book"
        size="xl"
      >
        <BookPublishing
          authorId={authorId}
          authorName={fullName}
          onSubmitSuccess={() => {
            reload()
            notifications.show({ message: 'Book submitted successfully.', color: 'green', withBorder: true })
          }}
          onCancel={() => setPublishOpen(false)}
        />
      </Modal>

      {profileOpen ? (
        <AuthorProfileModal
          authorId={authorId}
          username={username}
          role={role}
          fullName={fullName}
          bio={bio}
          onClose={() => setProfileOpen(false)}
          onProfileSaved={(next) => {
            updateAuth({ fullName: next.fullName })
            setBio(next.bio || '')
          }}
          onPasswordChanged={handlePasswordChanged}
        />
      ) : null}
    </PortalShell>
  )
}

export default AuthorPortal
