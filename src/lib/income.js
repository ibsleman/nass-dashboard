// حسابات «الدخل»: ماذا يرى المستخدم في كل لحظة إعلان، وحال إعلاناتك.
// القاعدة نفسها التي يقرر بها التطبيق (AdChoice في AdManager.swift) — اللوحة تكتب، والتطبيق يقرأ.
import { MONTHS } from './reach'

export const PLACEMENTS = [
  { key: 'select', label: 'عند اختيار قالب', short: 'اختيار' },
  { key: 'save', label: 'عند الحفظ', short: 'حفظ' },
  { key: 'share', label: 'عند المشاركة', short: 'مشاركة' },
]

export const MODES = [
  { key: 'custom', label: 'إعلانك' },
  { key: 'google', label: 'جوجل' },
  { key: 'none', label: 'لا شيء' },
]

/** إعلانك متى كانت إعلاناتك مشغّلة وهذا الموضع يسمح بها، وإلا جوجل إن شُغّل، وإلا لا شيء */
export function placementMode(settings, key) {
  if (!settings) return 'none'
  if (settings.custom_ads_enabled && settings[`custom_${key}_enabled`]) return 'custom'
  return settings[`google_${key}_enabled`] ? 'google' : 'none'
}

/**
 * اختيار واحد واضح لكل لحظة، والمفتاح العام لإعلاناتك يتبع: مشغّل ما دام لها موضع واحد على الأقل.
 * «إعلانك» يُبقي جوجل احتياطاً: حين لا يعمل لك إعلان هنا يظهر جوجل بدل أن تفرغ اللحظة.
 */
export function placementPatch(settings, key, mode) {
  const anyCustom = PLACEMENTS.some((p) => (p.key === key ? mode === 'custom' : placementMode(settings, p.key) === 'custom'))
  return { [`custom_${key}_enabled`]: mode === 'custom', [`google_${key}_enabled`]: mode !== 'none', custom_ads_enabled: anyCustom }
}

/** ما يظهر فعلاً الآن — قاعدة التطبيق حرفياً (AdChoice.pick): إعلانك إن كان يعمل هنا، وإلا جوجل إن شُغّل */
export function placementShows(settings, liveAd, key) {
  if (!settings) return 'none'
  if (settings.custom_ads_enabled && settings[`custom_${key}_enabled`] && liveAd?.[`show_on_${key}`]) return 'custom'
  return settings[`google_${key}_enabled`] ? 'google' : 'none'
}

/** حين يُختار إعلانك ولا يمكن أن يظهر هنا الآن: ما السبب، وماذا يظهر بدله */
export function placementNote(mode, shows, liveAd, key) {
  if (mode !== 'custom' || shows === 'custom') return null
  const why = liveAd
    ? `إعلانك الحالي لا يظهر ${PLACEMENTS.find((x) => x.key === key).label}`
    : 'لا إعلان لك يعمل الآن'
  return `${why}، ${shows === 'google' ? 'فيظهر إعلان جوجل بدله.' : 'فلن يظهر شيء هنا.'}`
}

const SUMMARY = { custom: 'إعلانك', google: 'إعلان جوجل', none: 'لا شيء' }

/** جملة واحدة لما يراه المستخدم المجاني في اللحظات الثلاث — تتغير مع أي اختيار في الإطار نفسه */
export function momentsSummary(modes) {
  const groups = ['custom', 'google', 'none']
    .map((m) => [m, PLACEMENTS.filter((p) => modes[p.key] === m)])
    .filter(([, ps]) => ps.length)
  if (groups.length === 1) {
    const [m] = groups[0]
    return m === 'none' ? 'لا يرى أي إعلان.' : `يرى ${SUMMARY[m]} في اللحظات الثلاث.`
  }
  return `يرى ${groups.map(([m, ps]) => `${SUMMARY[m]} ${ps.map((p) => p.label).join(' و')}`).join('، و')}.`
}

export const dateLabel = (ymd) => {
  const [, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** حال الإعلان: موقوف، انتهى، ينتظر بدايته، يظهر الآن، أو جاهز وغيره يظهر */
export function adStatus(ad, liveId, today) {
  if (!ad.is_active) return { state: 'off', label: 'موقوف' }
  if (ad.end_date && ad.end_date < today) return { state: 'ended', label: `انتهى ${dateLabel(ad.end_date)}` }
  if (ad.start_date && ad.start_date > today) return { state: 'waiting', label: `يبدأ ${dateLabel(ad.start_date)}` }
  if (ad.id === liveId) return { state: 'live', label: 'يظهر الآن' }
  return { state: 'queued', label: 'جاهز، ويظهر غيره الآن' }
}

const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null

/** ما يُحفظ: الحقول الفارغة null، ونصا الزرين لا يفرغان أبداً (العمود إلزامي والتطبيق يخفي الزر بلا رابط) */
export function adPayload(f) {
  return {
    title: f.title.trim(),
    image_url: clean(f.image_url),
    video_url: clean(f.video_url),
    contact_label: clean(f.contact_label) ?? 'تواصل معنا',
    contact_button_url: clean(f.contact_button_url),
    view_label: clean(f.view_label) ?? 'مشاهدة',
    watch_button_url: clean(f.watch_button_url),
    countdown_secs: Math.max(0, Math.min(30, parseInt(f.countdown_secs, 10) || 0)),
    start_date: clean(f.start_date),
    end_date: clean(f.end_date),
    show_on_select: Boolean(f.show_on_select),
    show_on_save: Boolean(f.show_on_save),
    show_on_share: Boolean(f.show_on_share),
    is_active: Boolean(f.is_active),
  }
}

const isLink = (u) => /^(https?:\/\/|mailto:|tel:|whatsapp:\/\/)/i.test(u)

/** أول ما ينقص الإعلان، أو null */
export function adError(f) {
  if (!f.title?.trim()) return 'اكتب اسماً للإعلان'
  if (!clean(f.image_url) && !clean(f.video_url)) return 'أضف صورة أو فيديو'
  if (clean(f.contact_button_url) && !isLink(f.contact_button_url.trim())) return 'رابط زر التواصل يجب أن يبدأ بـ https://'
  if (clean(f.watch_button_url) && !isLink(f.watch_button_url.trim())) return 'رابط زر المشاهدة يجب أن يبدأ بـ https://'
  if (clean(f.start_date) && clean(f.end_date) && f.end_date < f.start_date) return 'تاريخ النهاية قبل البداية'
  return null
}

/** الإعلان الذي تشغّله يتقدّم غيره (التطبيق يعرض الأعلى أولوية بين الجارية) */
export function nextPriority(ads) {
  return ads.reduce((m, a) => Math.max(m, a.priority ?? 0), 0) + 1
}
