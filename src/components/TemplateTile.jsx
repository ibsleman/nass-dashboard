import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import HoldButton from './HoldButton'
import { hasSpot } from '../lib/nameSpot'

// بطاقة قالب في «القوالب»: صورته المصغّرة كما يراها المستخدم، حالته في كلمات قليلة،
// وأفعاله في مكانه — والحذف بضغط مطوّل لا بنافذة تأكيد.

const TYPE = { video: 'فيديو', imageWithPhoto: 'مع صورة شخصية' }
// DS.Motion.settle: response 0.40، تخميد 0.85 — إعادة تدفق الشبكة بعد حذف بطاقة
export const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }

const Chip = ({ children, tone = 'dark' }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone === 'gold' ? 'bg-[#E9C46A] text-[#0E0D0B]' : 'bg-black/65 text-[#F7F2E8]'}`}>{children}</span>
)

const TemplateTile = forwardRef(function TemplateTile(
  { template: t, studio = false, selected = false, selecting = false, onToggleSelect, onEdit, onToggleVisibility, onDelete, reduce },
  ref,
) {
  const hidden = t.is_visible === false
  const cover = t.thumbnail_url || t.image_url
  return (
    <motion.li
      ref={ref}
      layout={!reduce}
      initial={false}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      transition={SETTLE}
      className={`group relative overflow-hidden rounded-card bg-sunken ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-bg' : ''}`}
    >
      <div className="relative aspect-[9/16]">
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-[filter,opacity] duration-300 ${hidden ? 'opacity-40 grayscale' : ''}`}
          />
        )}
        <div className="absolute start-2 end-11 top-2 flex flex-wrap items-start gap-1">
          {studio && <Chip>استوديو</Chip>}
          {t.is_premium && <Chip tone="gold">مدفوع</Chip>}
          {TYPE[t.type] && <Chip>{TYPE[t.type]}</Chip>}
          {hidden && <Chip>مخفي عن المستخدمين</Chip>}
        </div>
        {!studio && hasSpot(t) && (
          <span className="absolute bottom-2 end-2 h-2 w-2 rounded-full bg-[#E9C46A] shadow-[0_0_0_2px_rgba(14,13,11,.6)]" title="مكان الاسم مضبوط" />
        )}
        {!studio && onToggleSelect && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label="تحديد القالب"
            onClick={() => onToggleSelect(t.id)}
            className={`absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 transition-opacity ${
              selected ? 'border-[#E9C46A] bg-[#E9C46A] opacity-100' : 'border-white/80 bg-black/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            } ${selecting ? 'opacity-100' : ''}`}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-[#0E0D0B]" />}
          </button>
        )}
      </div>

      {/* على اللمس: الأفعال تحت الصورة دائماً. بالماوس: تصعد من حافة البطاقة عند المرور وتعود */}
      <div className="grid grid-cols-[1fr_1fr] gap-1.5 bg-surface p-2 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:bottom-0 [@media(hover:hover)]:translate-y-full [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-300 [@media(hover:hover)]:[transition-timing-function:cubic-bezier(.2,.8,.2,1)] [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-focus-within:translate-y-0">
        {studio ? (
          <Link to="/templates/studio" className="col-span-2 grid min-h-9 place-items-center rounded-[10px] border border-hair text-[12px] font-semibold hover:border-gold">
            افتحه في الاستوديو
          </Link>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(t)} className="min-h-9 rounded-[10px] border border-hair text-[12px] font-semibold hover:border-gold">
              تعديل
            </button>
            <button type="button" onClick={() => onToggleVisibility(t)} className="min-h-9 rounded-[10px] border border-hair text-[12px] font-semibold hover:border-gold">
              {hidden ? 'إظهار' : 'إخفاء'}
            </button>
            <HoldButton compact label="حذف" onConfirm={() => onDelete(t)} className="col-span-2" />
          </>
        )}
      </div>
    </motion.li>
  )
})

export default TemplateTile
