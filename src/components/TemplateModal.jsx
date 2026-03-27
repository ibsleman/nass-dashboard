import { useState, useRef, useEffect, useCallback } from 'react'
import { uploadFile } from '../lib/supabase'

const EMPTY_FORM = {
  type: 'image',
  image_name: '',
  video_name: '',
  is_premium: false,
  name_position_x: null,
  name_position_y: null,
  text_appear_time: '',
}

export default function TemplateModal({ isOpen, onClose, onSave, editTemplate, category }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [markerPos, setMarkerPos] = useState(null) // {x, y} in px on canvas

  const canvasRef = useRef(null)
  const canvasImgRef = useRef(null) // HTMLImageElement loaded on canvas

  // ─── Initialisation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return
    if (editTemplate) {
      setForm({
        type:            editTemplate.type            ?? 'image',
        image_name:      editTemplate.image_name      ?? '',
        video_name:      editTemplate.video_name      ?? '',
        is_premium:      editTemplate.is_premium      ?? false,
        name_position_x: editTemplate.name_position_x ?? null,
        name_position_y: editTemplate.name_position_y ?? null,
        text_appear_time: editTemplate.text_appear_time ?? '',
      })
      setImagePreview(editTemplate.image_url ?? null)
      setImageFile(null)
      setVideoFile(null)
      if (editTemplate.name_position_x != null) {
        // سيُحسب الـ px بعد رسم الكانفاس
        setMarkerPos({ ratio: { x: editTemplate.name_position_x, y: editTemplate.name_position_y } })
      } else {
        setMarkerPos(null)
      }
    } else {
      setForm(EMPTY_FORM)
      setImagePreview(null)
      setImageFile(null)
      setVideoFile(null)
      setMarkerPos(null)
    }
    setError('')
  }, [isOpen, editTemplate])

  // ─── Canvas ───────────────────────────────────────────────────────────────

  const drawCanvas = useCallback((imgSrc) => {
    const canvas = canvasRef.current
    if (!canvas || !imgSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // حجم الكانفاس ثابت، الصورة تُناسب بداخله
      const maxW = canvas.offsetWidth || 300
      const maxH = 400
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
      canvas.width  = img.naturalWidth  * ratio
      canvas.height = img.naturalHeight * ratio
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvasImgRef.current = { img, ratio, cw: canvas.width, ch: canvas.height }
      // إعادة رسم الماركر إن وُجد
      if (markerPos?.ratio) {
        const px = markerPos.ratio.x * canvas.width
        const py = markerPos.ratio.y * canvas.height
        setMarkerPos({ px: { x: px, y: py }, ratio: markerPos.ratio })
        drawMarker(ctx, px, py, canvas.width, canvas.height)
      }
    }
    img.src = imgSrc
  }, [markerPos])

  useEffect(() => {
    if (imagePreview) drawCanvas(imagePreview)
  }, [imagePreview]) // eslint-disable-line

  function drawMarker(ctx, px, py, cw, ch) {
    // امسح وأعد رسم الصورة ثم الماركر
    if (!canvasImgRef.current) return
    const { img, ratio } = canvasImgRef.current
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)

    // دائرة + تقاطع
    ctx.strokeStyle = '#c44df0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(px, py, 14, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = 'rgba(196,77,240,0.25)'
    ctx.beginPath()
    ctx.arc(px, py, 14, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#c44df0'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px - 20, py); ctx.lineTo(px + 20, py); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px, py - 20); ctx.lineTo(px, py + 20); ctx.stroke()
  }

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas || !canvasImgRef.current) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left)  * scaleX
    const py = (e.clientY - rect.top)   * scaleY
    const rx = px / canvas.width
    const ry = py / canvas.height

    setForm((f) => ({ ...f, name_position_x: rx, name_position_y: ry }))
    setMarkerPos({ px: { x: px, y: py }, ratio: { x: rx, y: ry } })
    const ctx = canvas.getContext('2d')
    drawMarker(ctx, px, py, canvas.width, canvas.height)
  }

  // ─── File pickers ─────────────────────────────────────────────────────────

  const handleImageFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setForm((f) => ({ ...f, image_name: file.name }))
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setMarkerPos(null)
    setForm((f) => ({ ...f, name_position_x: null, name_position_y: null }))
  }

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setForm((f) => ({ ...f, video_name: file.name }))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (form.type !== 'video' && !imageFile && !editTemplate?.image_url) {
      return setError('يرجى رفع صورة')
    }
    if (form.type === 'video' && !videoFile && !editTemplate?.video_url) {
      return setError('يرجى رفع ملف فيديو')
    }

    setUploading(true)
    try {
      const payload = {
        type:             form.type,
        category,
        is_premium:       form.is_premium,
        name_position_x:  form.name_position_x,
        name_position_y:  form.name_position_y,
        text_appear_time: form.text_appear_time !== '' ? parseFloat(form.text_appear_time) : null,
      }

      // رفع الصورة
      if (imageFile) {
        const { publicUrl, fileName } = await uploadFile(imageFile, 'images')
        payload.image_url  = publicUrl
        payload.image_name = fileName.split('/').pop()
      } else {
        payload.image_url  = editTemplate?.image_url  ?? null
        payload.image_name = form.image_name || editTemplate?.image_name || null
      }

      // رفع الفيديو
      if (videoFile) {
        const { publicUrl, fileName } = await uploadFile(videoFile, 'videos')
        payload.video_url  = publicUrl
        payload.video_name = fileName.split('/').pop()
      } else {
        payload.video_url  = editTemplate?.video_url  ?? null
        payload.video_name = form.video_name || editTemplate?.video_name || null
      }

      await onSave(payload, editTemplate?.id ?? null)
      onClose()
    } catch (err) {
      setError(err.message ?? 'حدث خطأ أثناء الحفظ')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const needsImage = form.type !== 'video'
  const needsVideo = form.type === 'video'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* نوع القالب */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">نوع القالب</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'image',          label: 'صورة',     icon: '🖼️' },
                { value: 'imageWithPhoto', label: 'مع صورة',  icon: '👤' },
                { value: 'video',          label: 'فيديو',    icon: '🎬' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    form.type === t.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className={`text-sm font-medium ${form.type === t.value ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* رفع الصورة */}
          {needsImage && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                الصورة {editTemplate ? '(اتركها فارغة للإبقاء على الحالية)' : '*'}
              </label>
              <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {imageFile ? imageFile.name : 'اضغط لاختيار صورة (PNG, JPG, WEBP)'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
              </label>
            </div>
          )}

          {/* رفع الفيديو */}
          {needsVideo && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                الفيديو {editTemplate ? '(اتركه فارغاً للإبقاء على الحالي)' : '*'}
              </label>
              <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {videoFile ? videoFile.name : 'اضغط لاختيار فيديو (MP4, MOV)'}
                </span>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />
              </label>
            </div>
          )}

          {/* Canvas لتحديد موضع الاسم */}
          {needsImage && imagePreview && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                موضع الاسم
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 mr-2">
                  (اضغط على الصورة لتحديد موضع ظهور الاسم)
                </span>
              </label>
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="w-full cursor-crosshair block"
                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                />
              </div>
              {form.name_position_x != null && (
                <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">
                  الموضع المختار: X = {(form.name_position_x * 100).toFixed(1)}%، Y = {(form.name_position_y * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {/* text_appear_time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              وقت ظهور النص (ثانية) — اختياري
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.text_appear_time}
              onChange={(e) => setForm((f) => ({ ...f, text_appear_time: e.target.value }))}
              placeholder="مثال: 1.5"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          {/* is_premium */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_premium: !f.is_premium }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.is_premium ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_premium ? 'right-1' : 'left-1'}`} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              قالب مدفوع (Premium)
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* أزرار */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  جاري الرفع...
                </span>
              ) : (editTemplate ? 'حفظ التعديلات' : 'حفظ ونشر')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
