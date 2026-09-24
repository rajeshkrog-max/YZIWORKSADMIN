import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'
import ChoiceModal from './ChoiceModal'
import EarlyBuildersForm from './EarlyBuildersForm'
import EarlyPartnersForm from './EarlyPartnersForm'
import ThemeToggle from '../theme/ThemeToggle'

// Desktop nav links: on hover/focus a thin orange→blue underline grows from the
// centre with a soft neon glow (weaker in light theme). It lives on ::after, so
// the link's box never changes size — no layout shift.
const NAV_LINK_CLASS = [
  'relative rounded-sm transition-colors duration-200 hover:text-fg focus-visible:text-fg',
  'focus-visible:outline-none',
  "after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-[2px] after:rounded-full",
  'after:bg-gradient-to-r after:from-yzi-orange after:to-yzi-blue',
  'after:scale-x-0 after:origin-center after:transition-transform after:duration-200 motion-reduce:after:transition-none',
  'hover:after:scale-x-100 focus-visible:after:scale-x-100',
  'after:shadow-[0_0_8px_rgba(255,94,0,0.85),0_0_16px_rgba(59,130,246,0.75)]',
  'light:after:shadow-[0_0_5px_rgba(255,94,0,0.35),0_0_9px_rgba(59,130,246,0.3)]',
].join(' ')

function Navbar() {
  const [isChoiceOpen, setIsChoiceOpen] = useState(false)
  const [isBuildersOpen, setIsBuildersOpen] = useState(false)
  const [isPartnersOpen, setIsPartnersOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-11 md:top-12 left-0 w-full z-[60] bg-pure/80 backdrop-blur-md border-b border-fg/10">
        {/* md:pr-[92px] reserves room for the corner toggle until the side
            margins of the max-w-6xl row are wide enough to hold it (≥1336px). */}
        <div className="max-w-6xl mx-auto px-5 md:pr-[92px] min-[1336px]:pr-5 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center light:bg-logo-chip light:rounded-xl light:px-2.5 light:py-1">
            <img 
              src={logo} 
              alt="YZI Works" 
              className="h-10 md:h-12 w-auto object-contain"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8 text-sm text-fg/80">
            <Link to="/about" className={NAV_LINK_CLASS}>About Us</Link>
            <Link to="/meet-sera" className={NAV_LINK_CLASS}>
              Meet Ai Sera
            </Link>
          </div>

          {/* Desktop CTA */}
          <button 
            onClick={() => setIsChoiceOpen(true)}
            className="hidden md:block px-5 py-2 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white text-sm font-medium hover:scale-105 transition-transform"
          >
            Apply Now
          </button>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle variant="compact" />
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex flex-col gap-1.5 p-2"
            >
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </button>
          </div>
        </div>

        {/* Desktop theme toggle — pinned to the header's right corner */}
        <div className="hidden md:flex absolute right-5 top-8 -translate-y-1/2">
          <ThemeToggle variant="compact" />
        </div>

        {/* Mobile Menu — now mirrors the desktop menu exactly */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-pure/95 border-t border-fg/10 px-5 py-6 space-y-4">
            <Link 
              to="/about" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-fg/90 py-2"
            >
              About Us
            </Link>
            <Link
              to="/meet-sera"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-fg/90 py-2"
            >
              Meet Ai Sera
            </Link>
            <div className="flex items-center justify-between py-2">
              <span className="text-fg/90">Theme</span>
              <ThemeToggle variant="inline" />
            </div>
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false)
                setIsChoiceOpen(true)
              }}
              className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white text-sm font-medium"
            >
              Apply Here
            </button>
          </div>
        )}
      </nav>

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
