import { motion } from 'motion/react'

export const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }

/** اختيار واحد من خيارات قليلة — الحبة تنزلق إلى المختار (نفس مبدّل الفترة في «الأرقام») */
export default function Segmented({ id, options, value, onChange, label, className = '' }) {
  return (
    <div className={`inline-flex max-w-full flex-wrap gap-1 rounded-[18px] border border-hair bg-sunken p-1 ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.key)}
            className={`relative min-h-10 rounded-[14px] px-4 text-[14px] disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {/* layoutDependency: الحبة تنزلق عند تغيّر الاختيار فقط، لا عند تحرّك الصفحة حولها */}
            {on && <motion.span layoutId={`${id}-pill`} layoutDependency={value} className="absolute inset-0 rounded-[14px] bg-surface shadow-card" transition={SETTLE} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
