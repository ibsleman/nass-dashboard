// مختبر معزول للقطة البطلة (دستور التصميم: تُصقل وحدها قبل بناء الشاشة حولها).
// 157 صفاً حقيقياً من كاش التطبيق على المحاكي (صور الـCDN العامة)، والحفظ وهمي.
// ?fail=1 يجرّب فشل الحفظ · ?theme=dark|light يثبّت المظهر
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import NamePlacement from '../src/components/place/NamePlacement'
import { placementQueue } from '../src/lib/nameSpot'
import rows from './fixtures/templates.json'

const q = new URLSearchParams(location.search)
const theme = q.get('theme')
document.documentElement.classList.toggle('dark', theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

const ORDER = ['ramadan', 'eidAlFitr', 'eidAlAdha', 'engagement', 'marriage', 'newborn', 'graduation', 'birthday', 'invitations', 'promotion', 'condolences']
const LABEL = { ramadan: 'رمضان', eidAlFitr: 'عيد الفطر', eidAlAdha: 'عيد الأضحى', engagement: 'خطوبة', marriage: 'زواج', newborn: 'مولود', graduation: 'تخرج', birthday: 'عيد ميلاد', invitations: 'دعوات', promotion: 'ترقية وتكريم', condolences: 'تعزية' }
window.__saves = []
const onSave = (t, p) => new Promise((res, rej) => setTimeout(() => {
  window.__saves.push({ id: t.id, p })
  q.get('fail') ? rej(new Error('انقطع الاتصال')) : res()
}, 250))
const onToast = (msg) => { window.__toasts = [...(window.__toasts || []), msg]; console.warn(msg) }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <main className="min-h-screen bg-bg px-4 py-8 md:px-10">
      <div className="mx-auto max-w-[1180px] grid gap-6">
        <header className="grid gap-1">
          <p className="text-[13px] font-semibold text-gold">القوالب</p>
          <h1 className="text-[30px] font-extrabold leading-tight">ضع الاسم كما سيراه الناس</h1>
          <p className="text-[15px] text-ink-2 max-w-[640px]">اضغط حيث يجب أن يكون الاسم. يستقر ويُحفظ وحده، ثم يأتيك القالب التالي.</p>
        </header>
        <NamePlacement templates={placementQueue(rows, ORDER)} categoryLabel={LABEL} onSave={onSave} onToast={onToast} />
      </div>
    </main>
  </StrictMode>,
)
