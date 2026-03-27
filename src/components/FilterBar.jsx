const TYPE_FILTERS = [
  { value: 'all',            label: 'الكل'     },
  { value: 'image',          label: 'صورة'     },
  { value: 'imageWithPhoto', label: 'مع صورة'  },
  { value: 'video',          label: 'فيديو'    },
]

const PREMIUM_FILTERS = [
  { value: 'all',     label: 'الكل'    },
  { value: 'free',    label: 'مجاني'   },
  { value: 'premium', label: 'مدفوع'   },
]

export default function FilterBar({ typeFilter, premiumFilter, onTypeChange, onPremiumChange, total }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">

      {/* ── العداد — يمين الشاشة في RTL (أول عنصر DOM) ── */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
          {total}
        </span>
        <span className="text-sm font-medium text-gray-400 dark:text-gray-500">قالب</span>
      </div>

      {/* ── الفلاتر — يسار الشاشة في RTL (آخر عنصر DOM) ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* فلتر النوع */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onTypeChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                typeFilter === f.value
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* فاصل */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* فلتر السعر */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {PREMIUM_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onPremiumChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                premiumFilter === f.value
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
