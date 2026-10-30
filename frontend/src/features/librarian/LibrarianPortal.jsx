import { useEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import {
  IconBell,
  IconBooks,
  IconChartBar,
  IconClipboardCheck,
  IconHistory,
  IconMessage2,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react'
import { PortalShell } from '../../components/layout/PortalShell.jsx'
import { PORTAL_SESSION_KEYS, loadPortalSession, savePortalSession } from '../../utils/portalSession.js'
import { LibrarianApproval } from './LibrarianApproval.jsx'
import { ManagePublishedBooks } from './ManagePublishedBooks.jsx'
import { ManageAllUsers } from './ManageAllUsers.jsx'
import { ManageOwnProfile } from './ManageOwnProfile.jsx'
import { BorrowedBooksRecord } from './BorrowedBooksRecord.jsx'
import { NotificationBoard } from './NotificationBoard.jsx'
import { BookRequestsPanel } from './BookRequestsPanel.jsx'
import { DownloadedBookStats } from './DownloadedBookStats.jsx'

const SESSION_KEY = PORTAL_SESSION_KEYS.librarian

const TAB_META = [
  { value: 'approval', label: 'Book Approvals', icon: IconClipboardCheck },
  { value: 'managebooks', label: 'Manage Books', icon: IconBooks },
  { value: 'users', label: 'Manage Users', icon: IconUsers },
  { value: 'profile', label: 'My Profile', icon: IconUserCircle },
  { value: 'records', label: 'Borrow Records', icon: IconHistory },
  { value: 'notifications', label: 'Notification Board', icon: IconBell },
  { value: 'bookrequests', label: 'Book Requests', icon: IconMessage2 },
  { value: 'downloadstats', label: 'Download Stats', icon: IconChartBar },
]

const VALID_TABS = new Set(TAB_META.map((tab) => tab.value))

/**
 * Librarian portal shell: PortalShell chrome + the 8 feature tabs. Session
 * restore only needs to remember the active tab — sign-in state itself lives
 * in the global `library.auth` record (AuthContext), not here.
 */
export const LibrarianPortal = () => {
  const restored = useRef(false)
  const [activeTab, setActiveTab] = useState(() => {
    const saved = loadPortalSession(SESSION_KEY)?.activeTab
    return VALID_TABS.has(saved) ? saved : 'approval'
  })
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (loadPortalSession(SESSION_KEY)) {
      notifications.show({
        title: 'Session restored',
        message: 'Picked up where you left off.',
        color: 'forest',
        autoClose: 3500,
      })
    }
  }, [])

  useEffect(() => {
    savePortalSession(SESSION_KEY, { activeTab })
  }, [activeTab])

  const navItems = TAB_META.map((tab) => ({
    ...tab,
    label: tab.value === 'notifications' && unreadCount > 0
      ? `${tab.label} (${unreadCount})`
      : tab.label,
  }))

  return (
    <PortalShell
      portalName="Librarian portal"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'approval' && <LibrarianApproval />}
      {activeTab === 'managebooks' && <ManagePublishedBooks />}
      {activeTab === 'users' && <ManageAllUsers />}
      {activeTab === 'profile' && <ManageOwnProfile />}
      {activeTab === 'records' && <BorrowedBooksRecord />}
      {activeTab === 'notifications' && <NotificationBoard onUnreadCountChange={setUnreadCount} />}
      {activeTab === 'bookrequests' && <BookRequestsPanel />}
      {activeTab === 'downloadstats' && <DownloadedBookStats />}
    </PortalShell>
  )
}

export default LibrarianPortal
