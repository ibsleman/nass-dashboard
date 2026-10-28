import { describe, it, expect } from 'vitest'
import { appOrder, orderPatch, moveKey, seasonNudge, FIRST_SCREEN } from './categoryOrder'

const row = (key, display_order, is_active = true) => ({ id: `id-${key}`, key, display_order, is_active })

describe('order as the app shows it', () => {
  it('active ones by their number; inactive or missing ones at the end in the app’s own order', () => {
    const rows = [row('marriage', 2), row('ramadan', 1), row('newborn', 3, false)]
    const keys = appOrder(rows)
    expect(keys.slice(0, 2)).toEqual(['ramadan', 'marriage'])
    expect(keys).toHaveLength(11)
    // ما لا رقم له (أو مُطفأ) يأتي بعدها بترتيب التطبيق الأصلي
    expect(keys.slice(2, 4)).toEqual(['eidAlFitr', 'eidAlAdha'])
    expect(keys).toContain('newborn')
  })

  it('a phone shows the first four cards before scrolling', () => {
    expect(FIRST_SCREEN).toBe(4)
  })
})

describe('saving', () => {
  it('writes 1..n and only for rows whose number changed', () => {
    const rows = [row('ramadan', 1), row('marriage', 2), row('newborn', 3)]
    expect(orderPatch(rows, ['ramadan', 'newborn', 'marriage'])).toEqual([
      { id: 'id-newborn', display_order: 2 },
      { id: 'id-marriage', display_order: 3 },
    ])
    expect(orderPatch(rows, ['ramadan', 'marriage', 'newborn'])).toEqual([])
  })
})

describe('keyboard', () => {
  it('moves a card one step earlier or later, stopping at the ends', () => {
    const keys = ['a', 'b', 'c']
    expect(moveKey(keys, 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveKey(keys, 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveKey(keys, 'a', -1)).toBe(keys)
    expect(moveKey(keys, 'c', 1)).toBe(keys)
  })
})

describe('season nudge', () => {
  const seasons = [{ key: 'eidAlAdha', label: 'عيد الأضحى', days: 12 }, { key: 'ramadan', label: 'رمضان', days: 100 }]
  it('a season within 30 days that people would not see without scrolling', () => {
    const keys = ['marriage', 'invitations', 'promotion', 'eidAlFitr', 'engagement', 'eidAlAdha']
    expect(seasonNudge(seasons, keys)).toEqual({ key: 'eidAlAdha', label: 'عيد الأضحى', days: 12, position: 6 })
  })
  it('nothing when it is already on the first screen or far away', () => {
    expect(seasonNudge(seasons, ['eidAlAdha', 'marriage'])).toBeNull()
    expect(seasonNudge([{ key: 'ramadan', label: 'رمضان', days: 100 }], ['marriage', 'a', 'b', 'c', 'ramadan'])).toBeNull()
  })
})
