import Navbar from './components/Navbar'
import HeroSlider from './components/HeroSlider'
import Hero from './components/Hero'
import Programs from './components/Programs'
import AIAdvantage from './components/AIAdvantage'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-yzi-black text-white">
      <Navbar />
      <HeroSlider />
      <Hero />
      <Programs />
      <AIAdvantage />
      <FinalCTA />
      <Footer />
    </div>
  )
}

export default App