import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ApplicationProcess from './pages/ApplicationProcess'
import AboutUs from './pages/AboutUs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/application-process" element={<ApplicationProcess />} />
        <Route path="/about" element={<AboutUs />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App