function AIAdvantage() {
  return (
    <section className="py-24 bg-yzi-dark relative overflow-hidden">
      {/* soft background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-yzi-purple/10 rounded-full blur-[100px]"></div>

      <div className="relative max-w-6xl mx-auto px-6">
        
        {/* Title */}
        <div className="text-center mb-16">
          <p className="text-yzi-cyan text-sm tracking-widest uppercase mb-3">The Real Power</p>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Powered by AI 
          </h2>
          <p className="text-yzi-muted text-lg max-w-2xl mx-auto">
            YZI Works is not just a community. It is an intelligent system that organizes, matches, tracks and records everything — so both individuals and organizations can work with complete clarity.
          </p>
        </div>

        {/* Cards + Light Beam Container */}
        <div className="relative">
          
          {/* The moving light beam */}
          <div className="absolute top-0 left-0 h-full w-32 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl animate-beam pointer-events-none z-10"></div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-0">

            {/* Card 1 */}
            <div className="card-flow card-1 bg-yzi-card border border-white/10 rounded-2xl p-7">
              <div className="w-11 h-11 rounded-xl bg-yzi-cyan/10 flex items-center justify-center mb-5">
                <span className="text-yzi-cyan text-xl font-medium">01</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Matching</h3>
              <p className="text-yzi-muted text-sm leading-relaxed">
                AI matches the right talent with the right opportunity based on skills, availability and performance history.
              </p>
            </div>

            {/* Card 2 */}
            <div className="card-flow card-2 bg-yzi-card border border-white/10 rounded-2xl p-7">
              <div className="w-11 h-11 rounded-xl bg-yzi-pink/10 flex items-center justify-center mb-5">
                <span className="text-yzi-pink text-xl font-medium">02</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Work & Payment Tracking</h3>
              <p className="text-yzi-muted text-sm leading-relaxed">
                Every task, milestone and payment is tracked automatically. No confusion. Full transparency for both sides.
              </p>
            </div>

            {/* Card 3 */}
            <div className="card-flow card-3 bg-yzi-card border border-white/10 rounded-2xl p-7">
              <div className="w-11 h-11 rounded-xl bg-yzi-orange/10 flex items-center justify-center mb-5">
                <span className="text-yzi-orange text-xl font-medium">03</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Complete Record Keeping</h3>
              <p className="text-yzi-muted text-sm leading-relaxed">
                Your entire work history, ratings, completed projects and earnings stay organized in one intelligent dashboard.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes beamMove {
          0% {
            left: -10%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 110%;
            opacity: 0;
          }
        }

        .animate-beam {
          animation: beamMove 4.5s ease-in-out infinite;
        }

        /* Sequential card highlight when beam passes */
        @keyframes cardHighlight {
          0%, 100% {
            border-color: rgba(255, 255, 255, 0.1);
            box-shadow: none;
          }
          40%, 60% {
            border-color: rgba(255, 255, 255, 0.35);
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.08);
          }
        }

        .card-1 {
          animation: cardHighlight 4.5s ease-in-out infinite;
        }
        .card-2 {
          animation: cardHighlight 4.5s ease-in-out infinite 1.5s;
        }
        .card-3 {
          animation: cardHighlight 4.5s ease-in-out infinite 3s;
        }
      `}</style>
    </section>
  )
}

export default AIAdvantage