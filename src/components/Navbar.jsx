import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'
import VideoModal from './VideoModal'
import ChoiceModal from './ChoiceModal'
import EarlyBuildersForm from './EarlyBuildersForm'
import EarlyPartnersForm from './EarlyPartnersForm'

function Navbar() {
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const [isChoiceOpen, setIsChoiceOpen] = useState(false)
  const [isBuildersOpen, setIsBuildersOpen] = useState(false)
  const [isPartnersOpen, setIsPartnersOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[60] bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center">
            <img 
              src={logo} 
              alt="YZI Works" 
              className="h-10 md:h-12 w-auto object-contain"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <Link to="/about" className="hover:text-white transition">About Us</Link>
            <button onClick={() => setIsVideoOpen(true)} className="hover:text-white transition">
              Dashboard
            </button>
            <Link to="/application-process" className="hover:text-white transition">
              Application Process
            </Link>
          </div>

          {/* Desktop CTA */}
          <button 
            onClick={() => setIsChoiceOpen(true)}
            className="hidden md:block px-5 py-2 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-sm font-medium hover:scale-105 transition-transform"
          >
            Apply Now
          </button>

          {/* Mobile Hamburger */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
          >
            <span className={`w-6 h-0.5 bg-white transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-white transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-white transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-black/95 border-t border-white/10 px-5 py-6 space-y-4">
            <a 
              href="#programs" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-white/90 py-2"
            >
              Programs
            </a>
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false)
                setIsVideoOpen(true)
              }}
              className="block text-white/90 py-2 w-full text-left"
            >
              Dashboard
            </button>
            <Link 
              to="/application-process"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-white/90 py-2"
            >
              Application Process
            </Link>
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false)
                setIsChoiceOpen(true)
              }}
              className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-sm font-medium"
            >
              Apply Here
            </button>
          </div>
        )}
      </nav>

      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
      
      <ChoiceModal
        isOpen={isChoiceOpen}
        onClose={() => setIsChoiceOpen(false)}
        onSelectBuilder={() => {
          setIsChoiceOpen(false)
          setIsBuildersOpen(true)
        }}
        onSelectPartner={() => {
          setIsChoiceOpen(false)
          setIsPartnersOpen(true)
        }}
      />

      <EarlyBuildersForm isOpen={isBuildersOpen} onClose={() => setIsBuildersOpen(false)} />
      <EarlyPartnersForm isOpen={isPartnersOpen} onClose={() => setIsPartnersOpen(false)} />
    </>
  )
}

export default Navbar