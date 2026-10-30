import { authAPI } from '../../services/api'
import { PortalAuthPage } from '../auth/PortalAuthPage.jsx'

export const AuthorAuthPage = () => (
  <PortalAuthPage
    title="Author sign in"
    loginDescription="Submit books for approval and track their performance."
    loginFn={authAPI.loginAuthor}
    acceptedRoles={['AUTHOR']}
    wrongRoleMessage="Only authors can login here"
    registrationVariant="author"
  />
)

export default AuthorAuthPage
