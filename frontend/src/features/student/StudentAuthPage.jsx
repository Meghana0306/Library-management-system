import { authAPI } from '../../services/api'
import { PortalAuthPage } from '../auth/PortalAuthPage.jsx'

// The generic /auth/login endpoint accepts any role, so this is the one
// portal where the client-side accepted-role check actually matters.
export const StudentAuthPage = () => (
  <PortalAuthPage
    title="Student / Staff sign in"
    loginDescription="Browse the catalogue, borrow books and track your reading history."
    loginFn={authAPI.login}
    acceptedRoles={['STUDENT', 'STAFF']}
    wrongRoleMessage="Only students and staff can login here"
    registrationVariant="student"
  />
)

export default StudentAuthPage
