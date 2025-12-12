import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ServicesPage from './pages/ServicesPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ConfigsPage from './pages/ConfigsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ServicesPage />} />
        <Route path="/services/:code" element={<ServiceDetailPage />} />
      </Routes>
    </Layout>
  )
}
