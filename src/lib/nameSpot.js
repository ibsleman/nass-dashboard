// أين يجلس الاسم على قالب قديم — نقلٌ حرفي لـ`LegacyImageAnalysis` و`LegacyProjectBuilder.nameLayer` من التطبيق.
// ما يراه المشرف هنا هو ما يراه المستخدم في المحرر: نفس الشبكة 108×192، نفس العتبات، نفس الصندوق والحبر.
// أي تعديل في التطبيق يُنقل هنا، والاختبارات منسوخة من LegacyBridgeTests.

export const GRID_W = 108
export const GRID_H = 192
/** المكان المفضّل إن تعادلت المواضع: الثلث السفلي حيث يوقّع الناس التهاني */
export const PREFERRED_Y = 0.82
export const DARK_INK = '#18140F'
export const LIGHT_INK = '#FFFFFF'
export const NAME_FONT = 'Tajawal'
const NAME_BASE_SIZE = 76

/** شبكة سطوع وشفافية من بكسلات RGBA (غير مضروبة بالشفافية، كما يعطيها المتصفح) */
export function grid({ width, height, data }) {
  const n = width * height
  const lum = new Float32Array(n)
  const alpha = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255
    alpha[i] = a
    if (a <= 0.01) continue
    lum[i] = Math.min(1, (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255)
  }
  return { width, height, lum, alpha }
}

/**
 * تصغير بمتوسط كل كتلة، واللون موزون بالشفافية — كما يرسم CoreGraphics الصورة على الشبكة.
 * تصغير المتصفح نفسه (drawImage) غيّر التخمين في قالبين من 14 عند المقارنة بالتطبيق؛ المتوسط طابقها كلها.
 */
export function downsampleRGBA({ width, height, data }, outW, outH) {
  const out = new Uint8ClampedArray(outW * outH * 4)
  const sx = width / outW, sy = height / outH
  for (let y = 0; y < outH; y++) {
    const ya = Math.floor(y * sy), yb = Math.max(ya + 1, Math.floor((y + 1) * sy))
    for (let x = 0; x < outW; x++) {
      const xa = Math.floor(x * sx), xb = Math.max(xa + 1, Math.floor((x + 1) * sx))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let yy = ya; yy < yb; yy++) {
        for (let xx = xa; xx < xb; xx++) {
          const i = (yy * width + xx) * 4, al = data[i + 3] / 255
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; n++
        }
      }
      const o = (y * outW + x) * 4
      out[o] = a ? r / a : 0
      out[o + 1] = a ? g / a : 0
      out[o + 2] = a ? b / a : 0
      out[o + 3] = (a / n) * 255
    }
  }
  return { width: outW, height: outH, data: out }
}

/** شبكة من صورة أو إطار فيديو محمّل (يتطلب CORS مفتوحاً — الـCDN يسمح) */
export function gridFromSource(source) {
  const w = source.naturalWidth || source.videoWidth || source.width
  const h = source.naturalHeight || source.videoHeight || source.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)
  return grid(downsampleRGBA(ctx.getImageData(0, 0, w, h), GRID_W, GRID_H))
}

const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const midY = (r) => r.y + r.height / 2

/** صندوق نافذة الصورة (البكسلات الشفافة) بنسب 0…1 — `null` إن كانت الصورة معتمة */
export function transparentBounds(g, threshold = 0.5) {
  let minX = g.width, minY = g.height, maxX = -1, maxY = -1, count = 0
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.alpha[y * g.width + x] >= threshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      count++
    }
  }
  // أقل من 2% من المساحة = حواف مضغوطة لا نافذة
  if (count === 0 || count / (g.width * g.height) < 0.02) return null
  return { x: minX / g.width, y: minY / g.height, width: (maxX - minX + 1) / g.width, height: (maxY - minY + 1) / g.height }
}

const spotOf = (centerY, isBrightBehind, extra = {}) => ({ centerY, isBrightBehind, box: null, centerX: 0.5, width: 0.72, ...extra })

/** `point`: مكان ضبطه المشرف — يغلب التخمين دائماً */
export function nameSpot(g, window, point = null) {
  if (point) return spot(g, point, window)
  const p = pill(g, window)
  if (p) return pillSpot(p)
  return calmestBand(g, window)
}

// على الحبة المصمتة الحد أدنى (0.48): الذهبي المتوسط يقرأ الداكن أوضح من الأبيض
const pillSpot = (p) => spotOf(midY(p.rect), p.mean > 0.48, { box: p.rect })

/** ضغطة على حبة المصمم ⇒ الحبة بمقاسها؛ وإلا صندوق عريض حول النقطة لا يتجاوز حافة القالب */
function spot(g, point, window) {
  // ±2% رأسياً: الضغطة على حبة رفيعة تقع غالباً على حافتها
  const p = pill(g, window, point.y)
  if (p) {
    const r = p.rect
    if (point.x >= r.x && point.x < r.x + r.width && point.y >= r.y - 0.02 && point.y < r.y + r.height + 0.02) return pillSpot(p)
  }
  // لا أضيق من 20%: ضغطة ملاصقة للحافة لا تصغّر الاسم إلى حرف
  const width = Math.max(0.2, Math.min(0.72, 2 * Math.min(point.x, 1 - point.x)))
  const area = { x: point.x - width / 2, y: point.y - 0.04, width, height: 0.08 }
  return spotOf(point.y, (meanLuminance(g, area) ?? 0) > 0.6, { centerX: point.x, width })
}

/** متوسط سطوع الخلايا المعتمة داخل صندوق بنسب 0…1 — `null` إن كان كله شفافاً */
export function meanLuminance(g, r) {
  const x0 = Math.max(0, Math.trunc(r.x * g.width)), x1 = Math.min(g.width - 1, Math.trunc((r.x + r.width) * g.width))
  const y0 = Math.max(0, Math.trunc(r.y * g.height)), y1 = Math.min(g.height - 1, Math.trunc((r.y + r.height) * g.height))
  if (x0 > x1 || y0 > y1) return null
  let sum = 0, count = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * g.width + x
      if (g.alpha[i] >= 0.5) { sum += g.lum[i]; count++ }
    }
  }
  return count > 0 ? sum / count : null
}

/** حبة الاسم: مستطيل موحّد اللون، عرضه 22–78% وفي منتصف العرض، ارتفاعه 1.5–7%، يختلف عمّا حوله من الجهات الأربع */
export function pill(g, window, targetY = PREFERRED_Y) {
  const w = g.width, h = g.height, L = g.lum, A = g.alpha
  const runs = []
  for (let y = Math.trunc(h * 0.08); y < Math.trunc(h * 0.97); y++) {
    let bestStart = 0, bestLen = 1, start = 0
    for (let x = 1; x < w; x++) {
      const i = y * w + x, p = i - 1
      const uniform = A[i] >= 0.5 && A[p] >= 0.5 && Math.abs(L[i] - L[p]) < 0.035
      if (!uniform) start = x
      if (x - start + 1 > bestLen) { bestLen = x - start + 1; bestStart = start }
    }
    const x0 = bestStart, x1 = bestStart + bestLen - 1
    const width = bestLen / w, center = (x0 + x1) / 2 / w
    if (!(width >= 0.22 && width <= 0.78 && Math.abs(center - 0.5) < 0.12)) continue
    let sum = 0
    for (let x = x0; x <= x1; x++) sum += L[y * w + x]
    const mean = sum / bestLen
    const left = L[y * w + Math.max(0, x0 - 2)], right = L[y * w + Math.min(w - 1, x1 + 2)]
    if (!(Math.abs(left - mean) > 0.12 && Math.abs(right - mean) > 0.12)) continue
    runs.push({ y, x0, x1, mean })
  }

  // صفوف متتالية بنفس الامتداد واللون = حبة واحدة
  const groups = []
  for (const run of runs) {
    const last = groups[groups.length - 1]
    const prev = last && last[last.length - 1]
    if (prev && run.y === prev.y + 1 && Math.abs(run.x0 - prev.x0) <= 4 && Math.abs(run.x1 - prev.x1) <= 4 && Math.abs(run.mean - prev.mean) < 0.08) last.push(run)
    else groups.push([run])
  }

  const maxRows = Math.max(3, Math.trunc(h * 0.07))
  // أقل من 1.5% من الارتفاع خطٌّ فاصل لا حبة
  const minRows = Math.max(2, Math.ceil(h * 0.015))
  let best = null
  for (const group of groups) {
    if (group.length < minRows || group.length > maxRows) continue
    const y0 = group[0].y, y1 = group[group.length - 1].y
    const x0 = Math.min(...group.map((r) => r.x0)), x1 = Math.max(...group.map((r) => r.x1))
    const mean = group.reduce((s, r) => s + r.mean, 0) / group.length
    // محدودة من الأعلى والأسفل أيضاً — لا شريط خلفية ممتد
    const cx = Math.trunc((x0 + x1) / 2)
    const above = L[Math.max(0, y0 - 2) * w + cx], below = L[Math.min(h - 1, y1 + 2) * w + cx]
    if (!(Math.abs(above - mean) > 0.12 && Math.abs(below - mean) > 0.12)) continue
    const rect = { x: x0 / w, y: y0 / h, width: (x1 - x0 + 1) / w, height: (y1 - y0 + 1) / h }
    if (window && intersects(window, rect)) continue
    const distance = Math.abs(midY(rect) - targetY)
    if (!best || distance < best.distance) best = { rect, mean, distance }
  }
  return best ? { rect: best.rect, mean: best.mean } : null
}

/** أهدأ شريط (أقل تباين وحواف) هو أبعد مكان عن الزخرفة والكتابة المرسومة */
export function calmestBand(g, window) {
  const bandRows = Math.max(3, Math.round(g.height * 0.08))
  const x0 = Math.trunc(g.width * 0.2), x1 = Math.trunc(g.width * 0.8)
  const first = Math.trunc(g.height * 0.10), last = Math.trunc(g.height * 0.93) - bandRows
  const L = g.lum, A = g.alpha, W = g.width
  let best = null
  for (let top = first; top <= last; top++) {
    const values = []
    let gradient = 0, transparent = 0
    for (let y = top; y < top + bandRows; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x
        if (A[i] < 0.5) { transparent++; continue }
        values.push(L[i])
        // الحواف أفقياً ورأسياً: سطور النص والزخرفة الرفيعة تُرى هنا لا في التباين وحده
        if (x > x0 && A[i - 1] >= 0.5) gradient += Math.abs(L[i] - L[i - 1])
        if (y > top && A[i - W] >= 0.5) gradient += Math.abs(L[i] - L[i - W])
      }
    }
    // الشريط فوق نافذة الصورة: محتواه صورة المستخدم المجهولة — لا يصلح للاسم
    const total = bandRows * (x1 - x0)
    if (!(transparent / total < 0.3 && values.length > Math.trunc(total / 2))) continue
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length
    const center = (top + bandRows / 2) / g.height
    const score = Math.sqrt(variance) + 1.5 * gradient / values.length + 0.15 * Math.abs(center - PREFERRED_Y)
    if (!best || score < best.score) best = { score, top, mean }
  }
  if (!best) return spotOf(0.88, false)
  return spotOf((best.top + bandRows / 2) / g.height, best.mean > 0.6)
}

/** نفس محرك ملاءمة الخانات: أكبر حجم يتسع في سطر واحد، بدقة نصف نقطة */
export function fitFontSize(text, boxWidth, boxHeight, measure, { base, min, lineHeight }) {
  const width = boxWidth * 0.98, height = boxHeight * 0.98
  const fits = (s) => measure(text, s) <= width && s * lineHeight <= height
  if (!text || fits(base)) return base
  const floor = Math.min(min, base)
  if (!fits(floor)) return floor
  let low = floor, high = base
  while (high - low > 0.5) {
    const mid = (low + high) / 2
    if (fits(mid)) low = mid
    else high = mid
  }
  return Math.floor(low * 2) / 2
}

/** الاسم كما يرسمه المحرر: صندوقه ومركزه وحجم خطه وحبره، بإحداثيات القالب الأصلية */
export function nameLayout(s, canvasW, canvasH, text, measure, lineHeight = 1.2) {
  const pillBox = s.box ? { x: s.box.x * canvasW, y: s.box.y * canvasH, w: s.box.width * canvasW, h: s.box.height * canvasH } : null
  const width = pillBox ? pillBox.w * 0.9 : canvasW * s.width
  const height = pillBox ? Math.max(pillBox.h * 0.92, 40) : canvasH * 0.08
  const cx = pillBox ? pillBox.x + pillBox.w / 2 : canvasW * s.centerX
  const cy = pillBox ? pillBox.y + pillBox.h / 2 : canvasH * s.centerY
  const padding = pillBox ? 4 : 16
  const fontSize = fitFontSize(text, width - padding, height - padding, measure, { base: NAME_BASE_SIZE, min: pillBox ? 22 : 36, lineHeight })
  return { cx, cy, width, height, fontSize, ink: s.isBrightBehind ? DARK_INK : LIGHT_INK, shadow: !s.isBrightBehind }
}

/** صفّ القالب بعد وضع الاسم — `updated_at` يُرفع كي تلتقطه الأجوال في مزامنتها التالية (المزامنة بالفرق عليه) */
export function placementPayload(point, now = new Date()) {
  const clamp = (v) => Math.min(1, Math.max(0, v))
  return {
    name_position_x: point ? clamp(point.x) : null,
    name_position_y: point ? clamp(point.y) : null,
    updated_at: now.toISOString(),
  }
}

/** المكان صالح كما يقبله التطبيق: الإحداثيان معاً وداخل 0…1 */
export function hasSpot(t) {
  const x = t.name_position_x, y = t.name_position_y
  return typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1
}

/** الدفعة: بلا مكان أولاً، بترتيب المناسبات، والأحدث أولاً داخل المناسبة؛ ثم المضبوطة */
export function placementQueue(templates, categoryOrder) {
  const rank = (c) => { const i = categoryOrder.indexOf(c); return i === -1 ? categoryOrder.length : i }
  return templates
    .map((t) => ({ ...t, _placed: hasSpot(t) }))
    .sort((a, b) => (a._placed - b._placed) || (rank(a.category) - rank(b.category)) || String(b.created_at).localeCompare(String(a.created_at)))
}
