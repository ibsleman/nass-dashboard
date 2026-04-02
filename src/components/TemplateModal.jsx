import { useState, useRef, useEffect, useCallback } from 'react'
import { uploadFile } from '../lib/supabase'

const EMPTY_FORM = {
  type:             'image',
  image_name:       '',
  video_name:       '',
  is_premium:       false,
  name_position_x:  null,
  name_position_y:  null,
  text_appear_time: '',
  thumbnail_name:   '',
}

export default function TemplateModal({ isOpen, onClose, onSave, editTemplate, category }) {
  const [form, setForm]               = useState(EMPTY_FORM)
  const [imageFile, setImageFile]         = useState(null)
  const [imagePreview, setImagePreview]   = useState(null)
  const [videoFile, setVideoFile]         = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [error, setError]             = useState('')
  const [markerPos, setMarkerPos]     = useState(null)

  const canvasRef    = useRef(null)
  const canvasImgRef = useRef(null)

  // ─── تهيئة الـ form عند الفتح ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    if (editTemplate) {
      setForm({
        type:             editTemplate.type             ?? 'image',
        image_name:       editTemplate.image_name       ?? '',
        video_name:       editTemplate.video_name       ?? '',
        is_premium:       editTemplate.is_premium       ?? false,
        name_position_x:  editTemplate.name_position_x  ?? null,
        name_position_y:  editTemplate.name_position_y  ?? null,
        text_appear_time: editTemplate.text_appear_time ?? '',
        thumbnail_name:   editTemplate.thumbnail_name   ?? '',
      })
      setImagePreview(editTemplate.image_url ?? null)
      setImageFile(null)
      setVideoFile(null)
      setThumbnailFile(null)
      setMarkerPos(
        editTemplate.name_position_x != null
          ? { ratio: { x: editTemplate.name_position_x, y: editTemplate.name_position_y } }
          : null
      )
    } else {
      setForm(EMPTY_FORM)
      setImagePreview(null)
      setImageFile(null)
      setVideoFile(null)
      setThumbnailFile(null)
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
      const maxW = canvas.offsetWidth || 300
      const maxH = 360
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
      canvas.width  = img.naturalWidth  * ratio
      canvas.height = img.naturalHeight * ratio
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvasImgRef.current = { img, ratio, cw: canvas.width, ch: canvas.height }
      if (markerPos?.ratio) {
        const px = markerPos.ratio.x * canvas.width
        const py = markerPos.ratio.y * canvas.height
        setMarkerPos({ px: { x: px, y: py }, ratio: markerPos.ratio })
        drawMarker(ctx, px, py, canvas.width, canvas.height)
      }
    }
    img.src = imgSrc
  }, [markerPos]) // eslint-disable-line

  useEffect(() => {
    if (imagePreview) drawCanvas(imagePreview)
  }, [imagePreview]) // eslint-disable-line

  function drawMarker(ctx, px, py, cw, ch) {
    if (!canvasImgRef.current) return
    const { img } = canvasImgRef.current
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)

    ctx.strokeStyle = '#c44df0'
    ctx.lineWidth   = 2
    ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(196,77,240,0.25)'
    ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#c44df0'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px - 22, py); ctx.lineTo(px + 22, py); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px, py - 22); ctx.lineTo(px, py + 22); ctx.stroke()
  }

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas || !canvasImgRef.current) return
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height

    // دعم اللمس والنقر
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    const px = (clientX - rect.left)  * scaleX
    const py = (clientY - rect.top)   * scaleY
    const rx = px / canvas.width
    const ry = py / canvas.height

    setForm((f) => ({ ...f, name_position_x: rx, name_position_y: ry }))
    setMarkerPos({ px: { x: px, y: py }, ratio: { x: rx, y: ry } })
    drawMarker(canvas.getContext('2d'), px, py, canvas.width, canvas.height)
  }

  // ─── File pickers ─────────────────────────────────────────────────────────
  const handleImageFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setForm((f) => ({ ...f, image_name: file.name, name_position_x: null, name_position_y: null }))
    setImagePreview(URL.createObjectURL(file))
    setMarkerPos(null)
  }

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setForm((f) => ({ ...f, video_name: file.name }))
  }

  const handleThumbnailFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setForm((f) => ({ ...f, thumbnail_name: file.name }))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.type !== 'video' && !imageFile && !editTemplate?.image_url)
      return setError('يرجى رفع صورة')
    if (form.type === 'video' && !videoFile && !editTemplate?.video_url)
      return setError('يرجى رفع ملف فيديو')

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
      if (imageFile) {
        const { publicUrl, fileName } = await uploadFile(imageFile, 'images')
        payload.image_url  = publicUrl
        payload.image_name = fileName.split('/').pop()
      } else {
        payload.image_url  = editTemplate?.image_url  ?? null
        payload.image_name = form.image_name || editTemplate?.image_name || ''
      }
      if (videoFile) {
        const { publicUrl, fileName } = await uploadFile(videoFile, 'videos')
        payload.video_url  = publicUrl
        payload.video_name = fileName.split('/').pop()
      } else {
        payload.video_url  = editTemplate?.video_url  ?? null
        payload.video_name = form.video_name || editTemplate?.video_name || null
      }
      if (thumbnailFile) {
        const { publicUrl, fileName } = await uploadFile(thumbnailFile, 'thumbnails')
        payload.thumbnail_url  = publicUrl
        payload.thumbnail_name = fileName.split('/').pop()
      } else {
        payload.thumbnail_url  = editTemplate?.thumbnail_url  ?? null
        payload.thumbnail_name = form.thumbnail_name || editTemplate?.thumbnail_name || null
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

  // ─── Shared input classes ─────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ─── Modal Container ─── */}
      {/* موبايل: bottom sheet يرتفع من الأسفل
          ديسكتوب: نافذة مركزية */}
      <div className="relative w-full sm:max-w-2xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800 overflow-hidden">

        {/* مقبض السحب — موبايل فقط */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        {/* ─── Header ─── */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            {editTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Form — قابل للتمرير ─── */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-5"
        >

          {/* نوع القالب */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
              نوع القالب
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { value: 'image',          label: 'صورة',    icon: '🖼️' },
                { value: 'imageWithPhoto', label: 'مع صورة', icon: '👤' },
                { value: 'video',          label: 'فيديو',   icon: '🎬' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    form.type === t.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="text-xl sm:text-2xl">{t.icon}</span>
                  <span className={`text-xs sm:text-sm font-semibold ${
                    form.type === t.value ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
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
              <label className="flex flex-col items-center justify-center gap-2 w-full h-28 sm:h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800 active:bg-gray-100">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center px-2">
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
              <label className="flex flex-col items-center justify-center gap-2 w-full h-28 sm:h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800 active:bg-gray-100">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center px-2">
                  {videoFile ? videoFile.name : 'اضغط لاختيار فيديو (MP4, MOV)'}
                </span>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />
              </label>
            </div>
          )}

          {/* غلاف الفيديو (Thumbnail) */}
          {needsVideo && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                صورة الغلاف {editTemplate ? '(اتركها فارغة للإبقاء على الحالية)' : '(اختياري)'}
              </label>
              <label className="flex flex-col items-center justify-center gap-2 w-full h-28 sm:h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800 active:bg-gray-100">
                {thumbnailFile ? (
                  <img
                    src={URL.createObjectURL(thumbnailFile)}
                    alt="غلاف"
                    className="h-full w-full object-cover rounded-xl"
                  />
                ) : editTemplate?.thumbnail_url ? (
                  <img
                    src={editTemplate.thumbnail_url}
                    alt="غلاف"
                    className="h-full w-full object-cover rounded-xl"
                  />
                ) : (
                  <>
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center px-2">
                      اضغط لاختيار صورة غلاف الفيديو
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailFile} />
              </label>
            </div>
          )}

          {/* Canvas موضع الاسم */}
          {needsImage && imagePreview && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                موضع الاسم
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 mr-2">
                  (اضغط على الصورة لتحديد الموضع)
                </span>
              </label>
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onTouchEnd={handleCanvasClick}
                  className="w-full cursor-crosshair block touch-none"
                  style={{ maxHeight: '360px' }}
                />
              </div>
              {form.name_position_x != null && (
                <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 font-medium">
                  ✓ الموضع: X = {(form.name_position_x * 100).toFixed(1)}%،
                  Y = {(form.name_position_y * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {/* وقت ظهور النص */}
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
              className={inputCls}
            />
          </div>

          {/* is_premium */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_premium: !f.is_premium }))}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                form.is_premium ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                form.is_premium ? 'right-1' : 'left-1'
              }`} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              قالب مدفوع (Premium)
            </span>
          </div>

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

          {/* ─── أزرار الحفظ / الإلغاء ─── */}
          <div className="flex items-center gap-2.5 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
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
