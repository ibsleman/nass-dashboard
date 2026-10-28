import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'

// الحذف يُدفع ثمنه جسدياً (مادة الجسدية؛ مرجع Opal، ونفس زر «المسح» في إعدادات التطبيق):
// ضغطة مطوّلة يمتلئ معها الزر من أول السطر، والإفلات قبل الاكتمال يعيده فارغاً بلا أثر.
// الأرقام منقولة من HoldToClearButton في التطبيق: 1.4ث، منحنى (0.35, 0.05, 0.45, 1)، رجوع بنابض اللمس.

export const HOLD_SECONDS = 1.4
const HOLD_EASE = [0.35, 0.05, 0.45, 1]
// DS.Motion.tap: response 0.30، تخميد 0.80
const TAP = { type: 'spring', stiffness: 438.6, damping: 33.5, mass: 1 }
const SLOP = 12
// ضغطة عابرة (لا إمساك) تُفهم نقرة: يُقال لصاحبها كيف يحذف بدل أن لا يحدث شيء
const TAP_MS = 300
const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }

export default function HoldButton({ label, onConfirm, disabled = false, compact = false, className = '' }) {
  const ref = useRef(null)
  const progress = useMotionValue(0)
  const width = useTransform(progress, (p) => `${p * 100}%`)
  const anim = useRef(null)
  const [state, setState] = useState('idle') // idle | holding | working
  const [hint, setHint] = useState(0)
  const pressedAt = useRef(0)
  const hintTimer = useRef(null)
  const stateRef = useRef('idle')
  const set = (s) => { stateRef.current = s; setState(s) }

  useEffect(() => () => { anim.current?.stop(); clearTimeout(hintTimer.current) }, [])

  const begin = () => {
    if (disabled || stateRef.current !== 'idle') return
    set('holding')
    pressedAt.current = performance.now()
    // مؤشر تقدّم لا زينة: يبقى مع «تقليل الحركة» — بدونه يمتلئ فوراً فيُظن أن الحذف وقع
    anim.current = animate(progress, 1, {
      duration: HOLD_SECONDS * (1 - progress.get()),
      ease: HOLD_EASE,
      onComplete: fire,
    })
  }

  const release = () => {
    if (stateRef.current !== 'holding') return
    anim.current?.stop()
    set('idle')
    anim.current = animate(progress, 0, TAP)
    if (performance.now() - pressedAt.current < TAP_MS) {
      setHint((n) => n + 1)
      clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(0), 1400)
    }
  }

  async function fire() {
    if (stateRef.current !== 'holding') return
    set('working')
    try {
      await onConfirm()
    } finally {
      if (ref.current) {
        set('idle')
        progress.set(0)
      }
    }
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    ref.current.setPointerCapture?.(e.pointerId)
    begin()
  }
  const onPointerMove = (e) => {
    if (stateRef.current !== 'holding') return
    const r = ref.current.getBoundingClientRect()
    const inside = e.clientX >= r.left - SLOP && e.clientX <= r.right + SLOP && e.clientY >= r.top - SLOP && e.clientY <= r.bottom + SLOP
    if (!inside) release()
  }
  const onKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin() }
  }
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release() }
  }

  return (
    // الغلاف يحمل موضع الزر في الشبكة، والفقاعة خارج الزر كي لا يقصّها
    <span className={`relative grid ${className}`}>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={`${label} — اضغط مطوّلاً`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative isolate w-full select-none overflow-hidden border border-hair bg-surface font-semibold text-warn touch-none disabled:opacity-45 ${
          compact ? 'min-h-9 rounded-[10px] px-3 text-[12px]' : 'min-h-[52px] rounded-field px-4 text-[15px]'
        }`}
      >
        {/* الامتلاء يبدأ من أول السطر العربي (يمين الزر) */}
        <motion.span aria-hidden className="absolute inset-y-0 start-0 -z-10 bg-warn/[0.14]" style={{ width }} />
        <span className="relative">{state === 'working' ? 'يُحذف…' : label}</span>
      </button>
      <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 -translate-x-1/2">
        <AnimatePresence>
          {hint > 0 && (
            <motion.span
              key={hint}
              role="status"
              className="block whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-bg shadow-card"
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4 }}
              transition={POP}
            >
              اضغط مطوّلاً للحذف
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  )
}
