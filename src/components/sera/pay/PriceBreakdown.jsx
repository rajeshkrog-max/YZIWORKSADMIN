import { SERA_VISITOR_PLAN, formatRupees } from '../../../config/seraPricing'

// Pay card section 3. Display only — the charged amount comes from the server's order.
function PriceBreakdown() {
  const { mrpPaise, pricePaise, offerLabel } = SERA_VISITOR_PLAN
  const mrp = formatRupees(mrpPaise)

  return (
    <section className="py-5 border-t border-fg/10 tabular-nums">
      <div className="flex items-center justify-between text-sm">
        <span className="text-fg/55">Price</span>
        <span className="text-fg/45 line-through">{mrp}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-sm">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 light:text-emerald-700 border border-emerald-500/30">
          {offerLabel}
        </span>
        <span className="font-medium text-emerald-500 light:text-emerald-700">− {formatRupees(mrpPaise - pricePaise)}</span>
      </div>

      <div className="my-4 border-t border-dashed border-fg/15" />

      <div className="flex items-end justify-between">
        <span className="text-sm font-semibold text-fg">Total</span>
        <span className="flex items-baseline gap-2">
          <span className="text-sm text-fg/40 line-through">{mrp}</span>
          <span className="text-3xl font-extrabold text-fg leading-none">{formatRupees(pricePaise)}</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-fg/50 text-right">Your interview starts right after payment.</p>
    </section>
  )
}

export default PriceBreakdown
