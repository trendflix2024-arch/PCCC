import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CustomsForm from './CustomsForm.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import ReturnDashboard from './ReturnDashboard.jsx'

const path = window.location.pathname

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/admin'   ? <AdminDashboard />  :
     path === '/returns' ? <ReturnDashboard /> :
                           <CustomsForm />}
  </StrictMode>,
)
