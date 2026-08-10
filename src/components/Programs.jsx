import { useState } from 'react'
import EarlyBuildersForm from './EarlyBuildersForm'
import EarlyPartnersForm from './EarlyPartnersForm'

function Programs() {
  const [isBuildersOpen, setIsBuildersOpen] = useState(false)
  const [isPartnersOpen, setIsPartnersOpen] = useState(false)

  return (
    <section className="py-24 bg-yzi-black relative">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Two Ways to Join the Movement
          </h2>
          <p className="text-yzi-muted text-lg max-w-2xl mx-auto">
            Whether you are building your career or building a better workplace — there is a place for you.
          </p>
        </div>

        {/* Two Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Early Builders Card */}
          <div className="bg-yzi-card border border-white/10 rounded-3xl p-8 hover:border-yzi-orange/50 transition-all duration-300">
            <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-sm font-medium mb-6">
              For Individuals
            </div>

            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              Early Builders Program
            </h3>

            <p className="text-yzi-muted mb-8 leading-relaxed">
              For the next generation of doers, creators and change makers who want to build their work identity and future.
            </p>

            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-orange"></span>
                Students
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-orange"></span>
                Freelancers & Creators
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-orange"></span>
                Gig & Part-time Workers
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-orange"></span>
                Young Professionals
              </li>
            </ul>

            <button
              onClick={() => setIsBuildersOpen(true)}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold hover:scale-[1.02] transition-transform"
            >
              Build your work identity
            </button>
          </div>

          {/* Early Partners Card */}
          <div className="bg-yzi-card border border-white/10 rounded-3xl p-8 hover:border-yzi-purple/50 transition-all duration-300">
            <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue text-sm font-medium mb-6">
              For Organizations
            </div>

            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              Early Partners Program
            </h3>

            <p className="text-yzi-muted mb-8 leading-relaxed">
              For businesses and service providers who want to build better workplaces and access verified talent.
            </p>

            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-purple"></span>
                Businesses & Startups
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-purple"></span>
                MSMEs
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-purple"></span>
                Service Providers
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yzi-purple"></span>
                Vendors
              </li>
            </ul>

            <button
              onClick={() => setIsPartnersOpen(true)}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold hover:scale-[1.02] transition-transform"
            >
              Collaborate. Innovate. Build together.
            </button>
          </div>

        </div>
      </div>

      <EarlyBuildersForm
        isOpen={isBuildersOpen}
        onClose={() => setIsBuildersOpen(false)}
      />

      <EarlyPartnersForm
        isOpen={isPartnersOpen}
        onClose={() => setIsPartnersOpen(false)}
      />
    </section>
  )
}

export default Programs