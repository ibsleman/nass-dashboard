import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import CategoryOrder from './settings/CategoryOrder'

const MODES = [
  { key: 'auto', label: 'حسب الجهاز' },
  { key: 'light', label: 'نهاري' },
  { key: 'dark', label: 'ليلي' },
]

export default function SettingsPage() {
  const { mode, setMode } = useTheme()
  const { logout } = useAuth()

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-6 md:px-8">
      <h1 className="text-[30px] font-extrabold leading-tight">الإعدادات</h1>

      <section className="grid gap-3">
        <h2 className="text-[17px] font-bold">المظهر</h2>
        <div className="inline-flex w-fit gap-1 rounded-full border border-hair bg-sunken p-1" role="group" aria-label="المظهر">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`min-h-9 rounded-full px-4 text-[13px] ${mode === m.key ? 'bg-surface font-semibold text-ink shadow-card' : 'text-ink-2'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-[17px] font-bold">ترتيب المناسبات في التطبيق</h2>
        <CategoryOrder />
      </section>

      <section>
        <button type="button" onClick={logout} className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold text-warn hover:border-warn">
          تسجيل الخروج
        </button>
      </section>
    </div>
  )
}
