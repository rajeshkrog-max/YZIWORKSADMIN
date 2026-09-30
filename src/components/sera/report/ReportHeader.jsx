import Logo from '../../Logo'
import DownloadReportButton from './DownloadReportButton'
import { PANEL } from './reportStyles'

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const Chip = ({ children }) => (
  <span className="inline-flex items-center gap-2 max-w-full px-3 py-1 rounded-full border border-fg/15 bg-fg/5 light:bg-white/60 text-xs text-fg/75">
    {children}
  </span>
)

function ReportHeader({ report, onDownload }) {
  return (
    <header className={PANEL}>
      <div className="flex items-center justify-between gap-3">
        <Logo className="h-9 sm:h-11" />
        <DownloadReportButton onDownload={onDownload} />
      </div>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-cyan-fg">Sera's reading</p>
      <h1 className="mt-1.5 text-2xl sm:text-4xl font-extrabold text-fg leading-tight">
        Your interview report, {report.firstName}
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>{formatDate(report.interviewDate)}</Chip>
        <Chip>3-round interview · about {report.interviewMinutes} minutes</Chip>
        {report.chosenOffer && (
          <Chip>
            <span className="w-5 h-5 shrink-0 rounded-md grid place-items-center bg-gradient-to-br from-yzi-cyan to-yzi-purple text-white text-[10px] font-bold">
              {report.chosenOffer.logoLetter}
            </span>
            <span className="truncate">
              {report.chosenOffer.company} · {report.chosenOffer.role}
            </span>
          </Chip>
        )}
      </div>
    </header>
  )
}

export default ReportHeader
