import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { RequireRole } from './auth/RequireRole.jsx'
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'

const StudentAuthPage = lazy(() => import('./features/student/StudentAuthPage.jsx'))
const AuthorAuthPage = lazy(() => import('./features/author/AuthorAuthPage.jsx'))
const LibrarianAuthPage = lazy(() => import('./features/librarian/LibrarianAuthPage.jsx'))

const StudentPortal = lazy(() => import('./features/student/StudentPortal.jsx'))
const AuthorPortal = lazy(() => import('./features/author/AuthorPortal.jsx'))
const LibrarianPortal = lazy(() => import('./features/librarian/LibrarianPortal.jsx'))

const RouteFallback = () => (
  <Center h="60vh">
    <Loader size="sm" />
  </Center>
)

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/student/login" element={<StudentAuthPage />} />
            <Route path="/author/login" element={<AuthorAuthPage />} />
            <Route path="/librarian/login" element={<LibrarianAuthPage />} />

            <Route
              path="/student"
              element={(
                <RequireRole roles={['STUDENT', 'STAFF']}>
                  <StudentPortal />
                </RequireRole>
              )}
            />
            <Route
              path="/author"
              element={(
                <RequireRole roles={['AUTHOR']}>
                  <AuthorPortal />
                </RequireRole>
              )}
            />
            <Route
              path="/librarian"
              element={(
                <RequireRole roles={['LIBRARIAN']}>
                  <LibrarianPortal />
                </RequireRole>
              )}
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
