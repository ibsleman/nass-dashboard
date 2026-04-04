import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { key: 'ramadan',     label: 'رمضان',      emoji: '🌙' },
  { key: 'eidAlFitr',  label: 'عيد الفطر',  emoji: '🎉' },
  { key: 'eidAlAdha',  label: 'عيد الأضحى', emoji: '🐑' },
  { key: 'engagement', label: 'خطوبة',       emoji: '💍' },
  { key: 'marriage',   label: 'زواج',        emoji: '💒' },
  { key: 'newborn',    label: 'مولود',       emoji: '👶' },
  { key: 'graduation',  label: 'تخرج',         emoji: '🎓' },
  { key: 'birthday',   label: 'عيد ميلاد',   emoji: '🎂' },
  { key: 'invitations', label: 'دعوات',       emoji: '✉️' },
  { key: 'promotion',  label: 'ترقية وتكريم', emoji: '🏅' },
  { key: 'condolences', label: 'تعزية',       emoji: '🕊️' },
  { key: '__ads__',     label: 'الإعلانات',    emoji: '📢' },
  { key: '__updates__', label: 'التحديثات',    emoji: '🔄' },
]

export { CATEGORIES }

export default function Sidebar({ activeCategory, onSelectCategory, counts = {} }) {
  const { logout } = useAuth()

  return (
    <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 shadow-sm">

      {/* ─── عنوان القسم ─── */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          الأقسام
        </p>
      </div>

      {/* ─── القائمة ─── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-0.5 pb-3">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key
          const count    = counts[cat.key]

          return (
            <button
              key={cat.key}
              onClick={() => onSelectCategory(cat.key)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {/* الإيموجي + الاسم */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base flex-shrink-0">{cat.emoji}</span>
                <span className="truncate">{cat.label}</span>
              </div>

              {/* العداد */}
              {count !== undefined && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums flex-shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : count > 0
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ─── الفوتر ─── */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
