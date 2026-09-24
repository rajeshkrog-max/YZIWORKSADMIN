import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSeraInterview } from '../hooks/useSeraInterview'
import HeroSlider from '../components/HeroSlider'
import Footer from '../components/Footer'
import SeraNetworkBackground from '../components/sera/SeraNetworkBackground'
import SeraHero from '../components/sera/SeraHero'
import SeraSteps from '../components/sera/SeraSteps'
import SeraSignIn from '../components/sera/SeraSignIn'
import SeraUpload from '../components/sera/SeraUpload'
import SeraPreparing from '../components/sera/SeraPreparing'
import SeraInterview from '../components/sera/SeraInterview'
import SeraWrapup from '../components/sera/SeraWrapup'
import SeraReport from '../components/sera/SeraReport'
import SeraBlockedScreen from '../components/sera/SeraBlockedScreen'
import FloatingThemeToggle from '../theme/FloatingThemeToggle'
import seraSlide1Dark from '../assets/sera_hero/slide1dark.png'
import seraSlide2Dark from '../assets/sera_hero/slide2dark.png'
import seraSlide3Dark from '../assets/sera_hero/slide3dark.png'
import seraSlide4Dark from '../assets/sera_hero/slide4dark.png'
import seraSlide1Light from '../assets/sera_hero/slide1light.png'
import seraSlide2Light from '../assets/sera_hero/slide2light.png'
import seraSlide3Light from '../assets/sera_hero/slide3light.png'
import seraSlide4Light from '../assets/sera_hero/slide4light.png'

// Same index = same slide; the theme picks the set. Always 4.
const SERA_DARK_SLIDES = [seraSlide1Dark, seraSlide2Dark, seraSlide3Dark, seraSlide4Dark]
const SERA_LIGHT_SLIDES = [seraSlide1Light, seraSlide2Light, seraSlide3Light, seraSlide4Light]

function MeetSera() {
  const sera = useSeraInterview()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [sera.screen])

  useEffect(() => {
    const titles = {
      hero: 'Meet AI Sera | YZI Works',
      signin: 'Sign In - AI Sera | YZI Works',
      upload: 'Upload Resume - AI Sera | YZI Works',
      preparing: 'Preparing Session - AI Sera | YZI Works',
      interview: 'Live Interview - AI Sera | YZI Works',
      wrapup: 'Wrapping Up - AI Sera | YZI Works',
      report: 'Assessment Report - AI Sera | YZI Works',
      blocked: 'Access Restricted - AI Sera | YZI Works'
    }
    document.title = titles[sera.screen] || 'Meet AI Sera | YZI Works'
  }, [sera.screen])

  const topControls = (
    <>
      {/* AnnouncementBar (src/components/AnnouncementBar.jsx) is a global
          fixed bar at z-[200], up to ~48.8px tall on desktop / ~44.8px on
          mobile (measured, not assumed). top-16 (64px) clears it on both
          with margin — top-6 (24px) used to sit entirely inside that band,
          so the marquee's far higher z-index just won the overlap outright. */}
      <div className="fixed top-16 left-6 z-50">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-full bg-fg/15 backdrop-blur-md border border-fg/25 text-fg text-sm hover:bg-fg/25 transition"
        >
          ← Back to YZI Works
        </Link>
      </div>

      <FloatingThemeToggle />
    </>
  )

  // Landing: hero slider → engine → steps → footer.
  if (sera.screen === 'hero') {
    return (
      <div className="min-h-screen bg-surface text-fg">
        {topControls}
        <main>
          <HeroSlider
            darkSlides={SERA_DARK_SLIDES}
            lightSlides={SERA_LIGHT_SLIDES}
            altLabel="Meet Sera slide"
          />
          <SeraHero onStart={sera.goToSignIn} />
          <SeraSteps />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-yzi-black text-white flex flex-col">
      <SeraNetworkBackground className="fixed inset-0 z-0" />

      {topControls}

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-28">
        {sera.screen === 'signin' && (
          <SeraSignIn onSignIn={sera.signIn} busy={sera.busy} error={sera.error} />
        )}

        {sera.screen === 'upload' && (
          <SeraUpload
            profile={sera.profile}
            resumeFile={sera.resumeFile}
            onSelectFile={sera.selectFile}
            onBegin={sera.beginInterview}
            busy={sera.busy}
            error={sera.error}
          />
        )}

        {sera.screen === 'preparing' && <SeraPreparing />}

        {sera.screen === 'interview' && (
          <SeraInterview
            sessionSecondsLeft={sera.sessionSecondsLeft}
            phase={sera.phase}
            turnState={sera.turnState}
            turnElapsed={sera.turnElapsed}
            turnSeconds={sera.turnSeconds}
            muted={sera.muted}
            onToggleMute={sera.toggleMute}
            onEndCall={sera.endCallEarly}
          />
        )}

        {sera.screen === 'wrapup' && <SeraWrapup profile={sera.profile} />}

        {sera.screen === 'report' && (
          <SeraReport
            profile={sera.profile}
            resumeMeta={sera.resumeMeta}
            report={sera.report}
            incomplete={sera.incomplete}
            error={sera.error}
            onDone={sera.reset}
          />
        )}

        {sera.screen === 'blocked' && <SeraBlockedScreen message={sera.blockedMessage} />}
      </main>
    </div>
  )
}

export default MeetSera
