import { motion } from 'motion/react'

// الطيران من الشاشة إلى السجل — نابض الانزلاق نفسه في التطبيق (response 0.42، تخميد 0.86)
export const SLIDE = { type: 'spring', stiffness: 224, damping: 27.5, mass: 1 }

/**
 * الإشعار كما يراه الناس على شاشة القفل: أيقونة التطبيق، العنوان سطراً واحداً، والنص حتى أربعة أسطر.
 * البطاقة نفسها في المعاينة وفي السجل (بنفس العرض)، فتنتقل بينهما بلا تشوّه.
 */
export default function NotificationCard({ title, body, time = 'الآن', layoutId, placeholder = false, className = '', ...motionProps }) {
  const t = title?.trim()
  const b = body?.trim()
  return (
    <motion.div
      layoutId={layoutId}
      transition={SLIDE}
      className={`grid grid-cols-[38px_minmax(0,1fr)] gap-x-2.5 rounded-[20px] bg-[#2a2622] px-3.5 py-3 text-start text-white shadow-[0_12px_32px_-14px_rgb(0_0_0/0.7)] ring-1 ring-white/[0.08] ${className}`}
      {...motionProps}
    >
      <span className="row-span-2 grid h-[38px] w-[38px] place-items-center self-start rounded-[10px] bg-[#0E0D0B] font-logo text-[15px] leading-none text-[#E9C46A] ring-1 ring-white/10">
        نصّ
      </span>
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[13.5px]">
        <span className={`truncate font-semibold ${t ? '' : 'text-white/35'}`}>{t || (placeholder ? 'عنوان الإشعار' : '')}</span>
        <span className="shrink-0 text-[12px] text-white/55">{time}</span>
      </div>
      <p className={`line-clamp-4 break-words text-[13.5px] leading-[1.45] ${b ? 'text-white/85' : 'text-white/35'}`}>
        {b || (placeholder ? 'نصّه يظهر هنا كما سيقرؤه الناس' : '')}
      </p>
    </motion.div>
  )
}
