import { ROUND_LABELS, formatTimestamp } from '../../../shared/seraReportSchema'
import { PANEL, SECTION_LABEL } from './reportStyles'

function Column({ title, icon, iconCls, items }) {
  return (
    <div className={PANEL}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
        <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${iconCls}`} aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.text}>
            <p className="text-sm text-fg/85 leading-relaxed">{item.text}</p>
            <p className="mt-1 text-xs font-mono text-fg/45">
              {ROUND_LABELS[item.moment.round]} · {formatTimestamp(item.moment.timestamp)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// What worked / What to work on — each point tied to a specific moment.
function StrengthsGrowth({ strengths, growth }) {
  return (
    <section aria-label="What worked and what to work on">
      <p className={`${SECTION_LABEL} mb-3 px-1`}>What worked · What to work on</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strengths.length > 0 && (
          <Column title="What worked" icon="✓" iconCls="bg-emerald-500/15 text-emerald-500" items={strengths} />
        )}
        {growth.length > 0 && <Column title="What to work on" icon="↗" iconCls="bg-amber-400/15 text-amber-500" items={growth} />}
      </div>
    </section>
  )
}

export default StrengthsGrowth
