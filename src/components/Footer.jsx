import { useState } from 'react'
import logo from '../assets/logo.png'

// Clean, minimal brand-mark SVGs — crisper and more "real" than emoji/text links
const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94Z" />
  </svg>
)
const InstagramIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
)
const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.85.5 3.58 1.36 5.07L2 22l5.19-1.44a9.87 9.87 0 0 0 4.85 1.27h.01c5.46 0 9.91-4.45 9.91-9.92S17.5 2 12.04 2Zm0 18.13c-1.53 0-3-.4-4.28-1.16l-.31-.18-3.08.86.82-3-.2-.32a8.06 8.06 0 0 1-1.24-4.32c0-4.47 3.64-8.11 8.29-8.11 2.21 0 4.29.87 5.86 2.44a8.22 8.22 0 0 1 2.43 5.83c0 4.47-3.64 8-8.29 8Zm4.54-6.06c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.1-.5.11-.11.25-.29.37-.43a1.6 1.6 0 0 0 .25-.4.45.45 0 0 0-.02-.44c-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
  </svg>
)
const LinkedInIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6.94 5.01a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 8.98h3.9V21H3V8.98Zm7.02 0H13.8v1.64h.05c.53-.99 1.82-2.03 3.75-2.03 4.01 0 4.75 2.56 4.75 5.89V21h-3.9v-5.94c0-1.42-.03-3.24-2.02-3.24-2.02 0-2.33 1.53-2.33 3.13V21h-3.9V8.98Z" />
  </svg>
)

const socials = [
  { icon: FacebookIcon, label: 'Facebook', href: 'https://www.facebook.com/youngzoneindia' },
  { icon: InstagramIcon, label: 'Instagram', href: 'https://www.instagram.com/youngzoneindia' },
  { icon: WhatsAppIcon, label: 'WhatsApp', href: 'https://wa.me/c/919011256256' },
  { icon: LinkedInIcon, label: 'LinkedIn', href: 'https://in.linkedin.com/company/youngzoneindia' },
]

function Footer() {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.subject || !form.message) {
      setStatusMessage('Please fill all fields')
      return
    }

    setSending(true)
    setStatusMessage('')

    try {
      const response = await fetch('/.netlify/functions/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await response.json()

      if (data.success) {
        setStatusMessage('Message sent successfully')
        setForm({ name: '', subject: '', message: '' })
        setTimeout(() => {
          setIsContactOpen(false)
          setStatusMessage('')
        }, 2500)
      } else {
        setStatusMessage(data.error || 'Failed to send message')
      }
    } catch (err) {
      setStatusMessage('Something went wrong. Please try again.')
    }

    setSending(false)
  }

  return (
    <footer className="relative bg-[#05050A] pt-20 pb-10 overflow-hidden">
      {/* Signature gradient hairline across the very top of the footer */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
      {/* Faint ambient glow, echoes the accent used elsewhere on the site */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 blur-3xl rounded-full" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Contact Modal */}
        {isContactOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-4xl bg-[#0B0B14] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <button
                onClick={() => setIsContactOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
              >
                ✕
              </button>

              {sent ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                  <h3 className="text-2xl font-bold mb-2">Message Sent</h3>
                  <p className="text-white/60">Thank you. Our team will get back to you soon.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-8 md:p-10">
                    <h3 className="text-2xl font-bold mb-1">Contact Us</h3>
                    <p className="text-white/50 text-sm mb-8">We usually reply within 24 hours.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Name</label>
                        <input
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Subject</label>
                        <input
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Message</label>
                        <textarea
                          name="message"
                          value={form.message}
                          onChange={handleChange}
                          rows="5"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sending}
                        className="w-full py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 font-semibold hover:scale-[1.02] transition disabled:opacity-50"
                      >
                        {sending ? 'Sending...' : 'Send Message'}
                      </button>

                      {statusMessage && (
                        <p className={`text-sm text-center mt-3 ${
                          statusMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {statusMessage}
                        </p>
                      )}
                    </form>
                  </div>

                  <div className="hidden md:flex relative bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-purple-500/20 items-center justify-center p-10">
                    <div className="text-center">
                      <h3 className="text-3xl font-bold mb-4 leading-tight">
                        We’re here<br />to help
                      </h3>
                      <p className="text-white/60 text-sm max-w-xs mx-auto">
                        Have a question, partnership idea, or feedback? Reach out and our team will respond soon.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Top: brand + socials */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-12 pb-12">
          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <img src={logo} alt="YZI Works" className="h-32 md:h-32 w-auto object-contain py-2" />
            <p className="text-white/50 text-sm max-w-xs leading-relaxed">
              An intelligent system that organizes, matches, and builds — for India's next generation of founders.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-5">
            <button 
              onClick={() => setIsContactOpen(true)}
              className="px-6 py-2.5 rounded-full border border-white/20 text-sm text-white font-medium
                         hover:border-transparent hover:bg-gradient-to-r hover:from-orange-500 hover:via-pink-500 hover:to-purple-500
                         transition-all duration-300"
            >
              Contact Us
            </button>

            <div className="flex items-center gap-3">
              {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="group w-10 h-10 rounded-full border border-white/10 bg-white/[0.03]
                             flex items-center justify-center
                             hover:border-transparent hover:bg-gradient-to-br hover:from-orange-500 hover:via-pink-500 hover:to-purple-500
                             transition-all duration-300"
                >
                  <Icon className="w-4.5 h-4.5 text-white/60 group-hover:text-white transition-colors duration-300" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/10" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-center sm:text-left">
          <p className="text-white/40 text-sm">
            © 2026 Young Zone India. All rights reserved.
          </p>

          <div className="flex items-center gap-2 text-white/50 text-sm">
            <span>Made with</span>
            <span className="text-red-500">❤</span>
            <span>in India</span>
            <span className="text-white/20">•</span>
            <span>
              Backed by{' '}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-white/15 text-white/80 font-semibold text-xs tracking-wide ml-1">
                ANTLER
              </span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
