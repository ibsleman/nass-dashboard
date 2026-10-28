import { describe, it, expect } from 'vitest'
import {
  nextHijri, daysUntil, countdown, countAr, upcomingSeasons, seasonReadiness,
  inboxItems, bucketByDay, deltaPercent, distinctCount, topTemplates, SEASON_TARGET,
} from './today'
import { OCCASION_KEYS } from './occasions'

const day = (s) => new Date(`${s}T12:00:00`)
const t = (id, category, extra = {}) => ({
  id, category, type: 'image', is_premium: false, is_visible: true,
  image_url: `https://cdn/x/${id}.jpg`, thumbnail_url: null,
  name_position_x: null, name_position_y: null, created_at: '2026-05-01T00:00:00Z', ...extra,
})

describe('seasons by the Umm al-Qura calendar', () => {
  it('finds the next Ramadan, Eid al-Fitr and Eid al-Adha from today', () => {
    const today = day('2026-10-28')
    expect(nextHijri(today, 9, 1).toDateString()).toBe(day('2027-02-08').toDateString())
    expect(nextHijri(today, 10, 1).toDateString()).toBe(day('2027-03-09').toDateString())
    expect(nextHijri(today, 12, 10).toDateString()).toBe(day('2027-05-16').toDateString())
  })

  it('counts whole calendar days', () => {
    expect(daysUntil(day('2026-10-28'), day('2027-02-08'))).toBe(103)
    expect(daysUntil(day('2026-10-28'), day('2026-10-28'))).toBe(0)
  })

  it('orders the seasons by how soon they come', () => {
    const s = upcomingSeasons([], day('2026-10-28'))
    expect(s.map((x) => x.key)).toEqual(['ramadan', 'eidAlFitr', 'eidAlAdha'])
    expect(s.map((x) => x.days)).toEqual([103, 132, 200])
  })

  it('during Ramadan the next Ramadan is a year away and Eid comes first', () => {
    const s = upcomingSeasons([], day('2027-02-20'))
    expect(s[0].key).toBe('eidAlFitr')
  })
})

describe('Arabic counting', () => {
  it('days for the countdown', () => {
    expect(countdown(0)).toBe('اليوم')
    expect(countdown(1)).toBe('غداً')
    expect(countdown(2)).toBe('بعد يومين')
    expect(countdown(7)).toBe('بعد 7 أيام')
    expect(countdown(45)).toBe('بعد 45 يوماً')
    expect(countdown(103)).toBe('بعد 103 أيام')
    expect(countdown(200)).toBe('بعد 200 يوم')
  })

  it('templates', () => {
    const q = (n) => countAr(n, 'template')
    expect(q(0)).toBe('لا قوالب')
    expect(q(1)).toBe('قالب واحد')
    expect(q(2)).toBe('قالبان')
    expect(q(5)).toBe('5 قوالب')
    expect(q(61)).toBe('61 قالباً')
    expect(q(157)).toBe('157 قالباً')
    expect(q(100)).toBe('100 قالب')
  })
})

describe('season readiness', () => {
  const today = day('2026-10-28')
  const rows = [
    t(1, 'ramadan'), t(2, 'ramadan', { type: 'video' }), t(3, 'ramadan', { is_premium: true }),
    t(4, 'ramadan', { is_visible: false }), t(5, 'ramadan', { created_at: '2026-10-18T09:00:00Z' }),
    t(6, 'eidAlAdha'),
  ]
  it('counts what users can see: total, video, free, and how long since the last addition', () => {
    const r = seasonReadiness(rows, 'ramadan', today)
    expect(r).toMatchObject({ total: 4, video: 1, free: 3, target: SEASON_TARGET, lastAddedDays: 10 })
  })
  it('an empty season has nothing and no last addition', () => {
    expect(seasonReadiness(rows, 'eidAlFitr', today)).toMatchObject({ total: 0, video: 0, free: 0, lastAddedDays: null })
  })
})

describe('what is waiting for the admin', () => {
  const today = day('2026-10-28')
  const overview = [
    t(1, 'ramadan'), t(2, 'ramadan', { name_position_x: 0.5, name_position_y: 0.8 }),
    t(3, 'eidAlAdha'), t(4, 'marriage'),
  ]
  const seasons = upcomingSeasons(overview, today)

  it('lists names to place, studio drafts, thin seasons, empty occasions and failed notifications — most useful first', () => {
    const items = inboxItems({ overview, seasons, studioDrafts: 3, failedPush: 1 })
    expect(items.map((i) => i.id)).toEqual(['names', 'thumbs', 'season-ramadan', 'season-eidAlFitr', 'studio', 'empty', 'push'])
    expect(items.find((i) => i.id === 'thumbs')).toMatchObject({ title: '4 قوالب بلا صورة مصغّرة', action: { to: '/templates/occasions' } })
    expect(items[0]).toMatchObject({ title: '3 قوالب بلا مكان للاسم', action: { to: '/templates/place' } })
    expect(items.find((i) => i.id === 'season-eidAlFitr').title).toBe('عيد الفطر بعد 132 يوماً وليس فيه أي قالب')
    expect(items.find((i) => i.id === 'season-ramadan').title).toBe('رمضان بعد 103 أيام وفيه قالبان فقط')
    expect(items.find((i) => i.id === 'studio').title).toBe('3 قوالب من الاستوديو تنتظر نشرك')
    expect(items.find((i) => i.id === 'empty').action.to).toBe('/templates/occasions/engagement')
  })

  it('a row without template covers carries its number instead (days, count)', () => {
    const items = inboxItems({ overview, seasons, studioDrafts: 3, failedPush: 1 })
    const badge = (id) => items.find((i) => i.id === id).badge
    expect(badge('season-eidAlFitr')).toBe('132')
    expect(badge('studio')).toBe('3')
    expect(badge('empty')).toBe('7')
    expect(badge('push')).toBe('1')
    expect(items.find((i) => i.id === 'names').badge).toBeUndefined()
  })

  it('a season far away or already ready does not nag', () => {
    const full = Array.from({ length: SEASON_TARGET }, (_, i) => t(100 + i, 'ramadan', { name_position_x: 0.5, name_position_y: 0.5 }))
    const items = inboxItems({ overview: full, seasons: upcomingSeasons(full, today), studioDrafts: 0, failedPush: 0 })
    expect(items.some((i) => i.id === 'season-ramadan')).toBe(false)
    expect(items.some((i) => i.id === 'season-eidAlAdha')).toBe(false) // بعد 200 يوم: أبعد من نافذة التنبيه
  })

  it('nothing waiting is an empty list', () => {
    const placed = OCCASION_KEYS.map((k, i) => t(200 + i, k, { name_position_x: 0.5, name_position_y: 0.5, thumbnail_url: `https://cdn/thumbnails/${i}.jpg` }))
    const items = inboxItems({ overview: placed, seasons: [], studioDrafts: 0, failedPush: 0 })
    expect(items).toEqual([])
  })
})

describe('pulse helpers', () => {
  it('buckets events into the last N local days, oldest first, today last', () => {
    const today = day('2026-10-28')
    const b = bucketByDay(['2026-10-28T08:00:00', '2026-10-27T23:30:00', '2026-10-27T01:00:00', '2026-10-20T10:00:00', '2026-09-01T10:00:00'].map((s) => new Date(s)), today, 14)
    expect(b).toHaveLength(14)
    expect(b[13]).toBe(1)
    expect(b[12]).toBe(2)
    expect(b[5]).toBe(1)
    expect(b.reduce((s, v) => s + v, 0)).toBe(4)
  })

  it('compares with the same day last week', () => {
    expect(deltaPercent(118, 100)).toBe(18)
    expect(deltaPercent(80, 100)).toBe(-20)
    expect(deltaPercent(5, 0)).toBeNull()
  })

  it('counts distinct devices', () => {
    expect(distinctCount([{ device_id: 'a' }, { device_id: 'b' }, { device_id: 'a' }], 'device_id')).toBe(2)
  })

  it('a season shows its most exported template as cover, else its newest', () => {
    const ov = [t('a', 'ramadan', { created_at: '2026-10-20T00:00:00Z' }), t('b', 'ramadan', { created_at: '2026-01-01T00:00:00Z' }), t('c', 'eidAlAdha')]
    const s = upcomingSeasons(ov, day('2026-10-28'), ['b', 'b', 'a'])
    expect(s.find((x) => x.key === 'ramadan').cover).toBe('https://cdn/x/b.jpg')
    expect(upcomingSeasons(ov, day('2026-10-28')).find((x) => x.key === 'ramadan').cover).toBe('https://cdn/x/a.jpg')
  })

  it('ranks templates by exports and attaches their cover', () => {
    const ov = [t('a', 'ramadan'), t('b', 'marriage'), t('c', 'eidAlAdha')]
    const top = topTemplates(['b', 'a', 'b', 'x', 'b', 'a', null], ov, 2)
    expect(top.map((r) => [r.id, r.count])).toEqual([['b', 3], ['a', 2]])
    expect(top[0].cover).toBe('https://cdn/x/b.jpg')
  })
})
