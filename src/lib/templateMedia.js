// تحميل صورة القالب (أو إطار الفيديو لحظة ظهور الاسم) وقراءتها مرة واحدة — للمتصفح فقط.
import { gridFromSource, transparentBounds, nameSpot, NAME_FONT } from './nameSpot'

const cache = new Map()

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // نفس وضع CORS في <img> العرض كي لا تُحمَّل الصورة مرتين
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve({ el: img, w: img.naturalWidth, h: img.naturalHeight, src: url })
    img.onerror = () => reject(new Error('تعذّر تحميل صورة القالب'))
    img.src = url
  })
}

/** إطار الفيديو عند `appearTime` — منه يقرأ التطبيق مكان الاسم ولونه، ولوحة الفيديو بعرض 1080 */
function loadVideoFrame(url, appearTime) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    const fail = () => reject(new Error('تعذّر تحميل فيديو القالب'))
    v.onerror = fail
    v.onloadedmetadata = () => {
      v.currentTime = Math.max(0, Math.min(Number(appearTime) || 0, (v.duration || 1) - 0.1))
    }
    v.onseeked = () => {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      c.getContext('2d').drawImage(v, 0, 0)
      const aspect = v.videoHeight / v.videoWidth
      resolve({ el: c, w: 1080, h: Math.round(1080 * aspect), src: c.toDataURL('image/jpeg', 0.85) })
      v.removeAttribute('src')
      v.load()
    }
    v.src = url
  })
}

/**
 * `{ src, w, h, grid, window, guess }` — w/h مقاس لوحة المحرر (الصورة نفسها، أو 1080 للفيديو)،
 * و`guess` ما يخمّنه التطبيق حين لا مكان مضبوط.
 */
export function analyzeTemplate(t) {
  if (cache.has(t.id)) return cache.get(t.id)
  const load = t.type === 'video'
    ? loadVideoFrame(t.video_url, t.text_appear_time)
    : loadImage(t.image_url || t.thumbnail_url)
  const p = load.then(({ el, w, h, src }) => {
    const grid = gridFromSource(el)
    const window = t.type === 'imageWithPhoto' ? transparentBounds(grid) : null
    return { src, w, h, grid, window, guess: nameSpot(grid, window) }
  })
  cache.set(t.id, p)
  p.catch(() => cache.delete(t.id))
  return p
}

let measureCtx = null
let lineRatio = 1.2

/** قياس عرض الاسم بخط التطبيق — بعد تحميل الخط، وإلا قيس ببديله */
export async function nameMeasurer() {
  try { await document.fonts.load(`700 76px ${NAME_FONT}`) } catch { /* البديل يكفي للقياس */ }
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
    measureCtx.font = `700 100px ${NAME_FONT}`
    const m = measureCtx.measureText('عبدالرحمن')
    if (m.fontBoundingBoxAscent) lineRatio = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) / 100
  }
  const measure = (text, size) => {
    measureCtx.font = `700 ${size}px ${NAME_FONT}`
    return Math.ceil(measureCtx.measureText(text).width)
  }
  return { measure, lineRatio }
}
