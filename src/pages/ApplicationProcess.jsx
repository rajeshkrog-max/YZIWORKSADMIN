import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import ApplyTop from '../assets/Applytop.png'
import ApplyBottom from '../assets/Applybottom.png'

function ApplicationProcess() {
  const stages = [
    { number: '01', title: 'Program Fit Check', time: '2-3 Days' },
    { number: '02', title: 'Internal Review', time: '7 Days' },
    { number: '03', title: 'Result Announcement', time: '14 Days' }
  ]

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      <div className="w-full">
        <img 
          src={ApplyTop} 
          alt="Applications Open" 
          className="w-full h-auto object-cover"
        />
      </div>

      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Application <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">Process</span>
          </h2>
          <p className="text-white/60 text-lg">
            Simple steps. Transparent process. Built for trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {stages.map((stage, index) => (
            <div 
              key={index}
              className="relative bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-orange-500/50 transition-all duration-300"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
                {stage.number}
              </div>
              <h3 className="text-xl font-semibold mb-2">{stage.title}</h3>
              <p className="text-orange-400 font-medium">{stage.time}</p>

              {index < stages.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-orange-500 to-pink-500"></div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-white/50 mt-12 text-sm">
          Timeline starts from the date of your application.
        </p>
      </section>

      <div className="w-full">
        <img 
          src={ApplyBottom} 
          alt="Application Process Details" 
          className="w-full h-auto object-cover"
        />
      </div>

      {/* Footer */}
      <Footer />

      <div className="fixed top-6 left-6 z-50">
        <Link 
          to="/"
          className="px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm hover:bg-white/20 transition"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}

export default ApplicationProcess
