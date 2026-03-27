const TYPE_FILTERS = [
  { value: 'all',            label: 'الكل'    },
  { value: 'image',          label: 'صورة'    },
  { value: 'imageWithPhoto', label: 'مع صورة' },
  { value: 'video',          label: 'فيديو'   },
]

const PREMIUM_FILTERS = [
  { value: 'all',     label: 'الكل'   },
  { value: 'free',    label: 'مجاني'  },
  { value: 'premium', label: 'مدفوع'  },
]

export default function FilterBar({ typeFilter, premiumFilter, onTypeChange, onPremiumChange, total }) {
  return (
    <div className="flex items-center justify-between mb-4 md:mb-6 gap-3">

      {/* العداد — يمين الشاشة (أول عنصر DOM في RTL) */}
      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
          {total}
        </span>
        <span className="text-xs md:text-sm font-medium text-gray-400 dark:text-gray-500">قالب</span>
      </div>

      {/* الفلاتر — قابلة للتمرير أفقياً على الهاتف */}
      <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-none min-w-0 pb-0.5">

        {/* فلتر النوع */}
        <div className="flex items-center gap-0.5 md:gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-shrink-0">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onTypeChange(f.value)}
              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
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
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

        {/* فلتر السعر */}
        <div className="flex items-center gap-0.5 md:gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-shrink-0">
          {PREMIUM_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onPremiumChange(f.value)}
              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
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
