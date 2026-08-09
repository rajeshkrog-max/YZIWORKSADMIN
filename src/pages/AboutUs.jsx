import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import aboutHero from '../assets/about us/aboutushero.png'
import onceImage from '../assets/about us/once.png'
import image1 from '../assets/about us/image1.png'
import image2 from '../assets/about us/image2.png'
import image3 from '../assets/about us/image3.png'
import image4 from '../assets/about us/image4.png'
import image5 from '../assets/about us/image5.png'
import image6 from '../assets/about us/image6.png'

const assets = {
  storyImage: onceImage,
  gallery: [image1, image2, image3, image4, image5, image6]
}

const testimonials = [
  {
    quote: "A nice place with interesting people, where each contributes their own creative skill. Irrational prejudices and vested agendas are an all-time low here compared to other places.",
    name: 'Snehal Deshpande',
    role: 'MD, Akrel Media',
  },
  {
    quote: "This is really an awesome platform for new talent to showcase their work. Kudos to the entire development team and founders for coming up with such a great idea.",
    name: 'Vishal Jainani',
    role: 'Artist, Bollywood',
  },
  {
    quote: "I've had the fortune of working with YZI and it was a one-of-a-kind experience. I was genuinely amazed at the composure and coordination the team had — so much freshness and enthusiasm.",
    name: 'Anil Anand Nagesh',
    role: 'Stand-up Comedian',
  },
  {
    quote: "As a stand-up comic, I collaborated with the team on multiple shows and open mics, which they executed professionally from start to finish.",
    name: 'Ajison Nair',
    role: 'Filmmaker, Comedian',
  },
  {
    quote: "Young Zone India is a trusted name where ideas turn into reality — artist management, events, entertainment, and more, all handled with real care.",
    name: 'Surbhi Pandey',
    role: 'Artist, Bollywood',
  },
]

function AboutUs() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % assets.gallery.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      {/* ========== HERO ========== */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <img
          src={aboutHero}
          alt="Young Zone India Community"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#05050A]" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <p className="text-orange-400 text-sm md:text-base font-semibold tracking-[0.3em] uppercase mb-6">
            Since 2017
          </p>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-none mb-8">
            Young Zone India
          </h1>

          <p className="text-white/80 text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed mb-4">
            Empowering the youth of India through creativity, culture, education & opportunity
          </p>

          <p className="text-white/50 text-sm md:text-base max-w-2xl mx-auto">
            A Startup India certified social impact company building platforms and experiences for the next generation.
          </p>
        </div>
      </section>

      {/* ========== ORIGIN STORY ========== */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 blur-2xl rounded-3xl" />
              <img
                src="/src/assets/about us/once.png"
                alt="Once Upon A Time"
                className="relative rounded-2xl w-full h-[480px] object-cover border border-white/10"
              />
            </div>

            <div>
              <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
                Our Origin
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Built by the people it serves
              </h2>
              <div className="space-y-5 text-white/60 leading-relaxed">
                <p>
                  Young Zone India began in 2017 as a small, informal gathering — a handful of creative minds meeting on weekends, without funding, infrastructure, or a playbook. What they had was a shared observation: talented young people across India were being held back not by ability, but by access — to mentorship, resources, and rooms where opportunity actually got decided.
                </p>
                <p>
                  That group grew into a production house, then an events and media organization, and eventually into a certified social impact startup recognized under India's DPIIT Startup India initiative. Today, Young Zone India operates across content, events, entertainment, and production — each one built to remove a different barrier standing between young talent and the opportunity it deserves.
                </p>
                <p>
                  <span className="text-white font-medium">YZI Works is the newest expression of that mission</span> — purpose-built for founders and builders, structured with the same discipline that has carried Young Zone India from a WhatsApp group to a multi-vertical organization trusted by national and global partners.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">What Drives Us</p>
            <h2 className="text-3xl md:text-4xl font-bold">Vision, Mission & Values</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Our Vision',
                body: 'A one-stop hub of empowerment, education, collaborations and holistic support for the youth of India.'
              },
              {
                title: 'Our Mission',
                body: "Boosting India's human capital through creative, cultural, educational and entertaining activities — starting from the grassroots."
              },
              {
                title: 'Our Values',
                body: 'Get, Grow & Give. We help youth get what they need, grow into their potential, and give back to the community.'
              }
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 hover:border-orange-500/40 transition-all duration-300"
              >
                <h3 className="text-xl font-bold text-orange-400 mb-4">{item.title}</h3>
                <p className="text-white/60 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">On The Ground</p>
            <h2 className="text-3xl md:text-4xl font-bold">Real youth. Real programs. Real impact.</h2>
          </div>

          <div className="relative rounded-3xl overflow-hidden border border-white/10 h-[420px] md:h-[520px]">
            {assets.gallery.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Gallery ${i + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                  i === current ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {assets.gallery.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === current ? 'bg-orange-500 w-6' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">What People Say</p>
            <h2 className="text-3xl md:text-4xl font-bold">Trusted by the people we've worked with</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 flex flex-col hover:border-orange-500/30 transition-all duration-300"
              >
                <span className="text-orange-400 text-4xl leading-none mb-4">"</span>
                <p className="text-white/70 text-sm leading-relaxed flex-1 mb-8">{t.quote}</p>
                <div>
                  <p className="text-white font-semibold">{t.name}</p>
                  <p className="text-orange-400/80 text-xs mt-1">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 text-center border-t border-white/5">
        <h2 className="text-3xl md:text-5xl font-bold mb-6">
          Now you know who we are.
        </h2>
        <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
          Here's how to become part of the movement.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="px-8 py-3.5 rounded-full font-semibold text-white bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:opacity-90 transition"
          >
            Join as Early Builder
          </Link>
          <Link
            to="/application-process"
            className="px-8 py-3.5 rounded-full font-semibold text-white border border-white/20 hover:bg-white/10 transition"
          >
            Application Process
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default AboutUs
