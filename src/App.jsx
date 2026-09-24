import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import ApplicationProcess from './pages/ApplicationProcess'
import AboutUs from './pages/AboutUs'
import MeetSera from './pages/MeetSera'
import AnnouncementBar from './components/AnnouncementBar'

const routeTitles = {
  '/': 'YZI Works',
  '/about': 'About Us | YZI Works',
  '/meet-sera': 'Meet AI Sera | YZI Works',
  '/application-process': 'Application Process | YZI Works'
}

function PageTitleManager() {
  const location = useLocation()

  useEffect(() => {
    const title = routeTitles[location.pathname] || 'YZI Works'
    document.title = title
  }, [location])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <PageTitleManager />
      <AnnouncementBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/application-process" element={<ApplicationProcess />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/meet-sera" element={<MeetSera />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App