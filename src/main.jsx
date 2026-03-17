import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CustomsForm from './CustomsForm.jsx'
import AdminDashboard from './AdminDashboard.jsx'

const isAdmin = window.location.pathname === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? <AdminDashboard /> : <CustomsForm />}
  </StrictMode>,
)
