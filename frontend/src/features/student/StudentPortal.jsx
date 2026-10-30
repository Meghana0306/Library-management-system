import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionIcon, Center, Loader, Modal, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconBell,
  IconBookmark,
  IconBooks,
  IconClipboardList,
  IconHistory,
  IconSettings,
  IconStar,
} from '@tabler/icons-react'
import { PortalShell } from '../../components/layout/PortalShell.jsx'
import { useAuth } from '../../auth/useAuth'
import { clearPortalSession, loadPortalSession, PORTAL_SESSION_KEYS, savePortalSession } from '../../utils/portalSession'
import { AvailableBooks } from './AvailableBooks.jsx'
import { BorrowBook } from './BorrowBook.jsx'
import { BorrowedBooksPanel } from './BorrowedBooksPanel.jsx'
import { MyReviews } from './MyReviews.jsx'
import { BookRequestForm } from './BookRequestForm.jsx'
import { StudentNotificationBoard } from './StudentNotificationBoard.jsx'
import { StudentManageProfile } from './StudentManageProfile.jsx'

const ReadingHistory = lazy(() => import('./ReadingHistory.jsx'))

const SESSION_KEY = PORTAL_SESSION_KEYS.student

const NAV_ITEMS = [
  { value: 'available', label: 'Available Books', icon: IconBooks },
  { value: 'borrowed', label: 'Borrowed Books', icon: IconBookmark },
  { value: 'notifications', label: 'Notification Board', icon: IconBell },
  { value: 'history', label: 'Reading History', icon: IconHistory },
  { value: 'reviews', label: 'My Reviews', icon: IconStar },
  { value: 'request', label: 'Request a Book', icon: IconClipboardList },
]

export const StudentPortal = () => {
  const navigate = useNavigate()
  const { userId, fullName, username, role, updateAuth, logout } = useAuth()

  const [activeTab, setActiveTab] = useState('available')
  const [selectedBooks, setSelectedBooks] = useState([])
  const [openReaderRecordId, setOpenReaderRecordId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const restoredRef = useRef(false)

  useEffect(() => {
    const session = loadPortalSession(SESSION_KEY)
    if (session) {
      setActiveTab(session.activeTab || 'available')
      setSelectedBooks(Array.isArray(session.selectedBooks) ? session.selectedBooks : [])
      setOpenReaderRecordId(session.openReaderRecordId || null)
      notifications.show({ message: 'Recovered your previous session.', autoClose: 3500 })
    }
    restoredRef.current = true
  }, [])

  useEffect(() => {
    if (!restoredRef.current) return
    savePortalSession(SESSION_KEY, { activeTab, selectedBooks, openReaderRecordId })
  }, [activeTab, selectedBooks, openReaderRecordId])

  const handleTabChange = (tab) => {
    if (tab !== 'available') setSelectedBooks([])
    setActiveTab(tab)
  }

  const handleLogout = () => {
    clearPortalSession(SESSION_KEY)
    logout()
    navigate('/')
  }

  const handleForceLogout = () => {
    setShowProfile(false)
    clearPortalSession(SESSION_KEY)
    logout()
    navigate('/student/login')
  }

  const navItems = NAV_ITEMS.map((item) => (
    item.value === 'notifications' && unreadCount > 0 ? { ...item, badge: unreadCount } : item
  ))

  return (
    <PortalShell
      portalName="Student / Staff portal"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onLogout={handleLogout}
      headerActions={(
        <Tooltip label="Manage profile">
          <ActionIcon variant="default" onClick={() => setShowProfile(true)} aria-label="Manage profile">
            <IconSettings size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      )}
    >
      {activeTab === 'available' ? (
        selectedBooks.length > 0 ? (
          <BorrowBook
            books={selectedBooks}
            userId={userId}
            onClose={() => setSelectedBooks([])}
            onSuccess={() => setSelectedBooks([])}
          />
        ) : (
          <AvailableBooks userId={userId} onSelectBooks={setSelectedBooks} />
        )
      ) : null}

      {activeTab === 'borrowed' ? (
        <BorrowedBooksPanel
          userId={userId}
          restoreRecordId={openReaderRecordId}
          onReaderRecordChange={setOpenReaderRecordId}
        />
      ) : null}

      {activeTab === 'notifications' ? (
        <StudentNotificationBoard userId={userId} onUnreadCountChange={setUnreadCount} />
      ) : null}

      {activeTab === 'history' ? (
        <Suspense fallback={<Center h="40vh"><Loader size="sm" /></Center>}>
          <ReadingHistory userId={userId} />
        </Suspense>
      ) : null}

      {activeTab === 'reviews' ? <MyReviews userId={userId} /> : null}

      {activeTab === 'request' ? <BookRequestForm userId={userId} /> : null}

      <Modal opened={showProfile} onClose={() => setShowProfile(false)} title="Manage Profile" size="md">
        <StudentManageProfile
          userId={userId}
          fullName={fullName}
          username={username}
          role={role}
          onProfileUpdated={(patch) => updateAuth(patch)}
          onForceLogout={handleForceLogout}
          onClose={() => setShowProfile(false)}
        />
      </Modal>
    </PortalShell>
  )
}

export default StudentPortal
