import { Link } from 'react-router-dom'
import { useSeraInterview } from '../hooks/useSeraInterview'
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
      <div className="fixed top-6 left-6 z-50">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm hover:bg-white/20 transition"
        >
          ← Back to YZI Works
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-28">
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
