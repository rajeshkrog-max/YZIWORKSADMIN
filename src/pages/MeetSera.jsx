import { Link } from 'react-router-dom'
import { useSeraInterview } from '../hooks/useSeraInterview'
import SeraNetworkBackground from '../components/sera/SeraNetworkBackground'
import SeraHero from '../components/sera/SeraHero'
import SeraSignIn from '../components/sera/SeraSignIn'
import SeraUpload from '../components/sera/SeraUpload'
import SeraPreparing from '../components/sera/SeraPreparing'
import SeraInterview from '../components/sera/SeraInterview'
import SeraWrapup from '../components/sera/SeraWrapup'
import SeraReport from '../components/sera/SeraReport'
import SeraBlockedScreen from '../components/sera/SeraBlockedScreen'

function MeetSera() {
  const sera = useSeraInterview()

  return (
    <div className="min-h-screen bg-yzi-black text-white flex flex-col">
      <SeraNetworkBackground className="fixed inset-0 z-0" />

      {/* AnnouncementBar (src/components/AnnouncementBar.jsx) is a global
          fixed bar at z-[200], up to ~48.8px tall on desktop / ~44.8px on
          mobile (measured, not assumed). top-16 (64px) clears it on both
          with margin — top-6 (24px) used to sit entirely inside that band,
          so the marquee's far higher z-index just won the overlap outright. */}
      <div className="fixed top-16 left-6 z-50">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-sm hover:bg-white/25 transition"
        >
          ← Back to YZI Works
        </Link>
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-28">
        {sera.screen === 'hero' && <SeraHero onStart={sera.goToSignIn} />}

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
