import { useMemo } from 'react'
import NamePlacement from '../../components/place/NamePlacement'
import Toast, { useToast } from '../../components/Toast'
import { placementPayload, placementQueue } from '../../lib/nameSpot'
import { OCCASION_KEYS, OCCASION_LABEL } from '../../lib/occasions'
import { updateTemplate } from '../../lib/supabase'

/** «ضع الاسم كما سيراه الناس» — كل ضغطة تُحفظ فوراً، ومعها updated_at كي تصل الأجوال في المزامنة التالية */
export default function PlacePage({ overview, onChanged }) {
  const [toast, showToast] = useToast()
  // الدفعة تُرتَّب مرة واحدة: قالب ضُبط للتو لا يقفز إلى آخر القائمة تحت يد المشرف
  const queue = useMemo(() => (overview ? placementQueue(overview, OCCASION_KEYS) : null), [overview !== null])

  if (!queue) {
    return <div className="h-[clamp(480px,calc(100vh-260px),880px)] rounded-card bg-hair animate-pulse" aria-label="يُحمَّل" />
  }
  if (queue.length === 0) {
    return <p className="text-[15px] text-ink-2">لا قوالب بعد. ارفع أول قالب من «المناسبات».</p>
  }

  return (
    <div className="grid gap-4">
      <p className="max-w-[640px] text-[15px] text-ink-2">
        اضغط حيث يجب أن يكون الاسم. يستقر ويُحفظ وحده، ثم يأتيك القالب التالي. الإطار المتقطع هو ما يخمّنه التطبيق الآن.
      </p>
      <NamePlacement
        templates={queue}
        categoryLabel={OCCASION_LABEL}
        onSave={async (t, point) => { await updateTemplate(t.id, placementPayload(point)); onChanged?.() }}
        onToast={showToast}
      />
      <Toast toast={toast} />
    </div>
  )
}
