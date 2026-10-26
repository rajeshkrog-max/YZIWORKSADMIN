import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ApplicationProcess from './pages/ApplicationProcess'
import AboutUs from './pages/AboutUs'
import MeetSera from './pages/MeetSera'
import Policies from './pages/Policies'
import AnnouncementBar from './components/AnnouncementBar'

function App() {
  return (
    <BrowserRouter>
      <AnnouncementBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/application-process" element={<ApplicationProcess />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/meet-sera" element={<MeetSera />} />
        <Route path="/terms" element={<Policies page="terms" />} />
        <Route path="/refund-policy" element={<Policies page="refund" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App