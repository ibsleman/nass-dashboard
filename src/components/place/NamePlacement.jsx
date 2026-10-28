import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { nameSpot, nameLayout, hasSpot } from '../../lib/nameSpot'
import { analyzeTemplate, nameMeasurer } from '../../lib/templateMedia'

// «ضع الاسم كما سيراه الناس» (G1 الداش بورد، اللقطة البطلة).
// ضغطة على القالب = يستقر الاسم هناك ويُحفظ وحده ثم يأتي التالي (مرجع: التقدّم التلقائي في Lightroom).
// الاسم يُرسم كما يرسمه المحرر في التطبيق: نفس التخمين ونفس الصندوق والحبر والخط.

// نفس نابض «الاسم يستقر» في التطبيق: response 0.35، تخميد 0.8 ⇒ k=(2π/0.35)², c=2·0.8·√k
const SETTLE = { type: 'spring', stiffness: 322, damping: 28.7, mass: 1 }
// تبدّل القالب: response 0.42، تخميد 0.92 — حركة كبيرة بلا ارتداد
const SLIDE = { type: 'spring', stiffness: 224, damping: 27.5, mass: 1 }
const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }
const INSTANT = { duration: 0 }
const NAMES = ['علي', 'محمد', 'عبدالرحمن', 'أم عبدالله الشمري']
const TYPE_LABEL = { image: 'صورة', imageWithPhoto: 'مع صورة شخصية', video: 'فيديو' }
const ADVANCE_MS = 720
const pct = (v) => `${Math.round(v * 100)}%`

const rowPoint = (t) => (hasSpot(t) ? { x: t.name_position_x, y: t.name_position_y } : null)
// نافذة صورة المستخدم: ما خلف الاسم هناك مجهول (صورته هو) فلا يُقرأ ولا يُضبط فوقه
const inWindow = (m, p) => !!(m?.window && p.x >= m.window.x && p.x <= m.window.x + m.window.width && p.y >= m.window.y && p.y <= m.window.y + m.window.height)
const SHAKE = { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }
const guessPoint = (g) => (g.box ? { x: g.box.x + g.box.width / 2, y: g.box.y + g.box.height / 2 } : { x: g.centerX, y: g.centerY })

/** مستطيل الصورة داخل المسرح (احتواء) */
function fitRect(stage, m) {
  if (!stage.w || !m) return null
  const k = Math.min(stage.w / m.w, stage.h / m.h)
  const w = m.w * k, h = m.h * k
  return { k, w, h, x: (stage.w - w) / 2, y: (stage.h - h) / 2 }
}

function NameText({ layout, rect, name, ghost = false, guessing = false, transition, lift = null, reduce = false }) {
  const k = rect.k
  return (
    <motion.div
      aria-hidden={ghost}
      className="font-name absolute whitespace-nowrap pointer-events-none"
      initial={false}
      animate={{ left: rect.x + layout.cx * k, top: rect.y + layout.cy * k, fontSize: layout.fontSize * k, opacity: ghost ? 0.45 : guessing ? 0.62 : 1 }}
      transition={transition}
      style={{
        x: '-50%', y: '-50%',
        color: layout.ink,
        lineHeight: 1.25,
        textShadow: layout.shadow ? `0 ${3 * k}px ${14 * k}px rgba(0,0,0,.45)` : 'none',
      }}
    >
      {/* يُرفع الاسم قليلاً وهو يطير ثم يحطّ — وزن جسدي للوضع (مادة الجسدية) */}
      <motion.span
        key={lift ?? 'rest'}
        className="block"
        initial={{ scale: 1 }}
        animate={lift && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.42, times: [0, 0.35, 1], ease: [0.2, 0.8, 0.2, 1] }}
      >
        {name}
      </motion.span>
    </motion.div>
  )
}

/** «حُفظ» تحت الاسم حيث وقعت الضغطة — التأكيد في مكان الفعل لا في لوحة جانبية */
function SavedMark({ layout, rect, reduce }) {
  const k = rect.k
  return (
    <div
      className="absolute -translate-x-1/2 pointer-events-none"
      style={{ left: rect.x + layout.cx * k, top: rect.y + (layout.cy + layout.height / 2) * k + 4 }}
    >
      <motion.span
        className="block whitespace-nowrap rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-gold-on shadow-card"
        initial={reduce ? false : { opacity: 0, y: -6, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? INSTANT : { ...POP, delay: 0.26 }}
      >
        حُفظ
      </motion.span>
    </div>
  )
}

function Slide({ template, media, point, name, measurer, stage, dir, reduce, justPlaced }) {
  const rect = fitRect(stage, media?.data)
  const m = media?.data
  const spot = m ? (point ? nameSpot(m.grid, m.window, point) : m.guess) : null
  const layout = spot && measurer ? nameLayout(spot, m.w, m.h, name, measurer.measure, measurer.lineRatio) : null
  return (
    <motion.div
      className="absolute inset-0"
      custom={dir}
      variants={{
        enter: (d) => ({ x: d > 0 ? '-104%' : '104%' }),
        center: { x: '0%' },
        exit: (d) => ({ x: d > 0 ? '104%' : '-104%' }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={reduce ? INSTANT : SLIDE}
    >
      {!m && media?.status !== 'error' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-full aspect-[9/16] max-w-full rounded-[6px] bg-hair animate-pulse" />
        </div>
      )}
      {media?.status === 'error' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ink-2 px-6 text-center">
          {media.error} — تخطَّه وعُد إليه لاحقاً.
        </div>
      )}
      {m && rect && (
        <>
          {m.window && (
            // مكان صورة المستخدم كما يراه في المحرر قبل أن يختار صورته
            <div
              className="absolute grid place-items-center text-[11px] font-semibold"
              style={{
                left: rect.x + m.window.x * rect.w, top: rect.y + m.window.y * rect.h,
                width: m.window.width * rect.w, height: m.window.height * rect.h,
                background: 'linear-gradient(#29261F, #1A1715)', color: 'rgba(243,238,228,.7)',
              }}
            >
              صورة المستخدم
            </div>
          )}
          <img
            src={m.src}
            crossOrigin="anonymous"
            alt={`قالب ${template.category}`}
            draggable={false}
            className="absolute select-none rounded-[6px] shadow-card"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
          {layout && !point && (
            <div
              className="absolute pointer-events-none rounded-[10px]"
              style={{
                left: rect.x + layout.cx * rect.k, top: rect.y + layout.cy * rect.k,
                width: layout.width * rect.k, height: layout.height * rect.k,
                transform: 'translate(-50%,-50%)',
                border: '1.5px dashed rgba(255,255,255,.85)', boxShadow: '0 0 0 1px rgba(0,0,0,.25)',
              }}
            >
              <span className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-[#F7F2E8]">
                تخمين التطبيق
              </span>
            </div>
          )}
          {layout && <NameText layout={layout} rect={rect} name={name} guessing={!point} transition={reduce ? INSTANT : SETTLE} lift={justPlaced} reduce={reduce} />}
          {layout && point && justPlaced && <SavedMark key={justPlaced} layout={layout} rect={rect} reduce={reduce} />}
        </>
      )}
    </motion.div>
  )
}

export default function NamePlacement({ templates, categoryLabel = {}, onSave, onToast }) {
  const reduce = useReducedMotion()
  const [queue] = useState(templates)
  const [idx, setIdx] = useState(() => Math.max(0, templates.findIndex((t) => !hasSpot(t))))
  const [dir, setDir] = useState(1)
  const [overrides, setOverrides] = useState({})
  const [history, setHistory] = useState([])
  const [name, setName] = useState('محمد')
  const [busy, setBusy] = useState(false)
  const [lastPlaced, setLastPlaced] = useState(null)
  const [measurer, setMeasurer] = useState(null)
  const [media, setMedia] = useState({})
  const [hover, setHover] = useState(null)
  const [refused, setRefused] = useState(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const stageRef = useRef(null)
  const timers = useRef([])

  useEffect(() => { nameMeasurer().then(setMeasurer) }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    // قياس فوري أولاً: ResizeObserver لا يعمل في صفحة بالخلفية فيبقى المسرح بلا مقاس
    const measure = () => { const r = el.getBoundingClientRect(); setStage((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height })) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  // الحالي واثنان بعده وواحد قبله: صور القوالب ثقيلة (حتى 1.3 م.ب) فتُجهَّز قبل الوصول إليها
  useEffect(() => {
    for (const i of [idx, idx + 1, idx + 2, idx - 1]) {
      const t = queue[i]
      if (!t || media[t.id]) continue
      setMedia((s) => ({ ...s, [t.id]: { status: 'loading' } }))
      analyzeTemplate(t).then(
        (data) => setMedia((s) => ({ ...s, [t.id]: { status: 'ready', data } })),
        (err) => setMedia((s) => ({ ...s, [t.id]: { status: 'error', error: err.message } })),
      )
    }
  }, [idx, queue, media])

  const pointOf = useCallback((t) => (t.id in overrides ? overrides[t.id] : rowPoint(t)), [overrides])
  const placedCount = queue.reduce((n, t) => n + (pointOf(t) ? 1 : 0), 0)
  const t = queue[idx]
  const m = t && media[t.id]?.data
  const point = t ? pointOf(t) : null
  const rect = fitRect(stage, m)
  const spot = m ? (point ? nameSpot(m.grid, m.window, point) : m.guess) : null

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }

  const go = useCallback((i, d) => {
    if (i < 0 || i >= queue.length) return
    setHover(null)
    setDir(d)
    setIdx(i)
    setBusy(true)
    later(() => setBusy(false), reduce ? 0 : 380)
  }, [queue.length, reduce])

  const nextIndex = (from, ov = overrides) => {
    if (from + 1 < queue.length) return from + 1
    const first = queue.findIndex((x) => !(x.id in ov ? ov[x.id] : rowPoint(x)))
    return first === -1 ? from : first
  }

  const save = (tpl, before, after) => {
    Promise.resolve(onSave(tpl, after)).catch((err) => {
      setOverrides((o) => ({ ...o, [tpl.id]: before }))
      onToast?.(`تعذّر حفظ مكان الاسم: ${err.message}`, 'error')
    })
  }

  const place = (p, { advance = true } = {}) => {
    if (busy || !m) return
    const before = pointOf(t)
    const ov = { ...overrides, [t.id]: p }
    setBusy(true)
    setHover(null)
    setOverrides(ov)
    setHistory((h) => [...h, { id: t.id, idx, before, after: p }])
    if (p) setLastPlaced((l) => ({ id: t.id, n: (l?.n ?? 0) + 1 }))
    save(t, before, p)
    if (!advance) { later(() => setBusy(false), 200); return }
    const to = nextIndex(idx, ov)
    later(() => (to === idx ? setBusy(false) : go(to, 1)), reduce ? 200 : ADVANCE_MS)
  }

  const keepGuess = () => m && place(guessPoint(m.guess))
  const clearSpot = () => point && place(null, { advance: false })
  const skip = () => !busy && go(nextIndex(idx), 1)
  const prev = () => !busy && idx > 0 && go(idx - 1, -1)
  const undo = () => {
    const last = history[history.length - 1]
    if (busy || !last) return
    const tpl = queue.find((x) => x.id === last.id)
    setHistory((h) => h.slice(0, -1))
    setOverrides((o) => ({ ...o, [last.id]: last.before }))
    save(tpl, last.after, last.before)
    if (last.idx !== idx) go(last.idx, last.idx > idx ? 1 : -1)
  }

  const normalized = (e) => {
    const box = stageRef.current.getBoundingClientRect()
    if (!rect) return null
    const x = (e.clientX - box.left - rect.x) / rect.w, y = (e.clientY - box.top - rect.y) / rect.h
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null
  }
  const onMove = (e) => setHover(e.pointerType === 'mouse' && !busy ? normalized(e) : null)
  const onClick = (e) => {
    const p = normalized(e)
    if (!p) return
    if (inWindow(m, p)) { setRefused({ n: (refused?.n ?? 0) + 1, p }); return }
    place(p)
  }

  // لوحة المفاتيح: Enter أبقِ التخمين · ← التالي · → السابق · Z تراجع (ظ على لوحة عربية)
  const keys = useRef({})
  keys.current = { keepGuess, skip, prev, undo }
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = keys.current
      if (e.key === 'Enter' && !document.activeElement?.closest('button')) { e.preventDefault(); k.keepGuess() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); k.skip() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); k.prev() }
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'ظ') { e.preventDefault(); k.undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!t) return null
  const overWindow = hover && inWindow(m, hover)
  const ghostLayout = hover && !overWindow && m && measurer && !busy
    ? nameLayout(nameSpot(m.grid, m.window, hover), m.w, m.h, name, measurer.measure, measurer.lineRatio)
    : null
  const shown = point ?? (m ? guessPoint(m.guess) : null)
  const state = point ? (spot?.box ? 'محفوظ · على حبة المصمم' : 'محفوظ') : m ? (m.guess.box ? 'تخمين التطبيق · حبة المصمم' : 'تخمين التطبيق · أهدأ مكان') : 'يُحمَّل…'
  const allDone = placedCount === queue.length
  const upcoming = [queue[idx + 1], queue[idx + 2]].filter(Boolean)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
      <div className="grid gap-4 min-w-0">
        <div
          ref={stageRef}
          role="application"
          aria-label="اضغط على القالب حيث يجب أن يكون الاسم"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onClick={onClick}
          className="relative h-[clamp(480px,calc(100vh-180px),880px)] overflow-hidden select-none touch-manipulation"
          style={{ cursor: overWindow ? 'not-allowed' : hover ? 'crosshair' : 'default' }}
        >
          {/* بلا initial={false}: سياقه يصل لكل ما يُركَّب داخل القالب الأول فيُطفئ «حُفظ» ورفعة الاسم عليه */}
          <AnimatePresence custom={dir}>
            <Slide
              key={t.id}
              template={t}
              media={media[t.id]}
              point={point}
              name={name}
              measurer={measurer}
              stage={stage}
              dir={dir}
              reduce={reduce}
              justPlaced={lastPlaced?.id === t.id ? lastPlaced.n : null}
            />
          </AnimatePresence>
          {ghostLayout && rect && <NameText layout={ghostLayout} rect={rect} name={name} ghost transition={INSTANT} />}
          {refused && rect && (
            // الرفض يُعلن نفسه حيث ضغط المشرف: هزّة قصيرة وسبب في سطر
            <div
              key={refused.n}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: rect.x + refused.p.x * rect.w, top: rect.y + refused.p.y * rect.h }}
            >
              <motion.span
                className="block whitespace-nowrap rounded-full bg-black/75 px-3 py-1 text-[12px] font-semibold text-[#F7F2E8]"
                initial={{ x: 0 }}
                animate={reduce ? { x: 0 } : { x: [0, -7, 7, -4, 4, 0] }}
                transition={reduce ? INSTANT : SHAKE}
                onAnimationComplete={() => later(() => setRefused((r) => (r && r.n === refused.n ? null : r)), 700)}
              >
                هنا تظهر صورة المستخدم
              </motion.span>
            </div>
          )}
        </div>
      </div>

      <aside className="grid gap-5 content-start">
        <div className="relative">
          <div className="flex items-baseline gap-2">
            <span className="num text-[56px] font-extrabold leading-none tracking-tight">{placedCount}</span>
            <span className="text-[13px] text-ink-2 num">من {queue.length} قالباً مضبوط</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-sunken overflow-hidden">
            <motion.i
              className="block h-full rounded-full bg-gold"
              initial={false}
              animate={{ width: `${(placedCount / queue.length) * 100}%` }}
              transition={reduce ? INSTANT : POP}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-full border border-hair px-3 py-1">{categoryLabel[t.category] ?? t.category}</span>
          <span className="rounded-full border border-hair px-3 py-1 text-ink-2">{TYPE_LABEL[t.type] ?? t.type}</span>
          <span className="rounded-full border border-hair px-3 py-1 text-ink-2">{t.is_premium ? 'مدفوع' : 'مجاني'}</span>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold">جرّبه بأسماء مختلفة الطول</p>
          <div className="flex flex-wrap gap-2">
            {NAMES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === name}
                onClick={() => setName(n)}
                className={`min-h-9 rounded-full border px-3.5 text-[13px] ${n === name ? 'border-gold bg-gold/10 font-bold text-gold' : 'border-hair bg-surface'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[13px] text-ink-2 num">
          {shown ? <>مكان الاسم: <b className="font-semibold text-ink">أفقياً {pct(shown.x)} · عمودياً {pct(shown.y)}</b> ({state})</> : state}
        </p>

        <div className="flex flex-wrap gap-2">
          {!point && (
            <button type="button" onClick={keepGuess} disabled={!m || busy} className="min-h-11 rounded-xl bg-gold px-4 text-[13px] font-semibold text-gold-on disabled:opacity-50">
              أبقِ التخمين
            </button>
          )}
          {point && (
            <button type="button" onClick={clearSpot} disabled={busy} className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold hover:border-gold disabled:opacity-50">
              أرجعه للتخمين
            </button>
          )}
          <button type="button" onClick={undo} disabled={!history.length || busy} className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold hover:border-gold disabled:opacity-40">
            تراجع
          </button>
          <button type="button" onClick={skip} disabled={busy} className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold hover:border-gold disabled:opacity-40">
            تخطَّ
          </button>
        </div>

        {allDone && <p className="rounded-card bg-gold/10 px-4 py-3 text-[13px] font-semibold text-gold">كل القوالب مضبوطة. يمكنك تعديل أي قالب بالضغط عليه مرة أخرى.</p>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] text-ink-2">
          <dt><Kbd>Enter</Kbd></dt><dd>أبقِ التخمين</dd>
          <dt><Kbd>←</Kbd></dt><dd>التالي بلا حفظ</dd>
          <dt><Kbd>→</Kbd></dt><dd>السابق</dd>
          <dt><Kbd>Z</Kbd></dt><dd>تراجع عن آخر وضع</dd>
        </dl>

        {upcoming.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-ink-3">التالي</p>
            <div className="flex gap-2">
              {upcoming.map((u) => {
                const um = media[u.id]?.data
                return (
                  <div key={u.id} className="h-[72px] w-[54px] overflow-hidden rounded-[10px] bg-sunken">
                    {um && <img src={um.src} crossOrigin="anonymous" alt="" className="h-full w-full object-cover" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}


function Kbd({ children }) {
  return <kbd className="rounded-md border border-hair border-b-2 bg-surface px-1.5 text-[11px] text-ink">{children}</kbd>
}
