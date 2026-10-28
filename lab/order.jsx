// مختبر معزول للقطة البطلة في ترتيب المناسبات: سحب البطاقة داخل نسخة شريط الرئيسية.
// ?theme=dark|light · ?nudge=1 يعرض اقتراح موسم قريب · الحفظ وهمي
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import CategoryOrderBoard from '../src/components/order/CategoryOrderBoard'
import { appOrder } from '../src/lib/categoryOrder'

const q = new URLSearchParams(location.search)
const theme = q.get('theme')
document.documentElement.classList.toggle('dark', theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

// ترتيب الإنتاج الحالي
const PROD = ['marriage', 'eidAlAdha', 'invitations', 'promotion', 'eidAlFitr', 'engagement', 'newborn', 'condolences', 'birthday', 'graduation', 'ramadan']
const rows = PROD.map((key, i) => ({ id: `id-${key}`, key, display_order: i + 1, is_active: true }))
window.__saves = []
const onSave = (patch) => new Promise((r) => setTimeout(() => { window.__saves.push(patch); r() }, 200))
const seasons = q.get('nudge') ? [{ key: 'ramadan', label: 'رمضان', days: 12 }] : []

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <main className="min-h-screen bg-bg px-4 py-8 md:px-10">
      <div className="mx-auto grid max-w-[1180px] gap-4">
        <h2 className="text-[17px] font-bold">ترتيب المناسبات في التطبيق</h2>
        <CategoryOrderBoard rows={rows} initialKeys={appOrder(rows)} onSave={onSave} seasons={seasons} />
      </div>
    </main>
  </StrictMode>,
)
