import { useState } from 'react'
import EarlyBuildersForm from './EarlyBuildersForm'
import EarlyPartnersForm from './EarlyPartnersForm'

function Hero() {
  const [isBuildersOpen, setIsBuildersOpen] = useState(false)
  const [isPartnersOpen, setIsPartnersOpen] = useState(false)

  return (
    <>
      <section className="relative py-24 md:py-32 bg-yzi-black overflow-hidden">
        
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-yzi-orange/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-yzi-purple/15 rounded-full blur-[100px]"></div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          
          <p className="text-sm text-yzi-cyan tracking-widest uppercase mb-5 font-medium">
            This Independence Week
          </p>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            CHOOSE<br />
            <span className="bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple bg-clip-text text-transparent">
              WORK INDEPENDENCE.
            </span>
          </h1>

          <p className="text-base md:text-lg text-yzi-muted max-w-xl mx-auto mb-10 leading-relaxed">
            The future of work won’t be built by one company.<br />
            It will be built by a community.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setIsBuildersOpen(true)}
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white font-semibold hover:scale-105 transition-transform duration-300"
            >
              Join Early Builders
            </button>
            
            <button 
              onClick={() => setIsPartnersOpen(true)}
              className="px-8 py-3.5 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors duration-300"
            >
              Become Early Partner
            </button>
          </div>
        </div>
      </section>

      {/* Early Builders Form */}
      <EarlyBuildersForm 
        isOpen={isBuildersOpen} 
        onClose={() => setIsBuildersOpen(false)} 
      />

      {/* Early Partners Form */}
      <EarlyPartnersForm 
        isOpen={isPartnersOpen} 
        onClose={() => setIsPartnersOpen(false)} 
      />
    </>
  )
}

export default Hero