import { describe, it, expect } from 'vitest'
import {
  periodRange, fillDays, exportRate, byOccasion, idleTemplates, topWithRate,
  bestWindow, hourLabel, versionShares, subscriptionSummary, deltaText,
} from './numbers'

const at = (s) => new Date(`${s}T12:00:00`)
const t = (id, category, extra = {}) => ({
  id, category, type: 'image', is_premium: false, is_visible: true,
  image_url: `https://cdn/${id}.png`, thumbnail_url: null, created_at: '2026-05-01T00:00:00Z', ...extra,
})

describe('periods', () => {
  it('7 days ends now and starts at the start of the 7th day back; the previous period has the same length', () => {
    const r = periodRange(7, at('2026-10-29'))
    expect(r.from.toDateString()).toBe(new Date('2026-10-23T00:00:00').toDateString())
    expect(r.from.getHours()).toBe(0)
    expect(r.prevFrom.toDateString()).toBe(new Date('2026-10-16T00:00:00').toDateString())
    expect(r.prevTo.getTime()).toBe(r.from.getTime())
  })

  it('fills the days nobody opened the app with zeros', () => {
    const r = periodRange(4, at('2026-10-29'))
    const days = fillDays([{ day: '2026-10-27', devices: 5, opens: 7, exports: 3, views: 9 }], r.from, 4)
    expect(days.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'])
    expect(days.map((d) => d.exports)).toEqual([0, 3, 0, 0])
  })

  it('says how a number moved against the previous period', () => {
    expect(deltaText(120, 100)).toEqual({ text: '+20%', up: true })
    expect(deltaText(75, 100)).toEqual({ text: '−25%', up: false })
    expect(deltaText(5, 0)).toBeNull()
  })
})

describe('export rate', () => {
  it('share of people (sessions) who viewed and then exported', () => {
    expect(exportRate(25, 100)).toBe(25)
    expect(exportRate(1, 3)).toBe(33)
    expect(exportRate(5, 0)).toBeNull()
  })
  it('never above 100% (an export without a recorded view comes from older app versions)', () => {
    expect(exportRate(12, 10)).toBe(100)
  })
})

describe('by occasion', () => {
  const overview = [t('a', 'ramadan'), t('b', 'ramadan'), t('c', 'eidAlAdha'), t('d', 'marriage', { is_visible: false })]
  const stats = [
    { template_id: 'a', views: 100, exports: 30, viewers: 80, exporters: 20 },
    { template_id: 'b', views: 50, exports: 40, viewers: 40, exporters: 30 },
    { template_id: 'c', views: 10, exports: 1, viewers: 10, exporters: 1 },
    { template_id: 'x', views: 9, exports: 9, viewers: 9, exporters: 9 },
  ]

  it('sums exports and views per occasion, most exported first, cover from its best template', () => {
    const r = byOccasion(stats, overview)
    expect(r.map((o) => [o.key, o.exports, o.views, o.templates, o.rate])).toEqual([['ramadan', 70, 150, 2, 42], ['eidAlAdha', 1, 10, 1, 10]])
    expect(r[0].cover).toBe('https://cdn/b.png')
    expect(r[0].label).toBe('رمضان')
  })
})

describe('templates', () => {
  const overview = [
    t('old-idle', 'ramadan', { created_at: '2026-01-01T00:00:00Z' }),
    t('new-idle', 'ramadan', { created_at: '2026-10-28T00:00:00Z' }),
    t('busy', 'ramadan'),
    t('hidden', 'ramadan', { is_visible: false }),
  ]
  const stats = [{ template_id: 'busy', views: 40, exports: 10, viewers: 30, exporters: 9 }, { template_id: 'old-idle', views: 12, exports: 0, viewers: 12, exporters: 0 }]

  it('idle = visible, older than the period, and nobody exported it in the period', () => {
    const r = idleTemplates(stats, overview, new Date('2026-10-01T00:00:00Z'))
    expect(r.map((x) => x.id)).toEqual(['old-idle'])
    expect(r[0].views).toBe(12)
  })

  it('top templates carry their export rate', () => {
    const r = topWithRate(stats, overview, 5)
    expect(r.map((x) => [x.id, x.exports, x.rate])).toEqual([['busy', 10, 30]])
  })
})

describe('best time to reach people', () => {
  it('finds the busiest two-hour window', () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, opens: h === 20 ? 90 : h === 21 ? 80 : h === 9 ? 85 : 10 }))
    expect(bestWindow(hours)).toMatchObject({ start: 20, end: 22 })
    expect(bestWindow(hours).share).toBe(Math.round((170 / hours.reduce((s, x) => s + x.opens, 0)) * 100))
  })

  it('wraps around midnight', () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, opens: h === 23 || h === 0 ? 50 : 1 }))
    expect(bestWindow(hours)).toMatchObject({ start: 23, end: 1 })
  })

  it('names hours the way people say them', () => {
    expect(hourLabel(20)).toBe('8 مساءً')
    expect(hourLabel(9)).toBe('9 صباحاً')
    expect(hourLabel(12)).toBe('12 ظهراً')
    expect(hourLabel(16)).toBe('4 عصراً')
    expect(hourLabel(0)).toBe('12 ليلاً')
  })
})

describe('app versions', () => {
  it('newest version first with its share of devices', () => {
    const r = versionShares([{ app_version: '1.2.1', devices: 70 }, { app_version: '2.0', devices: 30 }, { app_version: '1.10', devices: 0 }])
    expect(r.map((v) => [v.version, v.share])).toEqual([['2.0', 30], ['1.10', 0], ['1.2.1', 70]])
  })
})

describe('subscriptions', () => {
  it('counts active plans and estimates the monthly amount before Apple’s cut', () => {
    const s = subscriptionSummary([
      { product_id: 'com.nass.premium.weekly', active: 2 },
      { product_id: 'com.nass.premium.monthly', active: 3 },
      { product_id: 'com.nass.premium.yearly', active: 12 },
    ])
    expect(s.total).toBe(17)
    expect(s.plans.map((p) => [p.label, p.count])).toEqual([['سنوي', 12], ['شهري', 3], ['أسبوعي', 2]])
    // 2×1.49×52/12 + 3×3.99 + 12×19.99/12
    expect(s.monthly).toBeCloseTo(2 * 1.49 * 52 / 12 + 3 * 3.99 + 19.99 * 12 / 12, 2)
  })

  it('no subscribers', () => {
    expect(subscriptionSummary([])).toMatchObject({ total: 0, monthly: 0 })
  })
})
