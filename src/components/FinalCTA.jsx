import { useState } from 'react'
import ChoiceModal from './ChoiceModal'
import EarlyBuildersForm from './EarlyBuildersForm'
import EarlyPartnersForm from './EarlyPartnersForm'

function FinalCTA() {
  const [isChoiceOpen, setIsChoiceOpen] = useState(false)
  const [isBuildersOpen, setIsBuildersOpen] = useState(false)
  const [isPartnersOpen, setIsPartnersOpen] = useState(false)

  return (
    <>
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-6 text-center">

          <p className="text-yzi-cyan text-sm tracking-widest uppercase mb-4">
            Early Access Is Now Open
          </p>

          <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Applications
            <br />
            <span className="bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple bg-clip-text text-transparent">
              Are Now Open
            </span>
          </h2>

          <p className="text-yzi-muted text-lg md:text-xl max-w-2xl mx-auto mb-10">
            YZI Works is now accepting applications from Early Builders and
            Early Partners. Join the network and get started with the next
            generation of work opportunities.
          </p>

          <div className="flex justify-center">
            <button
              onClick={() => setIsChoiceOpen(true)}
              className="px-10 py-4 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white font-semibold text-lg hover:scale-105 transition-transform duration-300"
            >
              Apply Now
            </button>
          </div>

          <p className="mt-8 text-sm text-yzi-muted">
            Every application is reviewed by the YZI Community team.
          </p>

        </div>
      </section>

      {/* Choice Modal */}
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

      {/* Forms */}
      <EarlyBuildersForm
        isOpen={isBuildersOpen}
        onClose={() => setIsBuildersOpen(false)}
      />

      <EarlyPartnersForm
        isOpen={isPartnersOpen}
        onClose={() => setIsPartnersOpen(false)}
      />
    </>
  )
}

export default FinalCTA