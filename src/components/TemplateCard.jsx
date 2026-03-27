const TYPE_LABELS = {
  image:          { label: 'صورة',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  imageWithPhoto: { label: 'مع صورة', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  video:          { label: 'فيديو',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
}

export default function TemplateCard({ template, onEdit, onDelete }) {
  const typeInfo = TYPE_LABELS[template.type] ?? { label: template.type, color: 'bg-gray-100 text-gray-600' }
  const previewUrl = template.image_url

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* معاينة */}
      <div className="relative aspect-[9/16] bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={template.image_name || template.video_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
            {template.type === 'video' ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            <p className="text-xs mt-2">لا توجد معاينة</p>
          </div>
        )}

        {/* شارة المدفوع */}
        {template.is_premium && (
          <div className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full shadow">
            ★ مدفوع
          </div>
        )}

        {/* أزرار الإجراءات عند hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={() => onEdit(template)}
            className="p-2.5 bg-white rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
            title="تعديل"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(template)}
            className="p-2.5 bg-white rounded-xl shadow-lg hover:bg-red-50 transition-colors"
            title="حذف"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* بيانات القالب */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={template.image_name || template.video_name}>
          {template.image_name || template.video_name || '—'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          {template.name_position_x != null && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({Math.round(template.name_position_x * 100)}%, {Math.round(template.name_position_y * 100)}%)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
