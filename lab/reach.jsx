// مختبر معزول للقطة البطلة في «التواصل»: اكتب ← اضغط مطوّلاً ← تنزل البطاقة إلى السجل وتُروى حالتها.
// ?theme=dark|light · ?fill=1 يملأ نصاً · الإرسال وهمي
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import NotificationsDesk from '../src/components/reach/NotificationsDesk'

const q = new URLSearchParams(location.search)
const theme = q.get('theme')
document.documentElement.classList.toggle('dark', theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

const ago = (m) => new Date(Date.now() - m * 60e3).toISOString()
const SEED = [
  { id: 'n3', title: 'قوالب المولود وصلت', body: 'بطاقات تهنئة جديدة للمولود، اكتب اسمك عليها وأرسلها في ثوانٍ.', target_type: 'all', status: 'sent', created_at: ago(60 * 26), sent_at: ago(60 * 26), total_tokens: 1210, success_count: 1204, fail_count: 6 },
  { id: 'n2', title: 'تهاني التخرج', body: 'فرحة التخرج تستاهل بطاقة باسمك.', target_type: 'country', target_country: 'KW', status: 'failed', created_at: ago(60 * 50), error_message: 'No active device tokens found' },
]

function Lab() {
  const [list, setList] = useState(SEED)
  const patch = (id, p) => setList((l) => l.map((n) => (n.id === id ? { ...n, ...p } : n)))
  const onCreate = (payload) => new Promise((res) => setTimeout(() => {
    const row = { id: `n${Date.now()}`, created_at: new Date().toISOString(), ...payload }
    setList((l) => [row, ...l])
    res(row)
  }, 220))
  const onSend = (id) => new Promise((res) => {
    setTimeout(() => patch(id, { status: 'sending', updated_at: new Date().toISOString() }), 300)
    setTimeout(() => { patch(id, { status: 'sent', sent_at: new Date().toISOString(), total_tokens: 1243, success_count: 1238, fail_count: 5 }); res() }, 2000)
  })
  const onDelete = (id) => new Promise((res) => setTimeout(() => { setList((l) => l.filter((n) => n.id !== id)); res() }, 200))
  window.__list = list
  return (
    <main className="min-h-screen bg-bg px-4 py-8 md:px-10">
      <div className="mx-auto grid max-w-[1180px] gap-6">
        <h1 className="text-[30px] font-extrabold leading-tight">التواصل</h1>
        <NotificationsDesk
          counts={{ all: 1243, SA: 980, KW: 140, AE: 123 }}
          schedulerReady
          bestHour={20}
          suggestion={q.get('fill') ? null : { season: 'رمضان', when: 'بعد 20 يوماً', title: 'رمضان اقترب', body: 'اختر تهنئة رمضان واكتب اسمك عليها، وأرسلها لأهلك قبل الزحمة.' }}
          notifications={list}
          onCreate={onCreate}
          onSend={onSend}
          onDelete={onDelete}
        />
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><Lab /></StrictMode>)
