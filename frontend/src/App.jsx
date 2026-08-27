import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Analytics from './pages/Analytics'
import Upload from './pages/Upload'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm font-medium',
          style: { borderRadius: '12px', border: '1px solid #e5e7eb' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/chat"     element={<Chat />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/upload"   element={<Upload />} />
          <Route path="/alerts"   element={<Alerts />} />
          <Route path="/reports"  element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
