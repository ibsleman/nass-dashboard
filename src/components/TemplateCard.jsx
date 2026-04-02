// ─── ألوان شارات النوع ──────────────────────────────────────────────────────
const TYPE_META = {
  image: {
    label:    'صورة',
    badge:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    gradient: 'from-blue-950 via-slate-900 to-slate-950',
    icon: (
      <svg className="w-9 h-9 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  imageWithPhoto: {
    label:    'مع صورة',
    badge:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    gradient: 'from-emerald-950 via-slate-900 to-slate-950',
    icon: (
      <svg className="w-9 h-9 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  video: {
    label:    'فيديو',
    badge:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    gradient: 'from-orange-950 via-slate-900 to-slate-950',
    icon: (
      <svg className="w-9 h-9 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export default function TemplateCard({ template, onEdit, onDelete }) {
  const meta       = TYPE_META[template.type] ?? TYPE_META.image
  const previewUrl = template.thumbnail_url || template.image_url
  const name       = template.image_name || template.video_name || '—'

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">

      {/* ─── منطقة المعاينة ─── */}
      <div className="relative aspect-[9/16] overflow-hidden">

        {/* الصورة أو الـ placeholder */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-b ${meta.gradient} flex flex-col items-center justify-center gap-3 select-none`}>
            <div className="w-16 h-16 rounded-2xl bg-white/8 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              {meta.icon}
            </div>
            <p className="text-[11px] font-medium text-white/25 tracking-wide">{meta.label}</p>
          </div>
        )}

        {/* ── شارة مدفوع ── */}
        {template.is_premium && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <span className="flex items-center gap-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
              ★ مدفوع
            </span>
          </div>
        )}

        {/* ── Overlay عند hover: زرّا التعديل والحذف ── */}
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2.5">
          <button
            onClick={() => onEdit(template)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-xl shadow-lg hover:bg-gray-50 active:scale-95 transition-all text-[12px] font-bold text-gray-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            تعديل
          </button>
          <button
            onClick={() => onDelete(template)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500 rounded-xl shadow-lg hover:bg-red-600 active:scale-95 transition-all text-[12px] font-bold text-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            حذف
          </button>
        </div>
      </div>

      {/* ─── بيانات البطاقة ─── */}
      <div className="p-3 space-y-2">
        <p
          className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate leading-snug"
          title={name}
        >
          {name}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
          {template.name_position_x != null && (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">
              {Math.round(template.name_position_x * 100)}%,{' '}
              {Math.round(template.name_position_y * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
