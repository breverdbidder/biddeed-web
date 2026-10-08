import type { Brief, BriefBrand, BriefProperty, ScoreLine, Verdict } from '@/lib/briefs/types'
import { countyLabel, longDate, money, pct, ratio, STRATEGY_LABEL } from '@/lib/briefs/view'

/**
 * The ensuite-deck brief (loader CSS: /briefs/deck.css), rendered on the server.
 * The deck's script that stacks 4+ column tables into cards on a phone is replaced by
 * rendering both and letting a media query pick, so the page ships no JavaScript.
 */

const MAX_COMPS = 5

function Pill({ v }: { v: Verdict }) {
  const cls = v === 'BID' ? 'pill bid' : v === 'SKIP' ? 'pill skip' : 'pill'
  return <span className={cls}>{v}</span>
}

/** A table that becomes a stack of cards under 760px. Column 0 is the card title. */
function ResponsiveTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return null
  // Same rule as the deck: only tables with 4+ columns become cards on a phone; narrower ones just fit.
  if (columns.length < 4) {
    return (
      <div className="tw">
        <table>
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  return (
    <>
      <div className="tw bd-wide">
        <table>
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="stack bd-cards">
        {rows.map((r, i) => (
          <div className="scard" key={i}>
            <p className="st">{r[0]}</p>
            {r.slice(1).map((c, j) => (
              <p className="sr" key={j}><span>{columns[j + 1]}</span><span className="v">{c}</span></p>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
type ReactNode = React.ReactNode

function Kv({ items }: { items: Array<[string, ReactNode]> }) {
  return <div className="kv">{items.map(([k, v]) => <div key={k}><b>{k}</b><span>{v}</span></div>)}</div>
}

function underwritingRows(open: ScoreLine, max: ScoreLine | null, hold: boolean): ReactNode[][] {
  const pair = (label: string, f: (s: ScoreLine) => ReactNode): ReactNode[] => [label, f(open), max ? f(max) : '—']
  const rows: ReactNode[][] = [
    pair('Price paid', (s) => money(s.inputs.bid)),
    pair('Rehab', (s) => money(s.inputs.rehab)),
    pair('Closing', (s) => money(s.inputs.closing)),
    pair('Holding', (s) => money(s.inputs.holding)),
    pair('All-in', (s) => money(s.all_in)),
    pair('After-repair value', (s) => money(s.inputs.arv)),
    pair('Flip margin', (s) => pct(s.flip_margin)),
  ]
  if (hold) {
    rows.push(
      pair('Gross rent, annual', (s) => money(s.gross)),
      pair('Net operating income', (s) => money(s.noi)),
      pair('Cap rate on all-in', (s) => pct(s.cap)),
      pair('Refinance loan', (s) => money(s.refi?.loan)),
      pair('Debt service coverage', (s) => ratio(s.refi?.dscr)),
      pair('Cash left in', (s) => money(s.cash_left_in)),
      pair('Cash flow after debt', (s) => money(s.cash_flow)),
      pair('Cash-on-cash', (s) => pct(s.coc)),
    )
  }
  return rows
}

function PropertySection({ p, hold, n }: { p: BriefProperty; hold: boolean; n: number }) {
  const ev = p.evidence
  return (
    <section className="light" id={`p${n}`}>
      <p data-eyebrow>{`Property ${n} · ${p.case_number}`}</p>
      <h2>{p.address ?? 'Address not on record'}</h2>
      <p><Pill v={p.verdict} /> {p.verdict_capped ? <span className="muted"> Held at REVIEW until title is verified.</span> : null}</p>
      <Kv items={[
        ['Sale date', longDate(p.auction_date)],
        ['Opening bid', money(p.opening_bid)],
        ['Max bid at your gates', p.score && p.score.max_bid > 0 ? money(p.score.max_bid) : '—'],
        ['Room to max bid', p.room_to_max_bid != null ? money(p.room_to_max_bid) : '—'],
      ]} />
      {p.score ? (
        <>
          <h3>Underwriting at the opening bid and at your max bid</h3>
          <ResponsiveTable columns={['Line', 'At opening bid', 'At max bid']} rows={underwritingRows(p.score, p.at_max_bid, hold)} />
        </>
      ) : <p>Not enough recorded data to underwrite this property. See open items below.</p>}
      <h3>Where the numbers come from</h3>
      <ul>
        {ev.arv ? <li>After-repair value {money(ev.arv.value)}: {ev.arv.source}.</li> : null}
        {ev.rehab ? <li>Rehab {money(ev.rehab.value)}: {ev.rehab.source}.</li> : null}
        {ev.rent ? <li>Rent {money(ev.rent.monthly)} a month: {ev.rent.source}{ev.rent.example ? '. Example number; verify against current asking rents' : ''}.</li> : null}
        {ev.zoning?.district ? <li>Zoning {ev.zoning.district}{ev.zoning.jurisdiction ? `, ${ev.zoning.jurisdiction}` : ''}. {ev.zoning.note}</li> : null}
      </ul>
      {ev.comps?.table && ev.comps.table.rows.length > 0 ? (
        <>
          <h3>Comparable sales</h3>
          <ResponsiveTable columns={ev.comps.table.columns} rows={ev.comps.table.rows.slice(0, MAX_COMPS).map((r) => r.map((c, i) => (typeof c === 'number' && /price/i.test(ev.comps!.table!.columns[i]) ? money(c) : String(c ?? '—'))))} />
          {ev.comps.note ? <p className="cite">{ev.comps.note}</p> : null}
        </>
      ) : null}
      {p.open_items.length > 0 ? (
        <>
          <h3>Open items to verify</h3>
          <ul>{p.open_items.map((o) => <li key={o}>{o}</li>)}</ul>
        </>
      ) : null}
      <p data-foot>{ev.liens?.note ?? 'Lien and title items are open items to verify with a title search.'}</p>
    </section>
  )
}

export default function BriefDeck({ brief, brand }: { brief: Brief; brand: BriefBrand }) {
  const hold = brief.input.strategy !== 'flip'
  const strategy = STRATEGY_LABEL[brief.input.strategy] ?? brief.input.strategy
  const county = countyLabel(brief.input.market.county)
  const markets = brief.input.market.cities.length ? brief.input.market.cities.join(', ') : `${county} County`
  const cols = ['Rank', 'Property', 'Sale date', 'Opening bid', 'Verdict', 'Max bid', 'Room']
  const jurisdictions = Array.from(new Set(brief.properties.map((p) => p.evidence.zoning?.jurisdiction).filter(Boolean))) as string[]
  // One page per property that made the screen; the rest are counted in the summary, not rendered.
  const onScreen = new Set(brief.screen.map((s) => s.case_number))
  const shown = brief.properties.filter((p) => onScreen.has(p.case_number))
  const risks = Array.from(new Set(shown.flatMap((p) => p.open_items)))

  return (
    <>
      <section className="dark" id="cover">
        {brand.logo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="brand-logo" src={brand.logo_url} alt={`${brand.name} logo`} width={160} height={56} /> : null}
        <p data-eyebrow>{`Investment brief · ${county} County`}</p>
        <h1>{markets}</h1>
        <p data-mid>{strategy}</p>
        <p>{`Sales from ${longDate(brief.window.from)} to ${longDate(brief.window.to)}`}{brief.input.audience?.name ? ` · Prepared for ${brief.input.audience.name}` : ''}</p>
        <p data-foot>{brand.name}{brand.license_no ? ` · License ${brand.license_no}` : ''}</p>
      </section>

      <section className="light" id="summary">
        <p data-eyebrow>Summary</p>
        <h2>{`${brief.counts.confirmed} confirmed sale${brief.counts.confirmed === 1 ? '' : 's'} screened against your buy box`}</h2>
        <Kv items={[
          ['On the radar', String(brief.counts.on_radar)],
          ['Confirmed twice', String(brief.counts.confirmed)],
          ['Held back', String(brief.counts.excluded)],
          ['Verdict BID', String(brief.properties.filter((p) => p.verdict === 'BID').length)],
          ['Verdict REVIEW', String(brief.properties.filter((p) => p.verdict === 'REVIEW').length)],
        ]} />
        <p>Each sale appears here only when the county record and the Clerk&apos;s published sale list agree it is going forward.</p>
      </section>

      <section className="light" id="market">
        <p data-eyebrow>Market rules</p>
        <h2>Zoning and rules by jurisdiction</h2>
        <p>{jurisdictions.length ? `Jurisdictions in this brief: ${jurisdictions.join(', ')}.` : 'No zoning records were found for these properties.'}</p>
        {hold && brief.input.strategy !== 'brrr_hold' ? (
          <p>Short-term and mid-term rental rules differ by city and are not verified in this brief. Confirm each city&apos;s rental ordinance, and Florida Statutes chapter 509 where it applies, before relying on rental income.</p>
        ) : null}
        <p data-foot>Zoning is taken from county and municipal records; confirm with the jurisdiction before relying on it.</p>
      </section>

      <section className="light" id="screen">
        <p data-eyebrow>Screen</p>
        <h2>{`Top ${brief.screen.length} by verdict, then room to max bid`}</h2>
        <ResponsiveTable
          columns={cols}
          rows={brief.screen.map((s) => [
            `${s.rank}`, s.address ?? s.case_number, longDate(s.auction_date), money(s.opening_bid), <Pill key="v" v={s.verdict} />,
            s.max_bid && s.max_bid > 0 ? money(s.max_bid) : '—', s.room_to_max_bid != null ? money(s.room_to_max_bid) : '—',
          ])}
        />
        <p data-foot>Max bid is the price at which your own gates are exactly met. It is arithmetic on recorded facts and your inputs, not a prediction.</p>
      </section>

      {shown.map((p, i) => <PropertySection key={p.case_number} p={p} hold={hold} n={i + 1} />)}

      <section className="light" id="assumptions">
        <p data-eyebrow>Model assumptions</p>
        <h2>Your gates and the financing assumed</h2>
        <Kv items={[
          ['Cap rate', pct(brief.input.gates.cap)],
          ['Cash-on-cash', pct(brief.input.gates.coc)],
          ['Debt service coverage', ratio(brief.input.gates.dscr)],
          ['Flip margin', pct(brief.input.gates.flip_margin)],
          ['Refinance rate', pct(brief.input.capital.refi_rate ?? 0.065)],
          ['Amortization', `${brief.input.capital.refi_years ?? 30} years`],
        ]} />
        <p>{`Rehab is sized at ${brief.input.repair_scope} scope from catalog unit costs. Insurance is not quoted and is carried at zero until a quote is bound.`}</p>
      </section>

      {brief.excluded.length > 0 ? (
        <section className="light" id="held">
          <p data-eyebrow>Held back</p>
          <h2>Sales not underwritten</h2>
          <ResponsiveTable columns={['Property', 'Sale date', 'Why']} rows={brief.excluded.map((e) => [e.address ?? e.case_number, longDate(e.auction_date), e.reason])} />
        </section>
      ) : null}

      <section className="dark" id="operator">
        <p data-eyebrow>Your operator</p>
        <h2>{brand.name}</h2>
        {brand.license_no ? <p>{`License ${brand.license_no}`}</p> : null}
        <p>Questions on any property, the underwriting, or how to bid: contact the team that sent you this brief.</p>
      </section>

      <section className="light" id="risks">
        <p data-eyebrow>Risks</p>
        <h2>Open items across this brief</h2>
        {risks.length ? <ul>{risks.map((r) => <li key={r}>{r}</li>)}</ul> : <p>None recorded.</p>}
      </section>

      <section className="light" id="next">
        <p data-eyebrow>Next steps</p>
        <h2>Before you bid</h2>
        <ol>
          <li>Order a title search on every property you intend to bid on.</li>
          <li>Inspect, or price the unknowns into your bid.</li>
          <li>Confirm sale date and status on the Clerk&apos;s site the day before.</li>
          <li>Have funds in place: the sale requires a deposit and balance on the Clerk&apos;s timeline.</li>
        </ol>
      </section>

      <section className="light" id="sources">
        <p data-eyebrow>Sources</p>
        <h2>Public records</h2>
        <ul>{brief.sources.map((s) => <li key={s}>{s}</li>)}</ul>
        <ul>{brief.disclosures.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>
    </>
  )
}
