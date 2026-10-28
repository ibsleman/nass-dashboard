import { motion, useReducedMotion } from 'motion/react'

// خط يومي بالمقياس نفسه للخط والعلامات. الأحدث يساراً (نهاية السطر العربي).
// تبديل المقياس بالعدد نفسه من الأيام يُحوِّل الخط نفسه (التحوّل بدل الاستبدال)؛ تغيير الفترة يرسمه من جديد.

// DS.Motion.settle: response 0.40، تخميد 0.85
const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }

const niceTick = (max) => {
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(1, max / 2))))
  return Math.max(step, Math.floor(max / 2 / step) * step)
}

export default function LineChart({ data, startLabel, endLabel, format = (v) => v.toLocaleString('en-US'), drawKey, height = 140, ariaLabel }) {
  const reduce = useReducedMotion()
  const W = 600, H = height, top = 12, bot = 24, n = data.length
  const max = Math.max(1, ...data) * 1.15
  const x = (i) => (n === 1 ? W / 2 : W - (i / (n - 1)) * W)
  const y = (v) => top + (1 - v / max) * (H - top - bot)
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${H - bot} L${x(0).toFixed(1)} ${H - bot} Z`
  const tick = niceTick(max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={ariaLabel}>
      <line x1="0" x2={W} y1={y(tick)} y2={y(tick)} className="stroke-[rgb(var(--c-hair)/var(--hair-alpha))]" />
      <text x={W} y={y(tick) - 5} textAnchor="end" className="fill-ink-3 text-[11px]">{format(tick)}</text>
      <motion.path initial={false} animate={{ d: area }} transition={reduce ? { duration: 0 } : SETTLE} className="fill-gold/10" />
      <motion.path
        key={drawKey}
        className="fill-none stroke-gold"
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, d: line }}
        animate={{ pathLength: 1, d: line }}
        transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }, d: SETTLE }}
      />
      <motion.circle
        r="5"
        className="fill-gold stroke-surface"
        strokeWidth="3"
        initial={false}
        animate={{ cx: x(n - 1), cy: y(data[n - 1] ?? 0) }}
        transition={reduce ? { duration: 0 } : SETTLE}
      />
      <text x={W} y={H - 5} textAnchor="end" className="fill-ink-3 text-[11px]">{startLabel}</text>
      <text x="0" y={H - 5} textAnchor="start" className="fill-ink-3 text-[11px]">{endLabel}</text>
    </svg>
  )
}
