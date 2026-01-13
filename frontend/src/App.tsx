import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ServicesPage from './pages/ServicesPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import TokensMonitorPage from './pages/TokensMonitorPage'
import BackendBasePage from './pages/BackendBasePage'
import LoginPage from './pages/LoginPage'
import { EnvProvider } from './context/EnvContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <EnvProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<ServicesPage />} />
                      <Route path="/tokens-monitor" element={<TokensMonitorPage />} />
                      <Route path="/backend-bases" element={<BackendBasePage />} />
                      <Route path="/services/:code" element={<ServiceDetailPage />} />
                    </Routes>
                  </Layout>
                </RequireAuth>
              }
            />
          </Routes>
        </EnvProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
