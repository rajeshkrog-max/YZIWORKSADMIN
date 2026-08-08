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
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-yzi-black"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-r from-yzi-orange/20 via-yzi-pink/20 to-yzi-purple/20 rounded-full blur-[120px]"></div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          
          <p className="text-yzi-cyan text-sm tracking-widest uppercase mb-4">
            Limited Cohort
          </p>

          <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Applications<br />
            <span className="bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple bg-clip-text text-transparent">
              Opening Soon
            </span>
          </h2>

          <p className="text-yzi-muted text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Be among the first to shape the future of work.  
            Early Builders and Early Partners will get priority access.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setIsChoiceOpen(true)}
              className="px-10 py-4 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white font-semibold text-lg hover:scale-105 transition-transform duration-300"
            >
              Notify Me When It Opens
            </button>
            <button className="px-10 py-4 rounded-full border border-white/20 text-white font-semibold text-lg hover:bg-white/10 transition-colors">
              Learn More
            </button>
          </div>

          <p className="mt-8 text-sm text-yzi-muted">
            Every application will be reviewed by the YZI Community team.
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