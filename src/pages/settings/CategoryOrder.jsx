import { useEffect, useMemo, useState } from 'react'
import CategoryOrderBoard from '../../components/order/CategoryOrderBoard'
import { fetchCategories, saveCategoryOrder, showCategory } from '../../lib/supabase'
import { appOrder } from '../../lib/categoryOrder'
import { OCCASION_LABEL } from '../../lib/occasions'
import { upcomingSeasons } from '../../lib/today'

// ترتيب المناسبات كما يراه المستخدم في الرئيسية — يحل محل الصفحة القديمة (أسهم + زر حفظ + «مخفي» لا يخفي).
export default function CategoryOrder() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const seasons = useMemo(() => upcomingSeasons([], new Date()), [])

  const load = () => fetchCategories().then(setRows, (e) => setError(e.message))
  useEffect(() => { load() }, [])

  if (error) return <p className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">تعذّر قراءة المناسبات: {error}</p>
  if (!rows) return <div className="h-[200px] animate-pulse rounded-card bg-hair" />

  // التطبيق لا يخفي مناسبة «مخفية»: يضعها في آخر الشريط — يُقال ذلك بصدق ويُعرض إصلاحه
  const off = rows.filter((r) => !r.is_active)
  return (
    <div className="grid gap-4">
      {off.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hair bg-surface px-4 py-3">
          <p className="text-[13px] text-ink-2">
            {off.map((r) => OCCASION_LABEL[r.key] ?? r.name_ar).join('، ')}: معلَّمة «مخفية» من اللوحة القديمة، لكن التطبيق لا يخفي المناسبات بل يعرضها في آخر الشريط.
          </p>
          <button type="button" onClick={() => Promise.all(off.map((r) => showCategory(r.id))).then(load)} className="min-h-10 rounded-full border border-hair px-4 text-[13px] font-semibold hover:border-gold hover:text-gold">
            اجعلها في ترتيبها
          </button>
        </div>
      )}
      <CategoryOrderBoard key={rows.map((r) => `${r.key}${r.is_active}`).join()} rows={rows} initialKeys={appOrder(rows)} onSave={saveCategoryOrder} seasons={seasons} />
    </div>
  )
}
