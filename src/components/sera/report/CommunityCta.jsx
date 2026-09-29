import { useState } from 'react'
import EarlyBuildersForm from '../../EarlyBuildersForm'
import { PANEL } from './reportStyles'

// Opens the existing Early Builder application popup (same as the Navbar).
// The popup renders outside the glass panel: a backdrop-filter parent would
// trap its fixed overlay inside the panel.
function CommunityCta() {
  const [open, setOpen] = useState(false)
  return (
    <>
    <section className={`${PANEL} flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8`}>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-fg">Want help getting there?</h2>
        <p className="mt-1.5 text-sm text-fg/65 leading-relaxed">
          The YZI community connects you with real work and people who can help you build these skills.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 h-12 px-6 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:brightness-110 transition"
      >
        Join the YZI community
      </button>
    </section>
    <EarlyBuildersForm isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default CommunityCta
