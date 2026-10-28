import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  fetchTemplatesOverview, fetchExportSeries, fetchWeekExportIds, fetchTodayDevices,
  fetchActiveSubscribers, fetchStudioDraftCount, fetchFailedPushCount,
} from '../lib/supabase'
import { upcomingSeasons, inboxItems, countdown, countAr, deltaPercent, distinctCount, topTemplates } from '../lib/today'
import { OCCASION_LABEL } from '../lib/occasions'

// «اليوم» (G1 الداش بورد): الموسم القادم وجاهزيته، ثم ما ينتظرك، ثم نبض التطبيق.
// اللوحة تُدار بتقويم المناسبات — المرجعان: Linear Inbox لـ«ينتظرك».

const fmt = (n) => n.toLocaleString('en-US')
const gregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const gregorianShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
const hijriLong = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })

/** يحمّل قيمة واحدة ويحفظ خطأها لنفسه — بطاقة تتعثر لا تُسقط الصفحة */
function useLoad(fn) {
  const [s, set] = useState({ data: undefined, error: null })
  useEffect(() => {
    let alive = true
    fn().then((data) => alive && set({ data, error: null }), (e) => alive && set({ data: null, error: e.message }))
    return () => { alive = false }
  }, [])
  return s
}

const Skeleton = ({ className }) => <div className={`animate-pulse rounded-card bg-hair ${className}`} />

function SeasonCard({ s }) {
  const pct = Math.min(100, Math.round((s.total / s.target) * 100))
  const empty = s.total === 0
  return (
    <article className={`group relative isolate flex min-h-[272px] flex-col justify-end overflow-hidden rounded-card ${empty ? 'border border-dashed border-hair bg-sunken' : 'bg-[#1A1815]'} ${empty ? 'text-ink' : 'text-[#F7F2E8]'}`}>
      {s.cover && (
        <>
          <img src={s.cover} alt="" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-[900ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.035]" />
          <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(10_9_7/.92)] via-[rgb(10_9_7/.6)] to-[rgb(10_9_7/.05)]" />
        </>
      )}
      <div className="grid gap-2.5 p-4">
        <p className="flex items-baseline gap-1.5">
          {s.days > 2 ? (
            <>
              <span className="text-[13px] opacity-85">بعد</span>
              <span className="num text-[40px] font-extrabold leading-none tracking-tight">{s.days}</span>
              <span className="text-[13px] opacity-85">{countdown(s.days).split(' ').slice(2).join(' ')}</span>
            </>
          ) : (
            <span className="text-[40px] font-extrabold leading-none">{countdown(s.days)}</span>
          )}
        </p>
        <div>
          <h3 className="text-[17px] font-bold">{s.label}</h3>
          <p className="num text-[11px] opacity-75">{s.verb} {gregorianShort.format(s.date)}</p>
        </div>
        <div className="grid gap-1.5">
          <div className={`h-1.5 overflow-hidden rounded-full ${empty ? 'bg-hair' : 'bg-white/20'}`}>
            <i className="block h-full rounded-full bg-[#E9C46A]" style={{ width: `${pct}%` }} />
          </div>
          <div className="num flex justify-between gap-2 text-[11px]">
            <span>
              {empty ? <b className="font-bold text-warn">ليس فيه أي قالب</b>
                : s.total >= s.target ? <><b className="font-bold">{countAr(s.total, 'template')}</b> · فوق هدفك {s.target}</>
                : <><b className="font-bold">{s.total}</b> من هدفك {s.target}</>}
            </span>
            {!empty && <span className="opacity-90">فيديو {s.video} · مجاني {s.free}</span>}
          </div>
          {s.lastAddedDays != null && <p className="num text-[11px] opacity-70">آخر إضافة {s.lastAddedDays === 0 ? 'اليوم' : `قبل ${countAr(s.lastAddedDays, 'day')}`}</p>}
        </div>
        <Link
          to={`/templates/occasions/${s.key}`}
          className={`justify-self-start rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold ${empty ? 'border-gold bg-gold text-gold-on' : 'border-white/30 bg-white/10 hover:bg-white/15'}`}
        >
          أضف قوالب
        </Link>
      </div>
    </article>
  )
}

function Covers({ urls, badge, tone }) {
  if (!urls.length) {
    // بلا صور: رقم البند نفسه (الأيام، العدد) بدل مربع فارغ
    return (
      <span className={`num grid h-14 w-14 flex-shrink-0 place-items-center rounded-[12px] text-[20px] font-extrabold ${tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-gold/10 text-gold'}`} aria-hidden>
        {badge ?? ''}
      </span>
    )
  }
  return (
    <span className="relative h-14 w-14 flex-shrink-0" aria-hidden>
      {urls.map((u, i) => (
        <img
          key={u}
          src={u}
          alt=""
          className="absolute top-0 h-[54px] w-10 rounded-lg border-2 border-surface object-cover"
          style={{ insetInlineStart: i * 8, transform: `rotate(${-i * 6}deg)`, zIndex: 3 - i }}
        />
      ))}
    </span>
  )
}

function Inbox({ items }) {
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-labelledby="inbox-h">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="inbox-h" className="text-[17px] font-bold">ينتظرك</h2>
        {items && items.length > 0 && <span className="num text-[13px] text-ink-2"><b className="text-gold">{items.length}</b> {items.length === 1 ? 'بند' : items.length === 2 ? 'بندان' : 'بنود'}</span>}
      </div>
      {!items ? (
        <div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-ink-2">لا شيء ينتظرك الآن.</p>
      ) : (
        <ul className="grid">
          {items.map((it, i) => (
            <li key={it.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 py-3.5 ${i ? 'border-t border-hair' : 'pt-0'}`}>
              <Covers urls={it.covers} badge={it.badge} tone={it.tone} />
              <div className="min-w-0">
                <h3 className={`text-[15px] font-bold leading-snug ${it.tone === 'warn' ? 'text-warn' : ''}`}>{it.title}</h3>
                <p className="text-[13px] leading-normal text-ink-2">{it.detail}</p>
              </div>
              <Link
                to={it.action.to}
                className="grid min-h-10 min-w-[72px] place-items-center whitespace-nowrap rounded-full border border-hair bg-surface px-4 text-[13px] font-semibold hover:border-gold hover:text-gold"
              >
                {it.action.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** خط التصدير اليومي: الأحدث يساراً (اتجاه القراءة)، بنفس المقياس للخط والعلامات */
function ExportChart({ data }) {
  const reduce = useReducedMotion()
  const W = 320, H = 110, top = 10, bot = 22, n = data.length
  const max = Math.max(10, ...data) * 1.15
  const x = (i) => W - (i / (n - 1)) * W
  const y = (v) => top + (1 - v / max) * (H - top - bot)
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const step = Math.pow(10, Math.floor(Math.log10(max / 2)))
  const tick = Math.max(step, Math.floor(max / 2 / step) * step)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full overflow-visible" role="img" aria-label="التصدير اليومي آخر 14 يوماً">
      <line x1="0" x2={W} y1={y(tick)} y2={y(tick)} className="stroke-[rgb(var(--c-hair)/var(--hair-alpha))]" />
      <text x={W} y={y(tick) - 4} textAnchor="end" className="fill-ink-3 text-[10px]">{fmt(tick)}</text>
      <path d={`${line} L${x(n - 1)} ${H - bot} L${x(0)} ${H - bot} Z`} className="fill-gold/10" />
      <motion.path
        d={line}
        className="fill-none stroke-gold"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <circle cx={x(n - 1)} cy={y(data[n - 1])} r="5" className="fill-gold stroke-surface" strokeWidth="3" />
      <text x={W} y={H - 4} textAnchor="end" className="fill-ink-3 text-[10px]">قبل أسبوعين</text>
      <text x="0" y={H - 4} textAnchor="start" className="fill-ink-3 text-[10px]">أمس</text>
    </svg>
  )
}

function Pulse({ series, devices, subscribers }) {
  const s = series.data
  const ready = s !== undefined
  const days = s ? s.slice(0, 14) : null // 14 يوماً كاملة تنتهي أمس؛ الأخير في الجلب هو اليوم الجاري
  const yesterday = s ? s[13] : 0
  const delta = s ? deltaPercent(s[13], s[6]) : null
  const week = s ? s.slice(7, 14).reduce((a, b) => a + b, 0) : 0
  const noData = s && s.every((v) => v === 0)
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-labelledby="pulse-h">
      <h2 id="pulse-h" className="mb-4 text-[17px] font-bold">النبض</h2>
      {!ready ? (
        <Skeleton className="h-40" />
      ) : series.error ? (
        <p className="text-[13px] text-warn">تعذّر قراءة الأرقام: {series.error}</p>
      ) : noData ? (
        <p className="text-[13px] text-ink-2">لا تصدير مسجّل في آخر أسبوعين.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <b className="num text-[40px] font-extrabold leading-none tracking-tight">{fmt(yesterday)}</b>
            <span className="text-[13px] text-ink-2">{yesterday === 1 ? 'قالب صُدّر أمس' : 'قالباً صُدّر أمس'}</span>
            {delta != null && (
              <span className={`num rounded-full px-2 py-0.5 text-[11px] font-bold ${delta >= 0 ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
                {delta >= 0 ? '+' : ''}{delta}% عن نفس اليوم الأسبوع الماضي
              </span>
            )}
          </div>
          <ExportChart data={days} />
        </>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-hair pt-4">
        <Mini value={devices.data === undefined ? null : devices.error ? '—' : fmt(distinctCount(devices.data, 'device_id'))} label="جهازاً فتح التطبيق اليوم" />
        <Mini value={!ready ? null : series.error ? '—' : fmt(week)} label="تصدير آخر 7 أيام" />
        <Mini
          value={subscribers.data === undefined ? null : subscribers.error ? '—' : fmt(subscribers.data)}
          label={subscribers.data === 0 ? 'مشتركو المميز · يبدأ مع 2.0' : 'مشتركو المميز'}
        />
      </div>
    </section>
  )
}

function Mini({ value, label }) {
  return (
    <div className="grid gap-0.5">
      {value == null ? <Skeleton className="h-6 w-12" /> : <b className="num text-[22px] font-extrabold leading-tight">{value}</b>}
      <span className="text-[11px] text-ink-2">{label}</span>
    </div>
  )
}

function TopTemplates({ rows }) {
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-labelledby="top-h">
      <h2 id="top-h" className="mb-3 text-[17px] font-bold">الأكثر تصديراً هذا الأسبوع</h2>
      {rows === undefined ? (
        <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows === null ? (
        <p className="text-[13px] text-warn">تعذّر قراءة التصدير.</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-ink-2">لم يُصدَّر أي قالب هذا الأسبوع.</p>
      ) : (
        <ol className="grid">
          {rows.map((r, i) => (
            <li key={r.id} className={`grid grid-cols-[20px_40px_minmax(0,1fr)] items-center gap-3 py-2 ${i ? 'border-t border-hair' : ''}`}>
              <span className="num text-[13px] font-bold text-ink-3">{i + 1}</span>
              <span className="h-[54px] w-10 overflow-hidden rounded-lg bg-sunken">
                {r.cover && <img src={r.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </span>
              <span className="grid min-w-0 gap-1.5">
                <span className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate text-ink-2">{OCCASION_LABEL[r.category] ?? r.category}</span>
                  <b className="num font-bold">{fmt(r.count)}</b>
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-sunken">
                  <i className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((r.count / rows[0].count) * 100)}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function TodayPage() {
  const now = useMemo(() => new Date(), [])
  const overview = useLoad(fetchTemplatesOverview)
  const series = useLoad(() => fetchExportSeries(15, now))
  const weekIds = useLoad(() => fetchWeekExportIds(now))
  const devices = useLoad(() => fetchTodayDevices(now))
  const subscribers = useLoad(fetchActiveSubscribers)
  const drafts = useLoad(fetchStudioDraftCount)
  const failed = useLoad(() => fetchFailedPushCount(now))

  // الغلاف يعتمد على التصدير: تنتظر البطاقات الجوابين معاً فلا تتبدل صورتها أمام العين
  const seasons = useMemo(
    () => (overview.data && weekIds.data !== undefined ? upcomingSeasons(overview.data, now, weekIds.data ?? []) : null),
    [overview.data, now, weekIds.data],
  )
  const items = useMemo(() => {
    if (!overview.data || !seasons || drafts.data === undefined || failed.data === undefined) return null
    return inboxItems({ overview: overview.data, seasons, studioDrafts: drafts.data ?? 0, failedPush: failed.data ?? 0 })
  }, [overview.data, seasons, drafts.data, failed.data])
  const top = weekIds.data === undefined || !overview.data ? undefined : weekIds.error ? null : topTemplates(weekIds.data, overview.data, 5)

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="num text-[13px] text-ink-2">{gregorian.format(now)} · {hijriLong.format(now)}</p>
          <h1 className="text-[30px] font-extrabold leading-tight">اليوم</h1>
        </div>
        <Link to={`/templates/occasions/${seasons?.[0]?.key ?? 'ramadan'}`} className="min-h-11 content-center rounded-xl bg-gold px-4 text-[13px] font-semibold text-gold-on hover:brightness-105">
          قالب جديد
        </Link>
      </header>

      {overview.error && <p className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">تعذّر تحميل القوالب: {overview.error}</p>}

      <section aria-labelledby="seasons-h" className="grid gap-3">
        <h2 id="seasons-h" className="text-[17px] font-bold">المواسم القادمة</h2>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
          {seasons
            ? seasons.map((s) => <div key={s.key} className="w-[78%] flex-shrink-0 snap-start md:w-auto"><SeasonCard s={s} /></div>)
            : [0, 1, 2].map((i) => <Skeleton key={i} className="h-[272px] w-[78%] flex-shrink-0 md:w-auto" />)}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Inbox items={items} />
        <div className="grid gap-4">
          <Pulse series={series} devices={devices} subscribers={subscribers} />
          <TopTemplates rows={top} />
        </div>
      </div>
    </div>
  )
}
