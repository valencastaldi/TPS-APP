import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import OrphanPayments from './pages/OrphanPayments'
import Billing from './pages/Billing'
import ServiceVisits from './pages/ServiceVisits'
import Pileteros from './pages/Pileteros'
import RoutesPage from './pages/Routes'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="payments" element={<Payments />} />
            <Route path="orphan-payments" element={<OrphanPayments />} />
            <Route path="billing" element={<Billing />} />
            <Route path="service-visits" element={<ServiceVisits />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="pileteros" element={<Pileteros />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
