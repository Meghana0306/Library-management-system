import { authAPI } from '../../services/api'
import { PortalAuthPage } from '../auth/PortalAuthPage.jsx'

export const LibrarianAuthPage = () => (
  <PortalAuthPage
    title="Librarian sign in"
    loginDescription="Approve submissions and manage the collection."
    loginFn={authAPI.loginLibrarian}
    acceptedRoles={['LIBRARIAN']}
    wrongRoleMessage="Only librarians can login here"
    registrationVariant="librarian"
  />
)

export default LibrarianAuthPage
