import { Navigate, useLocation } from 'react-router-dom'
import { loginPathForLocation } from '../services/api'
import { portalPathForRole } from './AuthContext.jsx'
import { useAuth } from './useAuth'

/**
 * Gate for the portal routes. Missing auth sends the visitor to the login page
 * of the portal they aimed at; a signed-in user with the wrong role is sent to
 * their own portal rather than a 403 dead-end.
 */
export const RequireRole = ({ roles, children }) => {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const target = loginPathForLocation(location.pathname) ?? '/'
    return <Navigate to={target} replace state={{ from: location.pathname }} />
  }

  const allowed = roles.map((item) => item.toUpperCase())
  if (!allowed.includes(String(role).toUpperCase())) {
    return <Navigate to={portalPathForRole(role)} replace />
  }

  return children
}

export default RequireRole
