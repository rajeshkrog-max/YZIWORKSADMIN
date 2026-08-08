import { useState } from 'react'
import logo from '../assets/logo.png'

function Footer() {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (!message.trim()) {
      setError('Please write your query')
      return
    }

    setError('')

    try {
      const response = await fetch('/.netlify/functions/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message })
      })

      const data = await response.json()

      if (data.success) {
        setIsSubmitted(true)
      } else {
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setEmail('')
    setMessage('')
    setError('')
    setIsSubmitted(false)
  }

  return (
    <>
      <footer className="py-14 border-t border-white/5 bg-yzi-black">
        <div className="max-w-6xl mx-auto px-6">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            
            {/* Left Side */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <img 
                src={logo} 
                alt="YZI Works" 
                className="h-35 w-auto object-contain"
              />
              <p className="text-sm text-yzi-muted">
                © 2026 Young Zone India. All rights reserved.
              </p>
            </div>

            {/* Right Side */}
            <div className="flex flex-col items-center md:items-end gap-5">
              
              <button 
                onClick={() => setIsOpen(true)}
                className="px-6 py-2.5 rounded-full border border-white/20 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Contact Us
              </button>

              {/* Social Icons */}
              <div className="flex items-center gap-4">
                <a href="https://www.facebook.com/youngzoneindia" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-yzi-orange/20 flex items-center justify-center transition-all hover:scale-110">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                  </svg>
                </a>

                <a href="https://www.instagram.com/youngzoneindia" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-yzi-pink/20 flex items-center justify-center transition-all hover:scale-110">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                </a>

                <a href="https://wa.me/c/919011256256" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-green-500/20 flex items-center justify-center transition-all hover:scale-110">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>

                <a href="https://in.linkedin.com/company/youngzoneindia" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-blue-500/20 flex items-center justify-center transition-all hover:scale-110">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-yzi-card border border-white/10 rounded-3xl p-8 shadow-2xl">
            
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              ✕
            </button>

            {!isSubmitted ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Contact Us</h2>
                <p className="text-yzi-muted text-sm mb-6">
                  Send us your query and our team will get back to you.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-sm text-yzi-muted mb-1 block">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-yzi-muted mb-1 block">
                      Your Query <span className="text-xs text-yzi-muted">(max 300 characters)</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                      rows="4"
                      maxLength="300"
                      placeholder="Write your message here..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange resize-none"
                    />
                    <p className="text-xs text-yzi-muted mt-1 text-right">{message.length}/300</p>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold hover:scale-[1.02] transition-transform"
                  >
                    Submit
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">
                  ✓
                </div>
                <h3 className="text-xl font-bold mb-2">Thank You!</h3>
                <p className="text-yzi-muted mb-6">
                  Our team will get back to you soon.
                </p>
                <button
                  onClick={handleClose}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Footer