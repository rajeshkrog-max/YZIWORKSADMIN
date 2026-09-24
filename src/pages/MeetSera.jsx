import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

// DEV ONLY — design review of the flow screens without sign-in, upload or a call:
//   /meet-sera?preview=signin|upload|preparing|interview|wrapup|report|blocked
//   extras: &error=1 (signin/upload error line), &file=1 (upload: file chosen),
//           &muted=1 (interview), &variant=incomplete|error (report states)
// import.meta.env.DEV is replaced with `false` in production builds, so this
// data and the preview branch below are removed from the shipped bundle.
const PREVIEW = import.meta.env.DEV
  ? {
      screens: ['signin', 'upload', 'preparing', 'interview', 'wrapup', 'report', 'blocked'],
      profile: { name: 'Priya Sharma', email: 'priya@example.com' },
      resumeFile: { name: 'Priya_Sharma_Resume.pdf', size: 245760 },
      resumeMeta: { originalFilename: 'Priya_Sharma_Resume.pdf', size: 245760 },
      report: {
        strengths: [
          'Explains past work clearly, with concrete examples from real projects.',
          'Calm under a follow-up question — stays on the point.',
        ],
        growthAreas: [
          'Quantify results: numbers make impact easier to believe.',
          'Shorter answers — lead with the outcome, then the detail.',
        ],
        seraNote: 'You clearly know your tools. Now tell the story of what changed because of your work.',
        roadmap: [
          { role: 'Junior Data Analyst', description: 'Where your current skills already fit today.', skills: ['Excel', 'SQL basics'] },
          { role: 'Data Analyst', description: 'One focused step up within 6–12 months.', skills: ['Power BI', 'Python', 'Stakeholder updates'] },
          { role: 'Analytics Lead', description: 'Where this path can go with steady growth.', skills: ['Team leading', 'Data strategy'] },
        ],
        resources: [
          { topic: 'SQL', title: 'SQL for analysts — the queries you use every week', videoUrl: '#', thumbnailUrl: seraSlide1Dark },
          { topic: 'Storytelling', title: 'How to present numbers so people remember them', videoUrl: '#', thumbnailUrl: seraSlide2Dark },
          { topic: 'Interviews', title: 'Answering “tell me about a project” with impact', videoUrl: '#', thumbnailUrl: seraSlide3Dark },
        ],
      },
    }
  : null

const noop = () => {}

function MeetSera() {
  const sera = useSeraInterview()
  const location = useLocation()

  // Dev preview overrides the screen and its data; otherwise `view` is the real hook.
  const params = new URLSearchParams(location.search)
  const previewScreen = PREVIEW?.screens.includes(params.get('preview')) ? params.get('preview') : null
  const view = previewScreen
    ? {
        ...sera,
        screen: previewScreen,
        profile: PREVIEW.profile,
        resumeFile: params.has('file') ? PREVIEW.resumeFile : null,
        resumeMeta: PREVIEW.resumeMeta,
        report: params.get('variant') === 'error' ? null : PREVIEW.report,
        incomplete: params.get('variant') === 'incomplete',
        error: params.has('error') || params.get('variant') === 'error'
          ? 'Sample error — this is how a problem message looks.'
          : null,
        busy: false,
        sessionSecondsLeft: 187,
        phase: 'skills',
        turnState: 'your-turn',
        turnElapsed: 27,
        turnSeconds: 35,
        muted: params.has('muted'),
        blockedMessage: null,
        goToSignIn: noop,
        signIn: noop,
        selectFile: noop,
        beginInterview: noop,
        toggleMute: noop,
        endCallEarly: noop,
        reset: noop,
      }
    : sera

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view.screen])

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
  if (view.screen === 'hero') {
    return (
      <div className="min-h-screen bg-surface text-fg">
        {topControls}
        <main>
          <HeroSlider
            darkSlides={SERA_DARK_SLIDES}
            lightSlides={SERA_LIGHT_SLIDES}
            altLabel="Meet Sera slide"
          />
          <SeraHero onStart={view.goToSignIn} />
          <SeraSteps />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface text-fg flex flex-col">
      <SeraNetworkBackground className="fixed inset-0 z-0" />

      {topControls}

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-28">
        {view.screen === 'signin' && (
          <SeraSignIn onSignIn={view.signIn} busy={view.busy} error={view.error} />
        )}

        {view.screen === 'upload' && (
          <SeraUpload
            profile={view.profile}
            resumeFile={view.resumeFile}
            onSelectFile={view.selectFile}
            onBegin={view.beginInterview}
            busy={view.busy}
            error={view.error}
          />
        )}

        {view.screen === 'preparing' && <SeraPreparing />}

        {view.screen === 'interview' && (
          <SeraInterview
            sessionSecondsLeft={view.sessionSecondsLeft}
            phase={view.phase}
            turnState={view.turnState}
            turnElapsed={view.turnElapsed}
            turnSeconds={view.turnSeconds}
            muted={view.muted}
            onToggleMute={view.toggleMute}
            onEndCall={view.endCallEarly}
          />
        )}

        {view.screen === 'wrapup' && <SeraWrapup profile={view.profile} />}

        {view.screen === 'report' && (
          <SeraReport
            profile={view.profile}
            resumeMeta={view.resumeMeta}
            report={view.report}
            incomplete={view.incomplete}
            error={view.error}
            onDone={view.reset}
          />
        )}

        {view.screen === 'blocked' && <SeraBlockedScreen message={view.blockedMessage} />}
      </main>
    </div>
  )
}

export default MeetSera
