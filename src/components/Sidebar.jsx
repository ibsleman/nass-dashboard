import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const CATEGORIES = [
  { key: 'ramadan',     label: 'رمضان',      emoji: '🌙' },
  { key: 'eidAlFitr',  label: 'عيد الفطر',  emoji: '🎉' },
  { key: 'eidAlAdha',  label: 'عيد الأضحى', emoji: '🐑' },
  { key: 'engagement', label: 'خطوبة',       emoji: '💍' },
  { key: 'marriage',   label: 'زواج',        emoji: '💒' },
  { key: 'newborn',    label: 'مولود',       emoji: '👶' },
  { key: 'graduation', label: 'تخرج',        emoji: '🎓' },
]

export { CATEGORIES }

export default function Sidebar({ activeCategory, onSelectCategory, counts = {} }) {
  const { logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  return (
    <aside className="w-64 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 shadow-sm">
      {/* الهيدر */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow">
            <span className="text-white font-black text-lg">N</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white leading-tight">Nass CMS</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">إدارة القوالب</p>
          </div>
        </div>
      </div>

      {/* القوائم */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">
          الأقسام
        </p>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => onSelectCategory(cat.key)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-200 dark:shadow-brand-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{cat.emoji}</span>
                <span>{cat.label}</span>
              </div>
              {counts[cat.key] !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {counts[cat.key]}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* الفوتر */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
        >
          {isDark ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
              </svg>
              الوضع النهاري
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              الوضع الليلي
            </>
          )}
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
