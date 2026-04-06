import { useState, useRef, useEffect } from 'react'
import { uploadFile } from '../lib/supabase'

const DEFAULT_ITEM = () => ({
  type: 'image',
  is_premium: false,
  text_appear_time: '',
  name_position_x: '',
  name_position_y: '',
})

function detectType(file) {
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

export default function BulkUploadModal({ isOpen, onClose, onSave, category }) {
  const [items, setItems]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState({ done: 0, total: 0 })
  const [error, setError]         = useState('')
  const inputRef = useRef(null)
  const itemsRef = useRef(items)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    return () => { itemsRef.current.forEach(item => URL.revokeObjectURL(item.preview)) }
  }, [])

  if (!isOpen) return null

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newItems = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      ...DEFAULT_ITEM(),
      type: detectType(file),
    }))
    setItems((prev) => [...prev, ...newItems])
    e.target.value = ''
  }

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  const removeItem = (idx) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleUploadAll = async () => {
    if (!items.length) return
    setError('')
    setUploading(true)
    setProgress({ done: 0, total: items.length })

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const folder = item.type === 'video' ? 'videos' : 'images'
        const { publicUrl, fileName } = await uploadFile(item.file, folder)

        const payload = {
          type:             item.type,
          category,
          is_premium:       item.is_premium,
          text_appear_time: item.text_appear_time !== '' ? parseFloat(item.text_appear_time) : null,
          name_position_x:  item.name_position_x  !== '' ? parseFloat(item.name_position_x)  : null,
          name_position_y:  item.name_position_y  !== '' ? parseFloat(item.name_position_y)  : null,
        }

        if (item.type === 'video') {
          payload.video_url  = publicUrl
          payload.video_name = fileName.split('/').pop()
          payload.image_url  = null
          payload.image_name = ''
        } else {
          payload.image_url  = publicUrl
          payload.image_name = fileName.split('/').pop()
          payload.video_url  = null
          payload.video_name = null
        }

        await onSave(payload, null)
        setProgress({ done: i + 1, total: items.length })
      }
      items.forEach(item => URL.revokeObjectURL(item.preview))
      setItems([])
      onClose()
    } catch (err) {
      setError(err.message ?? 'حدث خطأ أثناء الرفع')
    } finally {
      setUploading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-3xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800 overflow-hidden">

        {/* مقبض السحب موبايل */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">رفع عدة قوالب</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* زر اختيار الملفات */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800 disabled:opacity-50"
          >
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">اضغط لإضافة ملفات (صور أو فيديوهات)</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFiles}
          />

          {/* قائمة الملفات */}
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
                >
                  {/* معاينة */}
                  <div className="flex-shrink-0 w-16 h-20 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
                    {item.type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-orange-950">
                        <svg className="w-7 h-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    ) : (
                      <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* الحقول */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{item.file.name}</p>

                    {/* نوع القالب */}
                    <div className="flex gap-1.5">
                      {[
                        { value: 'image',          label: 'صورة' },
                        { value: 'imageWithPhoto',  label: 'مع صورة' },
                        { value: 'video',           label: 'فيديو' },
                      ].map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => updateItem(idx, { type: t.value })}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            item.type === t.value
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* موضع الاسم + وقت الظهور */}
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="X%"
                        min="0" max="100" step="0.1"
                        value={item.name_position_x}
                        onChange={(e) => updateItem(idx, { name_position_x: e.target.value })}
                        className={inputCls}
                      />
                      <input
                        type="number"
                        placeholder="Y%"
                        min="0" max="100" step="0.1"
                        value={item.name_position_y}
                        onChange={(e) => updateItem(idx, { name_position_y: e.target.value })}
                        className={inputCls}
                      />
                      <input
                        type="number"
                        placeholder="ثا"
                        min="0" step="0.1"
                        value={item.text_appear_time}
                        onChange={(e) => updateItem(idx, { text_appear_time: e.target.value })}
                        className={inputCls}
                      />
                    </div>

                    {/* Premium */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateItem(idx, { is_premium: !item.is_premium })}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                          item.is_premium ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          item.is_premium ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">مدفوع</span>
                    </div>
                  </div>

                  {/* حذف */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={uploading}
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all self-start"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* خطأ */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center gap-2.5 px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={uploading || items.length === 0}
            className="flex-1 py-3 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            {uploading
              ? `جاري الرفع... ${progress.done}/${progress.total}`
              : `رفع الكل (${items.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
