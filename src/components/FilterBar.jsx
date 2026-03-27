const TYPE_FILTERS = [
  { value: 'all',            label: 'الكل' },
  { value: 'image',          label: 'صورة' },
  { value: 'imageWithPhoto', label: 'مع صورة' },
  { value: 'video',          label: 'فيديو' },
]

const PREMIUM_FILTERS = [
  { value: 'all',     label: 'الكل' },
  { value: 'free',    label: 'مجاني' },
  { value: 'premium', label: 'مدفوع' },
]

export default function FilterBar({ typeFilter, premiumFilter, onTypeChange, onPremiumChange, total }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* فلتر النوع */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onTypeChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              typeFilter === f.value
                ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* فلتر المدفوع */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {PREMIUM_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onPremiumChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              premiumFilter === f.value
                ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* العدد */}
      <span className="text-sm text-gray-400 dark:text-gray-500 mr-auto">
        {total} قالب
      </span>
    </div>
  )
}
