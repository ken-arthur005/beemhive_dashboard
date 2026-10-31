const number = value => Number.isFinite(value) ? value.toLocaleString() : '—'
const percent = value => Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : '—'

export default function VisitorMetrics({ summary, loading }) {
  return <section className="hive-panel hive-panel-pad" aria-labelledby="visitor-metrics-title" aria-busy={loading}>
    <div className="flex flex-wrap justify-between items-baseline gap-2"><h2 id="visitor-metrics-title" className="hive-section-title">Reach & conversion</h2><span className="text-xs text-muted-foreground">Selected period · unique browsers per profile</span></div>
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 my-6">{[
      ['Unique visitors', number(summary?.uniqueVisitors)],
      ['Repeat visitors', number(summary?.repeatVisitors)],
      ['Unique-visitor CTR', percent(summary?.uniqueCtr)],
      ['Contact conversion', percent(summary?.contactConversionRate)],
    ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-3xl tracking-tight mt-2 font-heading tabular-nums">{loading ? '…' : value}</dd></div>)}</dl>
    <p className="text-sm text-foreground">{loading ? 'Loading link activity…' : `${number(summary?.totalClicks)} total link clicks · ${number(summary?.uniqueClickers)} visitors clicked · ${number(summary?.uniqueContactSavers)} visitors downloaded a contact`}</p>
    <details className="mt-4 text-xs text-muted-foreground leading-relaxed"><summary className="cursor-pointer font-medium">How these metrics are counted</summary><div className="mt-2 space-y-2 max-w-prose">
      <p>CTR is the percentage of unique profile visitors in this period who clicked at least one profile link. Contact conversion measures visitors who downloaded a contact. Each browser counts once per profile in the selected period, across its NFC items. Repeat visitors opened the profile more than once during this period.</p>
      <p>Total visits and clicks include return activity. Unique metrics use an anonymous first-party cookie, so another device or cleared cookies count as another visitor. Draft previews, prefetches and recognized bots are excluded. Daily unique counts must not be added together to calculate period uniques.</p>
      <p>Unique metrics cover {number(summary?.trackedViews)} identified visits in this period. {number(summary?.legacyViews)} older or unidentified visits remain in the totals but are excluded from unique metrics and conversion rates.</p>
    </div></details>
  </section>
}
