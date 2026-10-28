import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import LineChart from '../components/LineChart'
import { fetchStats, fetchTemplatesOverview, StatsNeedUpdate } from '../lib/supabase'
import {
  PERIODS, periodRange, fillDays, deltaText, exportRate, byOccasion, idleTemplates, topWithRate,
  bestWindow, hourLabel, versionShares, subscriptionSummary,
} from '../lib/numbers'
import { countAr } from '../lib/today'
import { OCCASION_LABEL } from '../lib/occasions'

// «الأرقام»: داخل اللوحة بهويتها بدل الصفحة المنفصلة. رقم واحد مهم بخطه، والبقية تحته؛
// اختيار مقياس يحرّك الرقم والخط والمقارنة معاً (مادة التزامن متعدد العناصر).

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }
const dayLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' })

function AnimatedNumber({ value, format = fmt, className }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))
  useEffect(() => {
    if (reduce) { mv.set(value); return }
    const a = animate(mv, value, SETTLE)
    return () => a.stop()
  }, [value, reduce, mv])
  return <motion.span className={className}>{text}</motion.span>
}

function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`rounded-card border border-hair bg-surface p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function PeriodSwitch({ days, onChange }) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-hair bg-sunken p-1" role="group" aria-label="الفترة">
      {PERIODS.map((p) => (
        <button
          key={p.days}
          type="button"
          aria-pressed={p.days === days}
          onClick={() => onChange(p.days)}
          className={`relative min-h-9 rounded-full px-4 text-[13px] ${p.days === days ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}
        >
          {p.days === days && <motion.span layoutId="period-pill" className="absolute inset-0 rounded-full bg-surface shadow-card" transition={SETTLE} />}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </div>
  )
}

function MetricPanel({ stats, range, days }) {
  const series = fillDays(stats.daily, range.from, days)
  const t = stats.totals, p = stats.prev
  const metrics = [
    { key: 'exports', label: 'تصدير', total: t.exports, prev: p.exports, data: series.map((d) => d.exports), note: 'حفظ ومشاركة' },
    { key: 'devices', label: 'جهاز فتح التطبيق', total: t.devices, prev: p.devices, data: series.map((d) => d.devices), note: t.new_devices ? `منها ${fmt(t.new_devices)} جديدة` : null },
    { key: 'opens', label: 'مرة فتح', total: t.opens, prev: p.opens, data: series.map((d) => d.opens) },
  ]
  const rate = exportRate(t.exporters, t.viewers)
  if (rate != null) {
    metrics.push({
      key: 'rate', label: 'نسبة التصدير', total: rate, prev: exportRate(p.exporters, p.viewers),
      data: series.map((d) => exportRate(d.exporters, d.viewers) ?? 0), format: (v) => `${Math.round(v)}%`, note: 'من شاهد قالباً فصدّره',
    })
  }
  const [key, setKey] = useState('exports')
  const m = metrics.find((x) => x.key === key) ?? metrics[0]
  const delta = deltaText(m.total, m.prev)
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-label="المقياس الرئيسي">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <AnimatedNumber value={m.total} format={m.format} className="num text-[44px] font-extrabold leading-none tracking-tight" />
        <span className="text-[15px] text-ink-2">{m.label}</span>
        {delta && (
          <span className={`num rounded-full px-2 py-0.5 text-[11px] font-bold ${delta.up ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
            {delta.text} عن الأيام الـ{days} السابقة
          </span>
        )}
      </div>
      {m.note && <p className="mt-1 text-[13px] text-ink-2">{m.note}</p>}
      <div className="mt-4">
        <LineChart
          data={m.data}
          drawKey={days}
          format={m.format ?? fmt}
          startLabel={dayLabel.format(range.from)}
          endLabel="اليوم"
          ariaLabel={`${m.label} يومياً`}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hair pt-4 sm:grid-cols-4" role="tablist" aria-label="المقاييس">
        {metrics.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === key}
            onClick={() => setKey(x.key)}
            className={`relative grid min-h-14 gap-0.5 rounded-xl px-3 py-2 text-start ${x.key === key ? 'bg-gold/10' : 'hover:bg-sunken'}`}
          >
            {x.key === key && <motion.span layoutId="metric-rail" className="absolute inset-y-2 start-0 w-[3px] rounded-e-[3px] bg-gold" transition={SETTLE} />}
            <b className="num text-[20px] font-extrabold leading-tight">{(x.format ?? fmt)(x.total)}</b>
            <span className="text-[11px] text-ink-2">{x.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Thumb({ src, className = 'h-[54px] w-10' }) {
  return <span className={`block flex-shrink-0 overflow-hidden rounded-lg bg-sunken ${className}`}>{src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
}

function Occasions({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.exports))
  return (
    <Card title="المناسبات" aside={<span className="text-[11px] text-ink-3">تصدير · نسبة التصدير</span>}>
      {rows.length === 0 ? <p className="text-[13px] text-ink-2">لا تصدير في هذه الفترة.</p> : (
        <ul className="grid">
          {rows.map((o, i) => (
            <li key={o.key} className={`grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 py-2.5 ${i ? 'border-t border-hair' : ''}`}>
              <Thumb src={o.cover} />
              <div className="grid min-w-0 gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate"><b className="font-bold">{o.label}</b> <span className="text-ink-3">· {countAr(o.templates, 'template')}</span></span>
                  <span className="num whitespace-nowrap"><b className="font-bold">{fmt(o.exports)}</b>{o.rate != null && <span className="text-ink-3"> · {o.rate}%</span>}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <motion.i className="block h-full rounded-full bg-gold" initial={false} animate={{ width: `${(o.exports / max) * 100}%` }} transition={SETTLE} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function BestTime({ hours }) {
  const w = bestWindow(hours)
  const max = Math.max(1, ...w.opens)
  const inWindow = (h) => h === w.start || h === (w.start + 1) % 24
  const total = w.opens.reduce((a, b) => a + b, 0)
  return (
    <Card title="أفضل وقت لإشعار">
      {total === 0 ? <p className="text-[13px] text-ink-2">لا فتح للتطبيق في هذه الفترة.</p> : (
        <>
          <p className="text-[15px] leading-relaxed">
            الناس يفتحون التطبيق أكثر <b className="font-bold">بين {hourLabel(w.start)} و{hourLabel(w.end)}</b>
            <span className="num text-ink-2"> · {w.share}% من الفتح</span>
          </p>
          {/* الساعات من 12 ليلاً يميناً إلى 11 مساءً يساراً، باتجاه القراءة */}
          <div className="mt-4 flex h-24 items-end gap-[3px]" role="img" aria-label="فتح التطبيق حسب الساعة">
            {w.opens.map((v, h) => (
              <motion.span
                key={h}
                className={`flex-1 rounded-t-[3px] ${inWindow(h) ? 'bg-gold' : 'bg-gold/25'}`}
                initial={false}
                animate={{ height: `${Math.max(2, (v / max) * 100)}%` }}
                transition={SETTLE}
                title={`${hourLabel(h)}: ${fmt(v)}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
            <span>12 ليلاً</span><span>6 صباحاً</span><span>12 ظهراً</span><span>6 مساءً</span><span>11 مساءً</span>
          </div>
          <Link to="/reach/notifications" className="mt-4 inline-grid min-h-10 place-items-center rounded-full border border-hair px-4 text-[13px] font-semibold hover:border-gold hover:text-gold">
            أرسل إشعاراً
          </Link>
        </>
      )}
    </Card>
  )
}

function Top({ rows }) {
  return (
    <Card title="الأكثر تصديراً" aside={<span className="text-[11px] text-ink-3">تصدير · من شاهده فصدّره</span>}>
      {rows.length === 0 ? <p className="text-[13px] text-ink-2">لا تصدير في هذه الفترة.</p> : (
        <ol className="grid">
          {rows.map((r, i) => (
            <li key={r.id} className={`grid grid-cols-[20px_40px_minmax(0,1fr)_auto] items-center gap-3 py-2 ${i ? 'border-t border-hair' : ''}`}>
              <span className="num text-[13px] font-bold text-ink-3">{i + 1}</span>
              <Thumb src={r.cover} />
              <span className="truncate text-[13px] text-ink-2">{OCCASION_LABEL[r.category] ?? r.category}</span>
              <span className="num whitespace-nowrap text-[13px]"><b className="font-bold">{fmt(r.exports)}</b>{r.rate != null && <span className="text-ink-3"> · {r.rate}%</span>}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function Idle({ rows, days }) {
  return (
    <Card
      title="قوالب لم يصدّرها أحد"
      aside={rows.length > 0 && <Link to="/templates/occasions" className="text-[13px] font-semibold text-gold">اعرض القوالب</Link>}
    >
      {rows.length === 0 ? <p className="text-[13px] text-ink-2">كل القوالب الظاهرة صُدّرت مرة على الأقل.</p> : (
        <>
          <p className="mb-3 text-[13px] text-ink-2">
            <b className="num font-bold text-ink">{countAr(rows.length, 'template')}</b> ظاهرة للمستخدمين ولم يصدّرها أحد في آخر {countAr(days, 'day')}. أخفِها أو بدّل صورتها كي لا تزاحم الرائج.
          </p>
          <div className="grid grid-cols-6 gap-2">
            {rows.slice(0, 12).map((r) => <Thumb key={r.id} src={r.cover} className="aspect-[9/16] w-full" />)}
          </div>
        </>
      )}
    </Card>
  )
}

function Subscribers({ rows }) {
  const s = subscriptionSummary(rows)
  return (
    <Card title="«نصّ المميز»">
      {s.total === 0 ? <p className="text-[13px] text-ink-2">لا مشتركين بعد. الاشتراك يبدأ مع إصدار 2.0.</p> : (
        <>
          <div className="flex items-baseline gap-2">
            <b className="num text-[36px] font-extrabold leading-none">{fmt(s.total)}</b>
            <span className="text-[13px] text-ink-2">مشتركاً الآن</span>
          </div>
          <div className="num mt-3 flex flex-wrap gap-2 text-[13px]">
            {s.plans.map((p) => <span key={p.label} className="rounded-full border border-hair px-3 py-1">{p.label} {fmt(p.count)}</span>)}
          </div>
          <p className="num mt-3 text-[13px] text-ink-2">نحو <b className="font-bold text-ink">${s.monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b> شهرياً — تقدير من الأسعار قبل حصة آبل والضريبة.</p>
        </>
      )}
    </Card>
  )
}

function Versions({ rows }) {
  const v = versionShares(rows)
  const tones = ['bg-gold', 'bg-gold/55', 'bg-gold/30', 'bg-ink-3/40']
  return (
    <Card title="إصدارات التطبيق على الأجهزة">
      {v.length === 0 ? <p className="text-[13px] text-ink-2">لا أجهزة في هذه الفترة.</p> : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
            {v.map((x, i) => <motion.span key={x.version} className={tones[Math.min(i, tones.length - 1)]} initial={false} animate={{ width: `${x.share}%` }} transition={SETTLE} />)}
          </div>
          <ul className="num mt-3 grid gap-1.5 text-[13px]">
            {v.slice(0, 4).map((x, i) => (
              <li key={x.version} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${tones[Math.min(i, tones.length - 1)]}`} />{x.version === 'unknown' ? 'غير معروف' : x.version}</span>
                <span><b className="font-bold">{x.share}%</b> <span className="text-ink-3">· {fmt(x.devices)}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

export default function NumbersPage() {
  const [days, setDays] = useState(30)
  const now = useMemo(() => new Date(), [])
  const range = useMemo(() => periodRange(days, now), [days, now])
  const [state, setState] = useState({ stats: null, error: null, needsUpdate: false, loading: true })
  const [overview, setOverview] = useState(null)

  useEffect(() => { fetchTemplatesOverview().then(setOverview, () => setOverview([])) }, [])
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fetchStats(range).then(
      (stats) => alive && setState({ stats, error: null, needsUpdate: false, loading: false }),
      (e) => alive && setState((s) => ({ ...s, loading: false, error: e.message, needsUpdate: e instanceof StatsNeedUpdate })),
    )
    return () => { alive = false }
  }, [range])

  const { stats } = state
  const derived = useMemo(() => {
    if (!stats || !overview) return null
    return {
      occasions: byOccasion(stats.templates, overview),
      top: topWithRate(stats.templates, overview, 8),
      idle: idleTemplates(stats.templates, overview, range.from),
    }
  }, [stats, overview, range.from])

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[30px] font-extrabold leading-tight">الأرقام</h1>
        <PeriodSwitch days={days} onChange={setDays} />
      </header>

      {state.needsUpdate ? (
        <section className="rounded-card border border-gold/30 bg-gold/10 p-5">
          <h2 className="text-[17px] font-bold">«الأرقام» تحتاج تحديثاً واحداً لقاعدة البيانات</h2>
          <p className="mt-1 text-[13px] text-ink-2">الملخصات تُحسب في القاعدة لا في المتصفح. شغّل تحديث «الأرقام» من محرر SQL في Supabase مرة واحدة، ثم أعد فتح الصفحة.</p>
        </section>
      ) : state.error && !stats ? (
        <p className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">تعذّر قراءة الأرقام: {state.error}</p>
      ) : !stats ? (
        <div className="grid gap-4">{[0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-card bg-hair" />)}</div>
      ) : (
        <div className={`grid gap-4 transition-opacity duration-200 ${state.loading ? 'opacity-60' : ''}`}>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <MetricPanel stats={stats} range={range} days={days} />
            <BestTime hours={stats.hours} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {derived ? <Occasions rows={derived.occasions} /> : <div className="h-64 animate-pulse rounded-card bg-hair" />}
            {derived ? <Top rows={derived.top} /> : <div className="h-64 animate-pulse rounded-card bg-hair" />}
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {derived ? <Idle rows={derived.idle} days={days} /> : <div className="h-48 animate-pulse rounded-card bg-hair" />}
            <Subscribers rows={stats.subscribers} />
            <Versions rows={stats.versions} />
          </div>
        </div>
      )}
    </div>
  )
}
