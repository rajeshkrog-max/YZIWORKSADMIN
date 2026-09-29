import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'
import GlassBlobs from './login/GlassBlobs'
import { REPORT_FINE_PRINT, reportSections, validate } from '../../shared/seraReportSchema'
import ReportHeader from './report/ReportHeader'
import ScoreSummary from './report/ScoreSummary'
import RoundScores from './report/RoundScores'
import SkillEvidence from './report/SkillEvidence'
import StrengthsGrowth from './report/StrengthsGrowth'
import AnswerRewrite from './report/AnswerRewrite'
import OfferFit from './report/OfferFit'
import SpeakingStats from './report/SpeakingStats'
import ReportPlan from './report/ReportPlan'
import CommunityCta from './report/CommunityCta'
import DownloadReportButton from './report/DownloadReportButton'
import { downloadReport } from '../../services/seraReportService'

// No report to show (ended early, still on its way, or it didn't validate).
function ReportNotice({ title, text, onDone }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <SeraWave state="disabled" bleed className="w-full h-[120px] md:h-[160px] mb-6" label="Sera" />
      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-fg/65 leading-relaxed">{text}</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-6 w-full h-[50px] rounded-full border border-fg/15 bg-fg/5 light:bg-white/60 text-fg font-semibold hover:bg-fg/10 transition"
        >
          Back to YZI Works
        </button>
      </GlassCard>
    </div>
  )
}

// The report page. Renders ONLY a report that passes validate(); every section
// whose data is missing is hidden (reportSections), never shown empty.
function SeraReport({ report, sessionId, incomplete, error, onDone }) {
  if (incomplete) {
    return (
      <ReportNotice
        title="Interview ended early"
        text="Looks like the interview ended early — no worries, we'll get you scheduled for another session soon."
        onDone={onDone}
      />
    )
  }

  if (!report) {
    return (
      <ReportNotice
        title="Your report is still on its way"
        text={error || 'Something went wrong preparing your report — our team still received your interview.'}
        onDone={onDone}
      />
    )
  }

  const { valid, errors } = validate(report)
  if (!valid) {
    console.warn('Sera report failed validation — not rendered', errors)
    return (
      <ReportNotice
        title="Your report hit a snag"
        text="We couldn't display your report. Our team has your interview and will follow up."
        onDone={onDone}
      />
    )
  }

  const show = reportSections(report)
  // Both buttons use the same call; the server emails the team copy only once.
  const onDownload = () => downloadReport(sessionId, { report })

  return (
    <div className="relative w-full max-w-5xl flex flex-col gap-5 text-left">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-24 h-[70vh] max-w-5xl mx-auto -z-10">
        <GlassBlobs />
      </div>

      <ReportHeader report={report} onDownload={onDownload} />
      <ScoreSummary report={report} sections={show} />
      {show.rounds && <RoundScores rounds={report.rounds} />}
      {show.skills && <SkillEvidence skills={report.skills} showBar={show.skillBar} />}
      {(show.strengths || show.growth) && <StrengthsGrowth strengths={report.strengths} growth={report.growth} />}
      {show.rewrite && <AnswerRewrite rewrite={report.rewrite} />}
      {show.offerFit && <OfferFit offerFit={report.offerFit} />}
      {show.speaking && <SpeakingStats speaking={report.speaking} />}
      {show.plan && <ReportPlan plan={report.plan} />}
      <CommunityCta />

      <div className="mt-2 flex flex-col items-center gap-5 text-center">
        <DownloadReportButton onDownload={onDownload} className="items-center" />
        <p className="max-w-2xl text-xs text-fg/45 leading-relaxed">{REPORT_FINE_PRINT}</p>
      </div>
    </div>
  )
}

export default SeraReport
