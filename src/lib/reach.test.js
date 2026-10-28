import { describe, it, expect } from 'vitest'
import {
  COUNTRIES, audienceOptions, notificationView, failReason, nextBestTime, whenLabel, seasonDraft,
  versionLess, versionReach, isVersion,
} from './reach'

const at = (s) => new Date(s)
const NOW = at('2026-10-29T15:00:00')
const minutes = (m) => new Date(NOW.getTime() + m * 60e3).toISOString()

describe('audience', () => {
  it('everyone first, then only countries that have devices, most devices first, without flags', () => {
    const r = audienceOptions({ all: 1300, SA: 1000, KW: 0, AE: 250 })
    expect(r.map((o) => [o.key, o.devices])).toEqual([['all', 1300], ['SA', 1000], ['AE', 250]])
    expect(r[1].label).toBe('السعودية')
    expect(COUNTRIES.every((c) => !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(c.label))).toBe(true)
  })
})

describe('notification states', () => {
  const n = (extra) => ({ id: 'x', title: 't', body: 'b', status: 'pending', created_at: minutes(-1), ...extra })

  it('scheduled in the future says when', () => {
    const v = notificationView(n({ status: 'scheduled', scheduled_at: minutes(5 * 60) }), NOW)
    expect(v.state).toBe('scheduled')
    expect(v.label).toBe('مجدول · اليوم 8 مساءً')
    expect(v.actions).toEqual(['delete'])
  })

  it('a fresh one, or a scheduled one whose minute just came, is being sent', () => {
    expect(notificationView(n({ status: 'pending' }), NOW).state).toBe('sending')
    expect(notificationView(n({ status: 'scheduled', scheduled_at: minutes(-1) }), NOW).state).toBe('sending')
    expect(notificationView(n({ status: 'sending', updated_at: minutes(-2) }), NOW).label).toBe('يُرسل…')
  })

  it('waiting well past its time was never sent — offer to send it now', () => {
    const v = notificationView(n({ status: 'pending', scheduled_at: minutes(-90), created_at: minutes(-300) }), NOW)
    expect(v.state).toBe('overdue')
    expect(v.label).toBe('فات موعده ولم يُرسل')
    expect(v.actions).toEqual(['send', 'delete'])
    expect(notificationView(n({ status: 'scheduled', scheduled_at: minutes(-30) }), NOW).state).toBe('overdue')
  })

  it('sending for too long stopped half way — no resend (some phones already got it)', () => {
    const v = notificationView(n({ status: 'sending', created_at: minutes(-40), updated_at: minutes(-30) }), NOW)
    expect(v.state).toBe('stalled')
    expect(v.actions).toEqual(['delete'])
  })

  it('sent says how many phones got it, and how many did not', () => {
    const v = notificationView(n({ status: 'sent', sent_at: minutes(-60), total_tokens: 1210, success_count: 1204, fail_count: 6 }), NOW)
    expect(v.state).toBe('sent')
    expect(v.label).toBe('وصل إلى 1,204 أجهزة')
    expect(v.detail).toBe('6 أجهزة لم تستقبله، غالباً حُذف منها التطبيق.')
    expect(v.actions).toEqual([])
    expect(notificationView(n({ status: 'sent', success_count: 1, fail_count: 0 }), NOW).detail).toBeNull()
  })

  it('failed explains why in plain words and can be sent again', () => {
    const v = notificationView(n({ status: 'failed', error_message: 'No active device tokens found' }), NOW)
    expect(v.label).toBe('لم يُرسل')
    expect(v.detail).toBe('لا أجهزة مسجّلة لهذا الجمهور.')
    expect(v.actions).toEqual(['send', 'delete'])
  })

  it('maps server errors to reasons', () => {
    expect(failReason('HTTP 403: {"reason":"InvalidProviderToken"}')).toBe('مفتاح الإرسال إلى آبل في الخادم غير صحيح أو منتهٍ.')
    expect(failReason('JWT generation failed: x')).toBe('مفتاح الإرسال إلى آبل في الخادم غير صحيح أو منتهٍ.')
    expect(failReason('HTTP 400: {"reason":"BadDeviceToken"} | HTTP 410: {"reason":"Unregistered"}')).toBe('كل الأجهزة رفضته: نسخ قديمة أو حُذف منها التطبيق.')
    expect(failReason('HTTP 400: {"reason":"DeviceTokenNotForTopic"}')).toBe('آبل رفضت معرّف التطبيق.')
    expect(failReason(null)).toBe('تعذّر الإرسال.')
  })
})

describe('when', () => {
  it('the next best hour: today if still ahead, else tomorrow', () => {
    expect(nextBestTime(20, NOW).toString()).toBe(at('2026-10-29T20:00:00').toString())
    expect(nextBestTime(9, NOW).toString()).toBe(at('2026-10-30T09:00:00').toString())
    expect(nextBestTime(15, NOW).toString()).toBe(at('2026-10-30T15:00:00').toString())
  })

  it('says times the way people say them', () => {
    expect(whenLabel(at('2026-10-29T20:00:00'), NOW)).toBe('اليوم 8 مساءً')
    expect(whenLabel(at('2026-10-30T09:30:00'), NOW)).toBe('غداً 9:30 صباحاً')
    expect(whenLabel(at('2026-10-28T21:00:00'), NOW)).toBe('أمس 9 مساءً')
    expect(whenLabel(at('2026-11-01T20:00:00'), NOW)).toBe('الأحد 8 مساءً')
    expect(whenLabel(at('2026-12-12T20:00:00'), NOW)).toBe('12 ديسمبر · 8 مساءً')
  })
})

describe('season suggestion', () => {
  it('a ready-made notification for the nearest season within 45 days', () => {
    const d = seasonDraft([{ key: 'ramadan', label: 'رمضان', days: 20 }, { key: 'eidAlFitr', label: 'عيد الفطر', days: 50 }])
    expect(d.title).toBe('رمضان اقترب')
    expect(d.body).toMatch(/اسمك/)
    expect(d.season).toBe('رمضان')
    expect(seasonDraft([{ key: 'ramadan', label: 'رمضان', days: 100 }])).toBeNull()
    expect(seasonDraft([])).toBeNull()
  })
})

describe('update message', () => {
  it('compares versions exactly like the app (non-numeric parts dropped)', () => {
    expect(versionLess('1.2.1', '2.0')).toBe(true)
    expect(versionLess('2.0', '2.0.0')).toBe(false)
    expect(versionLess('2.0', '1.10')).toBe(false)
    expect(versionLess('1.9', '1.10')).toBe(true)
  })

  it('counts devices that will see it (older than the version), unknown versions left out', () => {
    const rows = [{ app_version: '1.2.1', devices: 70 }, { app_version: '2.0', devices: 30 }, { app_version: 'unknown', devices: 5 }]
    expect(versionReach(rows, '2.0')).toEqual({ below: 70, total: 100 })
    expect(versionReach(rows, '1.0')).toEqual({ below: 0, total: 100 })
  })

  it('accepts version numbers only', () => {
    expect(isVersion('2.1')).toBe(true)
    expect(isVersion('2.1.3')).toBe(true)
    expect(isVersion('v2')).toBe(false)
    expect(isVersion('')).toBe(false)
  })
})
