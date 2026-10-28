import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Shell from './components/Shell'
import LegacyRoom from './components/LegacyRoom'
import TemplatesPage from './pages/templates/TemplatesPage'
import ReachPage from './pages/ReachPage'
import SettingsPage from './pages/SettingsPage'
import TodayPage from './pages/TodayPage'
import AdsManager from './pages/AdsManager'
import AnalyticsPage from './pages/AnalyticsPage'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><Shell /></PrivateRoute>}>
              <Route index element={<Navigate to="/today" replace />} />
              <Route path="today" element={<TodayPage />} />
              <Route path="templates/*" element={<TemplatesPage />} />
              <Route path="numbers" element={<LegacyRoom><AnalyticsPage /></LegacyRoom>} />
              <Route path="reach/*" element={<ReachPage />} />
              <Route path="income" element={<LegacyRoom><AdsManager /></LegacyRoom>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
