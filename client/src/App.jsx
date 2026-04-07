import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import TemplateFormPage from './pages/TemplateFormPage'
import ResponsesPage from './pages/ResponsesPage'
import CandidateReviewPage from './pages/CandidateReviewPage'
import InterviewPage from './pages/InterviewPage'
import SubmittedPage from './pages/SubmittedPage'
import SetPasswordPage from './pages/SetPasswordPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px' } }} />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/new"
            element={
              <ProtectedRoute>
                <TemplateFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:id/edit"
            element={
              <ProtectedRoute>
                <TemplateFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:id/responses"
            element={
              <ProtectedRoute>
                <ResponsesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:id/responses/:interviewId"
            element={
              <ProtectedRoute>
                <CandidateReviewPage />
              </ProtectedRoute>
            }
          />
          {/* Set password — auth required, handled inline in the page */}
          <Route path="/set-password" element={<SetPasswordPage />} />

          {/* Public candidate routes — no auth required */}
          <Route path="/i/:token"  element={<InterviewPage />} />
          <Route path="/submitted" element={<SubmittedPage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
