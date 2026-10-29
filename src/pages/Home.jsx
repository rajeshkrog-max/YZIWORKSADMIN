import Navbar from '../components/Navbar'
import HeroSlider from '../components/HeroSlider'
import SeraPromo from '../components/SeraPromo'
import Hero from '../components/Hero'
import Programs from '../components/Programs'
import PoweredBy from '../components/PoweredBy'
import AIAdvantage from '../components/AIAdvantage'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

function Home() {
  return (
    <div className="min-h-screen bg-yzi-black text-fg">
      <Navbar />
      <HeroSlider />
      <SeraPromo />
      <Hero />
      <Programs />
      <PoweredBy />
      <AIAdvantage />
      <FinalCTA />
      <Footer />
    </div>
  )
}

export default Home
