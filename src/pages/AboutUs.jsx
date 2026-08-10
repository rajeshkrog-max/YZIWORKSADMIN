import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import aboutHero from '../assets/aboutus/aboutushero.png'
import onceImage from '../assets/aboutus/once.png'
import image1 from '../assets/aboutus/image1.png'
import image2 from '../assets/aboutus/image2.png'
import image3 from '../assets/aboutus/image3.png'
import image4 from '../assets/aboutus/image4.png'
import image5 from '../assets/aboutus/image5.png'
import image6 from '../assets/aboutus/image6.png'

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

          {/* Opening story */}
          <div className="grid lg:grid-cols-2 gap-16 items-start mb-24">
            <div className="relative lg:sticky lg:top-24">
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 blur-2xl rounded-3xl" />

              <img
                src={onceImage}
                alt="Once Upon A Time"
                className="relative rounded-2xl w-full h-auto max-h-[620px] object-cover border border-white/10"
              />
            </div>

            <div>
              <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
                Our Origin
              </p>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 leading-tight">
                It started with a simple belief
              </h2>

              <div className="space-y-6 text-white/60 leading-relaxed text-base md:text-lg">
                <p>
                  It started with a simple belief: Young people deserve more
                  opportunities.
                </p>

                <p>
                  In 2017, Young Zone India (YZI) began with a vision to create a
                  space where young people could discover opportunities, express
                  themselves, build communities and create something of their own.
                </p>

                <p>
                  What started as a youth-focused initiative gradually evolved
                  through years of experimentation, community building and learning.
                </p>

                <p>
                  We explored different ways to serve the next generation — from
                  creative communities and events to media, entertainment, learning,
                  careers and entrepreneurship.
                </p>

                <p>
                  Every chapter taught us something new.
                </p>

                <p>
                  And every chapter brought us closer to one larger question:
                </p>

                <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">
                  What would it take to build an ecosystem where young people can
                  actually shape their own future?
                </p>
              </div>
            </div>
          </div>

          {/* From an idea to an ecosystem */}
          <div className="max-w-4xl mx-auto mb-24">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              From an idea to an ecosystem
            </p>

            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              From an idea to an ecosystem
            </h2>

            <div className="space-y-6 text-white/60 leading-relaxed text-base md:text-lg">
              <p>
                Over the years, YZI evolved through multiple initiatives and
                experiments.
              </p>

              <p>
                We built communities around arts and creativity, explored events and
                entertainment through YZI Events and YZI Entertainment, created
                conversations through YZI Connects, and explored learning and
                career-focused initiatives through YZI SkillZone.
              </p>

              <p>
                Some ideas evolved.
              </p>

              <p>
                Some changed direction.
              </p>

              <p>
                Some were paused.
              </p>

              <p>
                But the underlying mission remained the same:
              </p>

              <p className="text-white text-xl md:text-2xl font-medium">
                Create access to opportunities and help the next generation become
                more independent.
              </p>

              <p>
                YZI Productions Private Limited was incorporated in 2019, formalising
                the organisation behind the growing ecosystem. In 2021, YZI also
                received DPIIT recognition as a startup.
              </p>

              <p>
                Since then, we've continued experimenting, building partnerships,
                listening to young people and understanding where the biggest gaps
                actually exist.
              </p>
            </div>
          </div>

          {/* And then we looked at work */}
          <div className="max-w-4xl mx-auto mb-24">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              The next question
            </p>

            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              And then we looked at work.
            </h2>

            <div className="space-y-6 text-white/60 leading-relaxed text-base md:text-lg">
              <p>
                We realised that one of the biggest transitions in a young person's
                life is the transition from education to work.
              </p>

              <p>
                Yet the traditional system often presents a very narrow path:
              </p>

              <div className="my-8 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center">
                <p className="text-white font-semibold text-lg md:text-xl">
                  Study → Graduate → Find a job → Work 9–5 → Repeat.
                </p>
              </div>

              <p>
                But the next generation is growing up differently.
              </p>

              <ul className="space-y-4 pl-5 list-disc marker:text-orange-400">
                <li>Students want experience before graduation.</li>
                <li>Creators want to build careers around their craft.</li>
                <li>Freelancers want better opportunities and professional relationships.</li>
                <li>Young professionals want flexibility and ownership.</li>
                <li>Businesses need people for projects, assignments and changing requirements.</li>
              </ul>

              <p>
                The way people work, earn and build their professional lives is
                changing.
              </p>

              <p className="text-white text-xl md:text-2xl font-medium">
                YZI decided to build for that change.
              </p>
            </div>
          </div>

          {/* Introducing YZI Works */}
          <div className="mb-24 rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] via-pink-500/[0.04] to-transparent p-8 md:p-12">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              Introducing YZI Works
            </p>

            <h2 className="text-3xl md:text-5xl font-bold mb-8">
              YZI Works is the next evolution of that journey.
            </h2>

            <div className="space-y-6 text-white/70 leading-relaxed text-base md:text-lg">
              <p>
                It is our attempt to build a better way for people and businesses to
                discover, connect and collaborate around work.
              </p>

              <div className="grid md:grid-cols-2 gap-6 my-10">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <h3 className="text-white font-bold text-lg mb-4">
                    For individuals
                  </h3>

                  <p className="text-white/60 leading-relaxed">
                    Discover work → Gain experience → Build your professional
                    identity → Grow on your terms.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <h3 className="text-white font-bold text-lg mb-4">
                    For businesses and service providers
                  </h3>

                  <p className="text-white/60 leading-relaxed">
                    Find people → Collaborate → Get work done → Build long-term
                    relationships.
                  </p>
                </div>
              </div>

              <p className="text-white text-xl md:text-2xl font-semibold">
                But we're not trying to build another job portal.
              </p>

              <p>
                We're exploring a future where work can be more flexible, accessible
                and human.
              </p>
            </div>
          </div>

          {/* We're still building */}
          <div className="max-w-4xl mx-auto mb-24">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              We're still building
            </p>

            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Built with the community.
            </h2>

            <div className="space-y-6 text-white/60 leading-relaxed text-base md:text-lg">
              <p>
                YZI Works is being developed with our community — not simply for it.
              </p>

              <p>
                Our Early Builders and Early Partners are helping us understand what
                actually works in the real world.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-8">
                {[
                  'Students',
                  'Creators',
                  'Freelancers',
                  'Young professionals',
                  'Startups',
                  'MSMEs',
                  'Businesses',
                  'Service providers',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-white/70"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <p>
                Their experiences, feedback and participation will shape what YZI
                Works becomes.
              </p>

              <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">
                Because we don't believe the future of work should be decided by a
                few companies and handed to everyone else.
              </p>

              <p className="text-white text-2xl md:text-3xl font-bold">
                It should be built together.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="max-w-4xl mx-auto mb-24">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              From Young Zone India to YZI Works
            </p>

            <h2 className="text-3xl md:text-4xl font-bold mb-10">
              From Young Zone India to YZI Works
            </h2>

            <div className="relative border-l border-white/10 ml-3 pl-8 space-y-10">
              {[
                {
                  year: '2017',
                  text: 'Young Zone India begins with a youth-focused vision.',
                },
                {
                  year: '2019',
                  text: 'YZI Productions Private Limited is incorporated.',
                },
                {
                  year: '2021',
                  text: 'YZI receives DPIIT startup recognition.',
                },
                {
                  year: '2017–2025',
                  text: 'Communities, creative initiatives, events, media, learning and career-focused initiatives evolve through experimentation and partnerships.',
                },
                {
                  year: '2026',
                  text: 'YZI begins its next chapter with YZI Works, focused on building a more flexible and opportunity-driven way of working.',
                },
              ].map((item) => (
                <div key={item.year} className="relative">
                  <span className="absolute -left-[41px] top-1.5 w-3 h-3 rounded-full bg-orange-500 ring-4 ring-[#05050A]" />

                  <p className="text-orange-400 font-bold text-lg mb-2">
                    {item.year}
                  </p>

                  <p className="text-white/60 leading-relaxed text-base md:text-lg">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Our belief */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-12">
            <p className="text-orange-400 text-sm font-semibold tracking-widest uppercase mb-4">
              Our belief
            </p>

            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Choose Work Independence.
            </h2>

            <div className="space-y-6 text-white/60 leading-relaxed text-base md:text-lg">
              <p>
                We believe the next generation shouldn't have to wait until they're
                trapped in a career they don't enjoy to start looking for
                independence.
              </p>

              <p>
                They should be able to explore earlier, experience more, build their
                identity and choose how they want to work.
              </p>

              <p>
                And businesses shouldn't have to wait for the workforce to change
                around them.
              </p>

              <p>
                They can help build that change.
              </p>

              <div className="pt-6 border-t border-white/10">
                <p className="text-white font-semibold text-xl md:text-2xl mb-4">
                  This is YZI.
                </p>

                <p className="text-white/60">
                  Started with youth.
                  <br />
                  Built through experimentation.
                  <br />
                  Driven by opportunity.
                  <br />
                  And now building toward a more independent future of work.
                </p>
              </div>

              <div className="pt-6">
                <p className="text-white text-2xl md:text-3xl font-bold">
                  Choose Work Independence.
                </p>

                <p className="text-orange-400 font-semibold mt-3">
                  YZI Works
                </p>

                <p className="text-white/50 text-sm mt-1">
                  An initiative by Young Zone India (YZI)
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
