import { describe, it, expect } from 'vitest'
import {
  grid, downsampleRGBA, transparentBounds, nameSpot, nameLayout, fitFontSize,
  placementPayload, placementQueue, PREFERRED_Y,
} from './nameSpot'

// نفس عيّنات اختبارات التطبيق (LegacyBridgeTests) — ما يقرره التطبيق تقرره اللوحة

/** صورة RGBA بإحداثيات «من الأعلى»؛ `band(top, bottom)` شريط بعرض الصورة */
function synthetic(draw, w = 108, h = 192) {
  const data = new Uint8ClampedArray(w * h * 4)
  const fill = (x0, y0, x1, y1, gray, alpha = 1) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) {
        const i = (y * w + x) * 4
        data[i] = data[i + 1] = data[i + 2] = Math.round(gray * 255)
        data[i + 3] = Math.round(alpha * 255)
      }
    }
  }
  const band = (top, bottom) => ({ x0: 0, y0: h * top, x1: w, y1: h * bottom })
  const api = {
    w, h, band,
    fill: (r, gray) => fill(r.x0, r.y0, r.x1, r.y1, gray, 1),
    clear: (r) => fill(r.x0, r.y0, r.x1, r.y1, 0, 0),
    // ضجيج رقعة شطرنج بخلايا 2px — تباين عالٍ (زخرفة/كتابة)
    noise: (r) => {
      for (let y = Math.floor(r.y0); y < Math.ceil(r.y1); y += 2)
        for (let x = Math.floor(r.x0); x < Math.ceil(r.x1); x += 2)
          fill(x, y, x + 2, y + 2, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? 0.05 : 0.95)
    },
    rect: (x0, y0, x1, y1, gray) => fill(x0, y0, x1, y1, gray),
  }
  draw(api)
  return { width: w, height: h, data }
}

/** تصغير بمتوسط الخلايا — مثل رسم الصورة على شبكة 108×192 في التطبيق */
function downsample(img, w = 108, h = 192) {
  const out = new Uint8ClampedArray(w * h * 4)
  const sx = img.width / w, sy = img.height / h
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0, 0]; let n = 0
    for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
      for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
        const i = (yy * img.width + xx) * 4
        for (let c = 0; c < 4; c++) acc[c] += img.data[i + c]
        n++
      }
    const o = (y * w + x) * 4
    for (let c = 0; c < 4; c++) out[o + c] = acc[c] / n
  }
  return { width: w, height: h, data: out }
}

const pillImage = (top, bottom) => synthetic((s) => {
  s.fill(s.band(0, 1), 0.12)
  s.rect(s.w * 0.3, s.h * top, s.w * 0.7, s.h * bottom, 0.97)
})

describe('downsample — the grid is read like CoreGraphics draws it', () => {
  it('averages each block, weighting colour by opacity', () => {
    // 2×2 → 1×1: بكسلان أبيضان معتمان وبكسلان شفافان (لونهما أسود لا يُحسب)
    const img = { width: 2, height: 2, data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0]) }
    const out = downsampleRGBA(img, 1, 1)
    expect(Array.from(out.data)).toEqual([255, 255, 255, 128])
  })

  it('exact multiples become plain block means (1080×1920 → 108×192)', () => {
    const w = 20, h = 20, data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) { const v = (i % w) < 10 ? 0 : 200; data.set([v, v, v, 255], i * 4) }
    const out = downsampleRGBA({ width: w, height: h, data }, 2, 2)
    expect(Array.from(out.data)).toEqual([0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255])
  })
})

describe('nameSpot — guess', () => {
  it('goes to the calmest band, not over decoration', () => {
    const img = synthetic((s) => { s.noise(s.band(0, 1)); s.fill(s.band(0.76, 0.86), 0.5) })
    const spot = nameSpot(grid(img), null)
    expect(spot.centerY).toBeGreaterThan(0.76)
    expect(spot.centerY).toBeLessThan(0.86)
  })

  it("sits on the designer's pill", () => {
    const img = synthetic((s) => {
      s.fill(s.band(0, 1), 0.12)
      s.noise(s.band(0.1, 0.45))
      s.rect(s.w * 0.3, s.h * 0.90, s.w * 0.7, s.h * 0.935, 0.97)
    })
    const spot = nameSpot(grid(img), null)
    expect(spot.box).toBeTruthy()
    expect(Math.abs(spot.centerY - 0.9175)).toBeLessThan(0.02)
    expect(Math.abs(spot.box.width - 0.4)).toBeLessThan(0.08)
    expect(spot.isBrightBehind).toBe(true)
  })

  it('does not take a full-width band for a pill', () => {
    const img = synthetic((s) => { s.fill(s.band(0, 1), 0.12); s.fill(s.band(0.9, 0.935), 0.97) })
    expect(nameSpot(grid(img), null).box).toBeNull()
  })

  it('does not write over thin lines of text', () => {
    const img = synthetic((s) => {
      s.fill(s.band(0, 1), 0.35)
      for (let line = 0; line < 3; line++) {
        const r = s.band(0.80 + line * 0.035, 0.80 + line * 0.035 + 0.006)
        for (let x = r.x1 * 0.25; x < r.x1 * 0.75; x += 6) s.rect(x, r.y0, x + 3, r.y1, 1)
      }
    }, 216, 384)
    const spot = nameSpot(grid(downsample(img)), null)
    expect(spot.centerY < 0.79 || spot.centerY > 0.91).toBe(true)
  })

  it('picks the ink from the brightness behind', () => {
    const white = synthetic((s) => s.fill(s.band(0, 1), 1))
    const black = synthetic((s) => s.fill(s.band(0, 1), 0))
    expect(nameSpot(grid(white), null).isBrightBehind).toBe(true)
    expect(nameSpot(grid(black), null).isBrightBehind).toBe(false)
  })

  it('falls back to the preferred third when nothing is found', () => {
    expect(PREFERRED_Y).toBe(0.82)
  })
})

describe('transparentBounds — the photo window of a frame', () => {
  it('finds the window', () => {
    const img = synthetic((s) => { s.fill(s.band(0, 1), 0.4); s.clear(s.band(0, 0.5)) })
    const hole = transparentBounds(grid(img))
    expect(hole.y).toBeLessThan(0.03)
    expect(Math.abs(hole.y + hole.height - 0.5)).toBeLessThan(0.04)
    expect(hole.width).toBeGreaterThan(0.95)
  })

  it('an opaque image has no window', () => {
    expect(transparentBounds(grid(synthetic((s) => s.fill(s.band(0, 1), 0.4))))).toBeNull()
  })

  it('the name avoids the window', () => {
    const g = grid(synthetic((s) => { s.fill(s.band(0, 1), 0.4); s.clear(s.band(0.5, 1)) }))
    expect(nameSpot(g, transparentBounds(g)).centerY).toBeLessThan(0.5)
  })
})

describe("nameSpot — the admin's point", () => {
  it('wins over the guess and keeps the box inside the template', () => {
    const img = synthetic((s) => { s.noise(s.band(0, 1)); s.fill(s.band(0.76, 0.86), 0.5) })
    const spot = nameSpot(grid(img), null, { x: 0.3, y: 0.2 })
    expect(spot.centerY).toBeCloseTo(0.2, 3)
    expect(spot.centerX).toBeCloseTo(0.3, 3)
    expect(spot.width).toBeLessThanOrEqual(0.6 + 0.001)
    expect(spot.box).toBeNull()
  })

  it('a click near the edge never shrinks the box below 20%', () => {
    const spot = nameSpot(grid(synthetic((s) => s.fill(s.band(0, 1), 0.4))), null, { x: 0.03, y: 0.5 })
    expect(spot.width).toBeCloseTo(0.2, 5)
  })

  it('a click on the pill takes the pill', () => {
    const spot = nameSpot(grid(pillImage(0.50, 0.535)), null, { x: 0.52, y: 0.52 })
    expect(spot.box).toBeTruthy()
    expect(Math.abs(spot.centerY - 0.5175)).toBeLessThan(0.02)
    expect(Math.abs(spot.box.width - 0.4)).toBeLessThan(0.08)
    expect(spot.isBrightBehind).toBe(true)
  })

  it('takes its ink from what is behind the point, not the guess', () => {
    const g = grid(synthetic((s) => { s.fill(s.band(0, 0.5), 1); s.fill(s.band(0.5, 1), 0) }))
    expect(nameSpot(g, null, { x: 0.5, y: 0.25 }).isBrightBehind).toBe(true)
    expect(nameSpot(g, null, { x: 0.5, y: 0.75 }).isBrightBehind).toBe(false)
  })
})

describe('nameLayout — the name as the app draws it', () => {
  const measure = (text, size) => text.length * size * 0.5

  it('a free box: wide box at the spot, light ink with a shadow on dark', () => {
    const l = nameLayout({ centerY: 0.8, centerX: 0.4, width: 0.6, isBrightBehind: false, box: null }, 1080, 1920, 'محمد', measure)
    expect(l.cx).toBeCloseTo(432, 3)
    expect(l.cy).toBeCloseTo(1536, 3)
    expect(l.width).toBeCloseTo(648, 3)
    expect(l.height).toBeCloseTo(153.6, 3)
    expect(l.ink).toBe('#FFFFFF')
    expect(l.shadow).toBe(true)
    expect(l.fontSize).toBe(76)
  })

  it("on the designer's pill: 90% of its width, dark ink, no shadow", () => {
    const l = nameLayout({ centerY: 0.5, isBrightBehind: true, box: { x: 0.3, y: 0.48, width: 0.4, height: 0.04 } }, 1000, 1000, 'علي', measure)
    expect(l.cx).toBeCloseTo(500, 3)
    expect(l.width).toBeCloseTo(360, 3)
    expect(l.height).toBeCloseTo(40, 3)
    expect(l.ink).toBe('#18140F')
    expect(l.shadow).toBe(false)
  })

  it('a long name shrinks to fit, never below the floor', () => {
    const l = nameLayout({ centerY: 0.8, centerX: 0.5, width: 0.3, isBrightBehind: false, box: null }, 1080, 1920, 'أم عبدالله الشمري', measure)
    expect(l.fontSize).toBeLessThan(76)
    expect(l.fontSize).toBeGreaterThanOrEqual(36)
  })
})

describe('fitFontSize', () => {
  const measure = (text, size) => text.length * size * 0.5
  it('keeps the base size when it fits', () => {
    expect(fitFontSize('علي', 1000, 200, measure, { base: 76, min: 36, lineHeight: 1.2 })).toBe(76)
  })
  it('finds the largest size that fits, in half points', () => {
    const s = fitFontSize('abcdefghij', 300, 200, measure, { base: 76, min: 36, lineHeight: 1.2 })
    expect(s * 2 % 1).toBe(0)
    expect(measure('abcdefghij', s)).toBeLessThanOrEqual(300 * 0.98)
    expect(measure('abcdefghij', s + 0.5)).toBeGreaterThan(300 * 0.98)
  })
  it('returns the floor when even the floor overflows', () => {
    expect(fitFontSize('a'.repeat(100), 100, 200, measure, { base: 76, min: 36, lineHeight: 1.2 })).toBe(36)
  })
})

describe('placementPayload', () => {
  it('writes the point and bumps updated_at so phones pick it up in the next sync', () => {
    const now = new Date('2026-10-28T20:00:00Z')
    expect(placementPayload({ x: 0.5054, y: 0.843 }, now)).toEqual({
      name_position_x: 0.5054, name_position_y: 0.843, updated_at: '2026-10-28T20:00:00.000Z',
    })
  })
  it('clamps into 0…1 (the app ignores anything outside)', () => {
    const p = placementPayload({ x: -0.2, y: 1.4 }, new Date(0))
    expect(p.name_position_x).toBe(0)
    expect(p.name_position_y).toBe(1)
  })
  it('clearing the point sends nulls (the app goes back to guessing)', () => {
    expect(placementPayload(null, new Date(0))).toEqual({ name_position_x: null, name_position_y: null, updated_at: '1970-01-01T00:00:00.000Z' })
  })
})

describe('placementQueue', () => {
  const t = (id, category, extra = {}) => ({ id, category, type: 'image', created_at: `2026-01-0${id}T00:00:00Z`, name_position_x: null, name_position_y: null, ...extra })
  it('puts templates without a spot first, by occasion order, newest first inside one', () => {
    const q = placementQueue([
      t(1, 'marriage'), t(2, 'ramadan'), t(3, 'ramadan', { name_position_x: 0.5, name_position_y: 0.8 }), t(4, 'ramadan'),
    ], ['ramadan', 'eidAlFitr', 'marriage'])
    expect(q.map((x) => x.id)).toEqual([4, 2, 1, 3])
  })
  it('treats a half or broken spot as missing, like the app', () => {
    const q = placementQueue([t(1, 'ramadan', { name_position_x: 0.5 }), t(2, 'ramadan', { name_position_x: 1.7, name_position_y: 0.5 })], ['ramadan'])
    expect(q.every((x) => !x._placed)).toBe(true)
  })
})
