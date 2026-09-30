import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSeraInterview } from '../hooks/useSeraInterview'
import HeroSlider from '../components/HeroSlider'
import Footer from '../components/Footer'
import SeraNetworkBackground from '../components/sera/SeraNetworkBackground'
import SeraHero from '../components/sera/SeraHero'
import SeraSteps from '../components/sera/SeraSteps'
import SeraLogin from '../components/sera/login/SeraLogin'
import SeraUpload from '../components/sera/SeraUpload'
import SeraPreparing from '../components/sera/SeraPreparing'
import InterviewRoom from '../components/sera/interview/InterviewRoom'
import SeraWrapup from '../components/sera/SeraWrapup'
import SeraReport from '../components/sera/SeraReport'
import SeraBlockedScreen from '../components/sera/SeraBlockedScreen'
import SeraConnectionLost from '../components/sera/SeraConnectionLost'
import FloatingThemeToggle from '../theme/FloatingThemeToggle'
import { roundsFor } from '../config/seraRounds'
import { getDevTestSession } from '../services/seraAuthService'
import { isDevMock } from '../services/seraMockCall'
import SeraDevPanel from '../components/sera/dev/SeraDevPanel'
import { getChosenOffer } from '../shared/seraSession'
import seraSlide1Dark from '../assets/sera_hero/slide1dark.png'
import seraSlide2Dark from '../assets/sera_hero/slide2dark.png'
import seraSlide3Dark from '../assets/sera_hero/slide3dark.png'
import seraSlide4Dark from '../assets/sera_hero/slide4dark.png'
import seraSlide1Light from '../assets/sera_hero/slide1light.png'
import seraSlide2Light from '../assets/sera_hero/slide2light.png'
import seraSlide3Light from '../assets/sera_hero/slide3light.png'
import seraSlide4Light from '../assets/sera_hero/slide4light.png'

// Same index = same slide; the theme picks the set. Always 4.
// New User-only pay screen (route 'visitor'), loaded on demand so students never download the
// payment code (Razorpay loader, pricing, payment service).
const SeraPay = lazy(() => import('../components/sera/pay/SeraPay'))

const SERA_DARK_SLIDES = [seraSlide1Dark, seraSlide2Dark, seraSlide3Dark, seraSlide4Dark]
const SERA_LIGHT_SLIDES = [seraSlide1Light, seraSlide2Light, seraSlide3Light, seraSlide4Light]

// DEV ONLY — design review of the flow screens without sign-in, upload or a call:
//   /meet-sera?preview=signin|upload|preparing|pay|interview|wrapup|report|blocked|lost
//   extras: &error=1 (signin/upload error line), &file=1 (upload: file chosen),
//           &muted=1 (interview), &variant=incomplete|error|gaps (report states;
//           gaps = a skill with no evidence + a cut-short round), &route=visitor
//           interview: &round=screening|offer|hr|final, &turn=sera-speaking|your-turn|wrapping-up,
//                      &connecting=1 (HR → Final hand-over)
// import.meta.env.DEV is replaced with `false` in production builds, so this
// data and the preview branch below are removed from the shipped bundle.
const PREVIEW = import.meta.env.DEV
  ? {
      screens: ['signin', 'upload', 'preparing', 'pay', 'interview', 'wrapup', 'report', 'blocked', 'lost'],
      resumeFile: { name: 'Priya_Sharma_Resume.pdf', size: 245760 },
    }
  : null

const noop = () => {}

function MeetSera() {
  const sera = useSeraInterview()
  const location = useLocation()

  // Dev preview overrides the screen and its data; otherwise `view` is the real hook.
  const params = new URLSearchParams(location.search)
  const previewScreen = PREVIEW?.screens.includes(params.get('preview')) ? params.get('preview') : null
  // DEV ONLY — ?testlogin=visitor|student signs in a fake profile and opens
  // upload (mock mode on the dev server only; see getDevTestSession).
  const testLogin = import.meta.env.DEV ? params.get('testlogin') : null
  const { completeLogin, goToSignIn, reset } = sera
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const session = getDevTestSession(testLogin)
    if (session) completeLogin(session)
  }, [testLogin, completeLogin])

  // Rejoin after a dropped call: /meet-sera?rejoin=TOKEN (visitor link from
  // WhatsApp) opens the login with a "Continue your interview" banner.
  // DEV ONLY — ?rejoincode=CODE pre-fills the Student tab with a rejoin code.
  const rejoinToken = params.get('rejoin')
  const devRejoinCode = import.meta.env.DEV ? params.get('rejoincode') : null
  useEffect(() => {
    if (!rejoinToken && !devRejoinCode) return
    reset()
    goToSignIn()
  }, [rejoinToken, devRejoinCode, reset, goToSignIn])

  // DEV ONLY — the preview's sample data is loaded on demand, so the fixtures
  // never reach the production bundle.
  const [previewModule, setPreviewModule] = useState(null)
  useEffect(() => {
    if (!import.meta.env.DEV || !previewScreen) return
    import('../services/seraMockPreview').then((mod) => setPreviewModule(mod))
  }, [previewScreen])

  const view = previewScreen && previewModule
    ? {
        ...sera,
        screen: previewScreen,
        // DEV ONLY — sample session + report built by the real pipeline (seraMockPreview).
        session: previewModule.previewSession({
          route: params.get('route') === 'visitor' ? 'visitor' : 'student',
          variant: params.get('variant'),
        }),
        resumeFile: params.has('file') ? PREVIEW.resumeFile : null,
        incomplete: params.get('variant') === 'incomplete',
        error: params.has('error') || params.get('variant') === 'error'
          ? 'Sample error — this is how a problem message looks.'
          : null,
        busy: false,
        turnState: params.get('turn') ?? 'your-turn',
        turnElapsed: 27,
        turnSeconds: 45,
        rounds: roundsFor(),
        roundIndex: Math.max(0, roundsFor().findIndex((r) => r.id === params.get('round'))),
        connectingTo: params.has('connecting') ? roundsFor().find((r) => r.id === 'final') : null,
        roundSecondsLeft: 187,
        chooseOffer: noop,
        muted: params.has('muted'),
        blockedMessage: null,
        goToSignIn: noop,
        completeLogin: noop,
        selectFile: noop,
        beginInterview: noop,
        startInterview: noop,
        onPaymentSuccess: noop,
        changeResume: noop,
        toggleMute: noop,
        endCallEarly: noop,
        reset: noop,
        lostInfo: { rejoinIssued: true },
        resumeSession: noop,
      }
    : sera

  // Each screen starts at the top — "Meet Sera" is clicked halfway down the landing.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view.screen])

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

      {/* DEV ONLY — mock-mode controls (simulated call, payment outcomes). */}
      {import.meta.env.DEV && isDevMock() && <SeraDevPanel />}

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-28">
        {view.screen === 'signin' && (
          <SeraLogin
            key={rejoinToken ?? devRejoinCode ?? 'login'}
            onDone={view.completeLogin}
            onRejoin={view.resumeSession}
            rejoinToken={rejoinToken}
            initialCode={devRejoinCode}
          />
        )}

        {view.screen === 'upload' && (
          <SeraUpload
            session={view.session}
            resumeFile={view.resumeFile}
            onSelectFile={view.selectFile}
            onBegin={view.beginInterview}
            busy={view.busy}
            error={view.error}
          />
        )}

        {view.screen === 'preparing' && <SeraPreparing />}

        {view.screen === 'pay' && (
          <Suspense fallback={null}>
            <SeraPay
              session={view.session}
              fileName={view.resumeFile?.name ?? view.session?.resume.objectKey?.split('/').pop()}
              onPaymentSuccess={view.onPaymentSuccess}
              onChangeResume={view.changeResume}
            />
          </Suspense>
        )}

        {view.screen === 'interview' && (
          <InterviewRoom
            rounds={view.rounds}
            roundIndex={view.roundIndex}
            roundSecondsLeft={view.roundSecondsLeft}
            turnState={view.turnState}
            turnElapsed={view.turnElapsed}
            turnSeconds={view.turnSeconds}
            muted={view.muted}
            offers={view.session?.offers}
            chosenOffer={getChosenOffer(view.session)}
            onChooseOffer={view.chooseOffer}
            onToggleMute={view.toggleMute}
            onEndCall={view.endCallEarly}
            connectingTo={view.connectingTo}
          />
        )}

        {view.screen === 'lost' && (
          <SeraConnectionLost session={view.session} rejoinIssued={view.lostInfo?.rejoinIssued ?? true} />
        )}

        {view.screen === 'wrapup' && <SeraWrapup session={view.session} reportReady={view.reportReady} />}

        {view.screen === 'report' && (
          <SeraReport
            report={view.session?.report}
            sessionId={view.session?.sessionId}
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
