import { describe, it, expect } from 'vitest'
import { PLACEMENTS, placementMode, placementShows, placementPatch, placementNote, momentsSummary, adStatus, adPayload, adError, nextPriority } from './income'

const settings = (extra = {}) => ({
  id: 1, custom_ads_enabled: false,
  google_select_enabled: true, google_save_enabled: true, google_share_enabled: true,
  custom_select_enabled: true, custom_save_enabled: true, custom_share_enabled: true, ...extra,
})

describe('what each moment shows (same rule as the app)', () => {
  it('your ad only when your ads are on and this moment allows them, else Google if on, else nothing', () => {
    expect(PLACEMENTS.map((p) => p.key)).toEqual(['select', 'save', 'share'])
    expect(placementMode(settings(), 'select')).toBe('google')
    expect(placementMode(settings({ custom_ads_enabled: true }), 'save')).toBe('custom')
    expect(placementMode(settings({ custom_ads_enabled: true, custom_save_enabled: false }), 'save')).toBe('google')
    expect(placementMode(settings({ google_share_enabled: false }), 'share')).toBe('none')
    expect(placementMode(null, 'share')).toBe('none')
  })

  it('choosing a mode writes one clear state and keeps the master switch in step — your ad falls back to Google', () => {
    const s = settings()
    expect(placementPatch(s, 'save', 'custom')).toEqual({ custom_save_enabled: true, google_save_enabled: true, custom_ads_enabled: true })
    const on = settings({ custom_ads_enabled: true, custom_select_enabled: false, custom_share_enabled: false })
    // آخر موضع لإعلانك صار جوجل ← الإعلانات المخصصة تُطفأ كلها
    expect(placementPatch(on, 'save', 'google')).toEqual({ custom_save_enabled: false, google_save_enabled: true, custom_ads_enabled: false })
    expect(placementPatch(on, 'save', 'none')).toEqual({ custom_save_enabled: false, google_save_enabled: false, custom_ads_enabled: false })
    // ما زال موضع آخر لإعلانك ← تبقى مشغّلة
    const two = settings({ custom_ads_enabled: true, custom_share_enabled: false })
    expect(placementPatch(two, 'save', 'google').custom_ads_enabled).toBe(true)
  })

  it('what actually shows: exactly the app rule (your ad only if it runs here, else Google if on)', () => {
    const on = settings({ custom_ads_enabled: true })
    const ad = { show_on_select: false, show_on_save: true, show_on_share: true }
    expect(placementShows(on, ad, 'save')).toBe('custom')
    expect(placementShows(on, ad, 'select')).toBe('google')
    expect(placementShows(on, null, 'save')).toBe('google')
    expect(placementShows(settings({ custom_ads_enabled: true, google_save_enabled: false }), null, 'save')).toBe('none')
    expect(placementShows(settings({ google_share_enabled: false }), ad, 'share')).toBe('none')
    expect(placementShows(null, ad, 'share')).toBe('none')
  })

  it('says what shows instead when your ad is chosen but cannot show there now', () => {
    expect(placementNote('custom', 'google', null, 'select')).toBe('لا إعلان لك يعمل الآن، فيظهر إعلان جوجل بدله.')
    expect(placementNote('custom', 'none', null, 'select')).toBe('لا إعلان لك يعمل الآن، فلن يظهر شيء هنا.')
    expect(placementNote('custom', 'google', { show_on_select: false }, 'select')).toBe('إعلانك الحالي لا يظهر عند اختيار قالب، فيظهر إعلان جوجل بدله.')
    expect(placementNote('custom', 'custom', { show_on_select: true }, 'select')).toBeNull()
    expect(placementNote('google', 'google', null, 'select')).toBeNull()
  })
})

describe('one sentence for the three moments', () => {
  it('groups moments by what they show', () => {
    expect(momentsSummary({ select: 'google', save: 'custom', share: 'none' })).toBe('يرى إعلانك عند الحفظ، وإعلان جوجل عند اختيار قالب، ولا شيء عند المشاركة.')
    expect(momentsSummary({ select: 'google', save: 'google', share: 'custom' })).toBe('يرى إعلانك عند المشاركة، وإعلان جوجل عند اختيار قالب وعند الحفظ.')
    expect(momentsSummary({ select: 'custom', save: 'custom', share: 'custom' })).toBe('يرى إعلانك في اللحظات الثلاث.')
    expect(momentsSummary({ select: 'none', save: 'none', share: 'none' })).toBe('لا يرى أي إعلان.')
  })
})

describe('your ads', () => {
  const ad = (extra) => ({ id: 'a', title: 'x', is_active: true, start_date: null, end_date: null, priority: 0, ...extra })
  const today = '2026-10-29'

  it('says plainly where each ad stands', () => {
    expect(adStatus(ad({ is_active: false }), 'a', today)).toMatchObject({ state: 'off', label: 'موقوف' })
    expect(adStatus(ad({ end_date: '2026-10-01' }), null, today)).toMatchObject({ state: 'ended', label: 'انتهى 1 أكتوبر' })
    expect(adStatus(ad({ start_date: '2026-11-05' }), null, today)).toMatchObject({ state: 'waiting', label: 'يبدأ 5 نوفمبر' })
    expect(adStatus(ad(), 'a', today)).toMatchObject({ state: 'live', label: 'يظهر الآن' })
    expect(adStatus(ad(), 'b', today)).toMatchObject({ state: 'queued', label: 'جاهز، ويظهر غيره الآن' })
    expect(adStatus(ad({ end_date: today }), 'a', today).state).toBe('live')
  })

  it('cleans the form into what the app reads: empty button labels keep their defaults', () => {
    const p = adPayload({
      title: '  عرض العيد ', image_url: 'https://cdn/x.jpg', video_url: '', contact_label: '', contact_button_url: 'https://wa.me/966',
      view_label: '  ', watch_button_url: '', countdown_secs: '45', start_date: '', end_date: '2026-11-30',
      show_on_select: true, show_on_save: false, show_on_share: true, is_active: true,
    })
    expect(p).toEqual({
      title: 'عرض العيد', image_url: 'https://cdn/x.jpg', video_url: null, contact_label: 'تواصل معنا', contact_button_url: 'https://wa.me/966',
      view_label: 'مشاهدة', watch_button_url: null, countdown_secs: 30, start_date: null, end_date: '2026-11-30',
      show_on_select: true, show_on_save: false, show_on_share: true, is_active: true,
    })
  })

  it('names the first thing missing', () => {
    const ok = { title: 'x', image_url: 'https://cdn/x.jpg', video_url: '', contact_button_url: '', watch_button_url: '', start_date: '', end_date: '' }
    expect(adError(ok)).toBeNull()
    expect(adError({ ...ok, title: ' ' })).toBe('اكتب اسماً للإعلان')
    expect(adError({ ...ok, image_url: '' })).toBe('أضف صورة أو فيديو')
    expect(adError({ ...ok, contact_button_url: 'wa.me/966' })).toBe('رابط زر التواصل يجب أن يبدأ بـ https://')
    expect(adError({ ...ok, watch_button_url: 'youtube' })).toBe('رابط زر المشاهدة يجب أن يبدأ بـ https://')
    expect(adError({ ...ok, start_date: '2026-11-10', end_date: '2026-11-01' })).toBe('تاريخ النهاية قبل البداية')
  })

  it('the ad you turn on goes in front of the others', () => {
    expect(nextPriority([{ priority: 0 }, { priority: 4 }])).toBe(5)
    expect(nextPriority([])).toBe(1)
  })
})
