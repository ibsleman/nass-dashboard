import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, Reorder, motion, useDragControls } from 'motion/react'
import { FIRST_SCREEN, moveKey, orderPatch, seasonNudge } from '../../lib/categoryOrder'
import { OCCASION_LABEL } from '../../lib/occasions'
import { countdown } from '../../lib/today'

// اللقطة البطلة في ترتيب المناسبات: تسحب البطاقة نفسها في نسخة من شريط الرئيسية (بطاقة 84×112 بنسبتها،
// صورة التطبيق الحقيقية، الاسم على ظل سفلي). الإطار الذهبي ثابت فوق أول أربع — ما يراه الناس دون تمرير —
// فتدخل البطاقات إليه وتخرج منه وأنت تسحب. الحفظ تلقائي بعد الإفلات، بلا زر حفظ.

const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }
const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }
// مقاس التطبيق نفسه بالنقاط (PhotoCategoryCard): 84×112، فراغ 12، زاوية 20
const CARD_W = 84
const CARD_H = 112
const GAP = 12
const cover = (key) => `/covers/${key}.jpg`

function Card({ k, index, total, onMove, onDrop }) {
  const label = OCCASION_LABEL[k]
  const onKeyDown = (e) => {
    // تحت الاتجاه العربي: السهم الأيمن نحو البداية
    if (e.key === 'ArrowRight') { e.preventDefault(); onMove(k, -1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onMove(k, 1) }
  }
  return (
    <Reorder.Item
      value={k}
      as="li"
      dir="rtl"
      tabIndex={0}
      aria-label={`${label}، الترتيب ${index + 1} من ${total}. الأسهم تنقله`}
      onKeyDown={onKeyDown}
      onDragEnd={onDrop}
      transition={SETTLE}
      whileDrag={{ scale: 1.07, zIndex: 10, boxShadow: '0 22px 40px -18px rgb(0 0 0 / 0.65)' }}
      className="relative shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-[20px] bg-black active:cursor-grabbing"
      style={{ width: CARD_W, height: CARD_H }}
    >
      <img src={cover(k)} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-50% to-black/75" />
      <span className="pointer-events-none absolute bottom-2 right-2 left-2 truncate text-[12.5px] font-semibold text-white">{label}</span>
    </Reorder.Item>
  )
}

/** سطح المكتب: الشريط أفقياً كما في التطبيق. Reorder يفترض أن الفهرس يزيد مع x، فيُعرض الشريط LTR بترتيب معكوس */
function Rail({ keys, setKeys, onMove, onDrop }) {
  const reversed = [...keys].reverse()
  const width = keys.length * CARD_W + (keys.length - 1) * GAP
  const firstW = FIRST_SCREEN * CARD_W + (FIRST_SCREEN - 1) * GAP
  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      {/* العنصر LTR فالهوامش المنطقية تنعكس — يُلصق باليمين بهامش فيزيائي */}
      <div className="relative pt-9" style={{ width, marginLeft: 'auto' }} dir="ltr">
        {/* الإطار ثابت في مكانه: أول أربع من اليمين */}
        <div aria-hidden className="pointer-events-none absolute right-0 top-0" style={{ width: firstW }}>
          <p dir="rtl" className="text-[12px] font-semibold text-gold">أول ما يراه الناس دون تمرير</p>
          <span className="mt-1 block h-[5px] rounded-t-full border-x-2 border-t-2 border-gold/70" />
        </div>
        <Reorder.Group as="ol" axis="x" values={reversed} onReorder={(r) => setKeys([...r].reverse())} className="flex" style={{ gap: GAP }}>
          {reversed.map((k) => (
            <Card key={k} k={k} index={keys.indexOf(k)} total={keys.length} onMove={onMove} onDrop={onDrop} />
          ))}
        </Reorder.Group>
        <ol aria-hidden className="mt-2 flex" style={{ gap: GAP }}>
          {reversed.map((k, i) => (
            <li key={i} className={`num text-center text-[12px] ${keys.length - i <= FIRST_SCREEN ? 'font-semibold text-gold' : 'text-ink-3'}`} style={{ width: CARD_W }}>
              {keys.length - i}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Row({ k, index, onDrop }) {
  const controls = useDragControls()
  const first = index < FIRST_SCREEN
  return (
    <Reorder.Item value={k} as="li" dragListener={false} dragControls={controls} onDragEnd={onDrop} transition={SETTLE}
      whileDrag={{ scale: 1.03, zIndex: 10, boxShadow: '0 16px 30px -16px rgb(0 0 0 / 0.5)' }}
      className={`flex items-center gap-3 rounded-[16px] border bg-surface p-2 ${first ? 'border-gold/45' : 'border-hair'}`}>
      <span className={`num w-6 text-center text-[13px] ${first ? 'font-bold text-gold' : 'text-ink-3'}`}>{index + 1}</span>
      <img src={cover(k)} alt="" draggable={false} className="h-[56px] w-[42px] rounded-[10px] object-cover" />
      <span className="flex-1 text-[15px] font-semibold">{OCCASION_LABEL[k]}</span>
      <button type="button" aria-label={`اسحب ${OCCASION_LABEL[k]}`} onPointerDown={(e) => controls.start(e)}
        className="grid h-11 w-11 touch-none cursor-grab place-items-center rounded-[12px] text-ink-3 hover:text-ink">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
      </button>
    </Reorder.Item>
  )
}

/** الجوال: قائمة عمودية تُسحب من مقبضها فيبقى التمرير حراً */
function List({ keys, setKeys, onDrop }) {
  return (
    <Reorder.Group as="ol" axis="y" values={keys} onReorder={setKeys} className="grid gap-2">
      {keys.map((k, i) => <Row key={k} k={k} index={i} onDrop={onDrop} />)}
    </Reorder.Group>
  )
}

/**
 * لوحة الترتيب — واجهة خالصة. rows صفوف القاعدة، onSave(patch) يحفظ [{id, display_order}].
 * seasons للاقتراح (اختياري).
 */
export default function CategoryOrderBoard({ rows, initialKeys, onSave, seasons = [] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [saved, setSaved] = useState(0)
  const [error, setError] = useState(null)
  const base = useRef(rows)
  const keysRef = useRef(keys)
  keysRef.current = keys
  const timer = useRef(null)
  const [wide, setWide] = useState(() => matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const m = matchMedia('(min-width: 768px)')
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (next = keysRef.current) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const patch = orderPatch(base.current, next)
      if (!patch.length) return
      try {
        await onSave(patch)
        const nums = new Map(patch.map((p) => [p.id, p.display_order]))
        base.current = base.current.map((r) => (nums.has(r.id) ? { ...r, display_order: nums.get(r.id) } : r))
        setError(null)
        setSaved((n) => n + 1)
      } catch (e) {
        setError(e.message)
      }
    }, 450)
  }

  const move = (k, delta) => {
    const next = moveKey(keysRef.current, k, delta)
    if (next === keysRef.current) return
    setKeys(next)
    commit(next)
    // التركيز يتبع البطاقة بعد أن ينقلها React
    requestAnimationFrame(() => document.querySelector(`[aria-label^="${OCCASION_LABEL[k]}،"]`)?.focus())
  }

  // الاقتراح لا يختفي بعد قبوله: يصير تأكيداً في مكانه، فلا يقفز الشريط وبطاقاته تطير
  const [nudge, setNudge] = useState(() => seasonNudge(seasons, initialKeys))
  const [nudgeDone, setNudgeDone] = useState(false)
  const bringFront = () => {
    const next = [nudge.key, ...keys.filter((k) => k !== nudge.key)]
    setKeys(next)
    setNudgeDone(true)
    commit(next)
  }
  useEffect(() => {
    if (!nudgeDone) setNudge(seasonNudge(seasons, keys))
  }, [keys, seasons, nudgeDone])

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-4">
        <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[13px] text-ink-2">{wide ? 'اسحب أي بطاقة إلى مكانها، أو اختر واحدة واستعمل الأسهم.' : 'اسحب من المقبض. الأربع المذهّبة يراها الناس دون تمرير.'} يُحفظ وحده.</p>
          <AnimatePresence mode="wait">
            {saved > 0 && !error && (
              <motion.span key={saved} className="text-[12px] font-semibold text-ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={POP}>
                حُفظ. يصل الأجهزة عند فتح التطبيق
              </motion.span>
            )}
          </AnimatePresence>
          {error && <span className="text-[12px] font-semibold text-warn">لم يُحفظ: {error}</span>}
        </div>

        {nudge && (
          <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 rounded-card border border-gold/30 bg-gold/[0.07] px-4 py-3">
            <AnimatePresence mode="wait" initial={false}>
              {nudgeDone ? (
                <motion.p key="done" className="text-[14px] font-semibold" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={POP}>
                  {nudge.label} صار الأول. <span className="font-normal text-ink-2">أقرب موسم يراه الناس أولاً.</span>
                </motion.p>
              ) : (
                <motion.div key="ask" className="flex flex-1 flex-wrap items-center justify-between gap-3" exit={{ opacity: 0, y: -6, transition: { duration: 0.11 } }}>
                  <p className="text-[14px]"><span className="font-semibold">{nudge.label} {countdown(nudge.days)}</span> <span className="text-ink-2">وهو في المركز {nudge.position}، لا يراه الناس دون تمرير.</span></p>
                  <button type="button" onClick={bringFront} className="min-h-10 rounded-full border border-gold/50 px-4 text-[13px] font-semibold text-gold hover:bg-gold/10">قدّمه للأول</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {wide ? <Rail keys={keys} setKeys={setKeys} onMove={move} onDrop={() => commit()} /> : <List keys={keys} setKeys={setKeys} onDrop={() => commit()} />}
      </div>
    </MotionConfig>
  )
}
