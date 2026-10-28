// صور مصغّرة للقوالب. القالب الأصلي ~1.3 م.ب، واللوحة وشبكات التطبيق (MediaService.loadImage يقرأ
// thumbnail_url أولاً) كانت تحمّله كاملاً لكل بطاقة. المصغّرة تُصنع في المتصفح عند الرفع، ومرة واحدة للقديم.
// المحرر لا يتأثر: يفتح الأصل (image_url) دائماً.

/** عرض يكفي خلية الشبكة على آيفون @3x والآيباد @2x */
export const THUMB_MAX_W = 600
const THUMB_MAX_H = 1200

export function thumbSize(w, h) {
  const k = Math.min(1, THUMB_MAX_W / w, THUMB_MAX_H / h)
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

/** إطار بنافذة صورة (PNG شفاف) يبقى شفافاً — حافة شبه معتمة من الضغط لا تُعدّ شفافية */
export function hasAlpha({ data }) {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
  return false
}

const fileOf = (url) => { try { return new URL(url).pathname.split('/').pop() } catch { return url } }

/** يحتاج مصغّرة: صورة بلا مصغّرة خاصة بها (أو مصغّرتها نسخة الأصل نفسها)، أو فيديو بلا غلاف */
export function needsThumbnail(t) {
  if (t.type === 'video') return !!t.video_url && !t.thumbnail_url
  if (!t.image_url) return false
  return !t.thumbnail_url || fileOf(t.thumbnail_url) === fileOf(t.image_url)
}

/**
 * يصنع المصغّرات واحدة بعد واحدة (الشبكة والذاكرة تحتملان ذلك) ويكمل بعد أي قالب متعثّر.
 * `make(t) → blob`، `upload(blob, t) → url`، `save(t, url)`؛ `signal` يوقف بين قالبين.
 */
export async function backfillThumbnails(templates, { make, upload, save, onProgress, signal }) {
  let done = 0
  const failed = []
  for (const t of templates) {
    if (signal?.aborted) break
    try {
      const blob = await make(t)
      const url = await upload(blob, t)
      await save(t, url)
      done++
    } catch (e) {
      failed.push({ id: t.id, error: e.message })
    }
    onProgress?.({ done, failed: failed.length, total: templates.length })
  }
  return { done, failed }
}

// ─── المتصفح ─────────────────────────────────────────────────────────────────

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** يرسم المصدر بمقاس المصغّرة: JPEG للمعتم، وWebP (أو PNG حيث لا يُرمَّز WebP) لما فيه شفافية */
export async function thumbnailFromSource(source, srcW, srcH) {
  const { w, h } = thumbSize(srcW, srcH)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  if (!hasAlpha(ctx.getImageData(0, 0, w, h))) return canvasBlob(canvas, 'image/jpeg', 0.84)
  const webp = await canvasBlob(canvas, 'image/webp', 0.86)
  return webp && webp.type === 'image/webp' ? webp : canvasBlob(canvas, 'image/png')
}

export async function thumbnailFromFile(file) {
  const bitmap = await createImageBitmap(file)
  try {
    return await thumbnailFromSource(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close?.()
  }
}

export function thumbnailFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => thumbnailFromSource(img, img.naturalWidth, img.naturalHeight).then(resolve, reject)
    img.onerror = () => reject(new Error('تعذّر تحميل صورة القالب'))
    img.src = url
  })
}

/** غلاف قالب الفيديو: الإطار لحظة ظهور الاسم (أو الثانية الأولى) */
export function thumbnailFromVideo(src, atSeconds = 1) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onerror = () => reject(new Error('تعذّر تحميل فيديو القالب'))
    v.onloadedmetadata = () => { v.currentTime = Math.max(0, Math.min(Number(atSeconds) || 1, (v.duration || 2) - 0.1)) }
    v.onseeked = () => {
      thumbnailFromSource(v, v.videoWidth, v.videoHeight).then(resolve, reject).finally(() => {
        v.removeAttribute('src')
        v.load()
      })
    }
    v.src = typeof src === 'string' ? src : URL.createObjectURL(src)
  })
}

/** ملف باسم وامتداد يطابقان نوع المصغّرة — uploadFile يأخذ الامتداد من الاسم */
export function thumbnailFile(blob) {
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  return new File([blob], `thumb.${ext}`, { type: blob.type })
}

/**
 * مصغّرة لملف يُرفع الآن، مرفوعة إلى مجلد thumbnails — `null` إن تعذّرت (لا تمنع حفظ القالب).
 * الاستيراد متأخر كي يبقى هذا الملف خالصاً في الاختبارات.
 */
export async function autoThumbnail({ imageFile, videoFile, appearTime }) {
  try {
    const blob = imageFile ? await thumbnailFromFile(imageFile) : videoFile ? await thumbnailFromVideo(videoFile, appearTime ?? 1) : null
    if (!blob) return null
    const { uploadFile } = await import('./supabase')
    return (await uploadFile(thumbnailFile(blob), 'thumbnails')).publicUrl
  } catch {
    return null
  }
}
