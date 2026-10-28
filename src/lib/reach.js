// حسابات «التواصل»: جمهور الإشعار، حالته بكلام واضح، مواعيده كما تُقال، ومن سيرى رسالة التحديث.
// دوال خالصة — الجلب في supabase.js والعرض في ReachPage.
import { countAr, countdown, daysUntil } from './today'
import { dayPart } from './numbers'

/** الدول بأسمائها المختصرة — بلا أعلام (لا رموز تعبيرية في الواجهة) */
export const COUNTRIES = [
  { code: 'SA', label: 'السعودية' },
  { code: 'AE', label: 'الإمارات' },
  { code: 'KW', label: 'الكويت' },
  { code: 'QA', label: 'قطر' },
  { code: 'BH', label: 'البحرين' },
  { code: 'OM', label: 'عُمان' },
  { code: 'EG', label: 'مصر' },
  { code: 'JO', label: 'الأردن' },
  { code: 'IQ', label: 'العراق' },
  { code: 'MA', label: 'المغرب' },
]
const COUNTRY_LABEL = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.label]))
const regionNames = new Intl.DisplayNames(['ar'], { type: 'region' })
export const countryLabel = (code) => COUNTRY_LABEL[code] ?? (() => { try { return regionNames.of(code) } catch { return code } })()

/** «الكل» أولاً ثم الدول التي فيها أجهزة فعلاً، الأكثر أولاً */
export function audienceOptions(counts) {
  const countries = Object.entries(counts)
    .filter(([code, n]) => code !== 'all' && n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => ({ key: code, label: countryLabel(code), devices: n }))
  return [{ key: 'all', label: 'الكل', devices: counts.all ?? 0 }, ...countries]
}

const GRACE_MS = 3 * 60e3 // المجدوِل يعمل كل دقيقة: بعد ثلاث دقائق بلا إرسال فقد فات
const STALL_MS = 10 * 60e3

/** سبب الفشل كما يفهمه صاحب التطبيق */
export function failReason(message) {
  const m = message ?? ''
  if (/No active device tokens/i.test(m)) return 'لا أجهزة مسجّلة لهذا الجمهور.'
  if (/InvalidProviderToken|ExpiredProviderToken|JWT|APNS_PRIVATE_KEY/i.test(m)) return 'مفتاح الإرسال إلى آبل في الخادم غير صحيح أو منتهٍ.'
  if (/DeviceTokenNotForTopic|BadTopic|TopicDisallowed/i.test(m)) return 'آبل رفضت معرّف التطبيق.'
  if (/BadDeviceToken|Unregistered/i.test(m)) return 'كل الأجهزة رفضته: نسخ قديمة أو حُذف منها التطبيق.'
  return 'تعذّر الإرسال.'
}

function missed(fail) {
  if (!fail) return null
  if (fail === 1) return 'جهاز واحد لم يستقبله، غالباً حُذف منه التطبيق.'
  if (fail === 2) return 'جهازان لم يستقبلاه، غالباً حُذف منهما التطبيق.'
  return `${countAr(fail, 'device')} لم تستقبله، غالباً حُذف منها التطبيق.`
}

/** حالة الإشعار: ما يقال عنه، ونبرته، وما يمكن فعله به */
export function notificationView(n, now = new Date()) {
  const t = (iso) => (iso ? new Date(iso).getTime() : null)
  const late = (iso) => now.getTime() - t(iso) > GRACE_MS
  const sending = { state: 'sending', label: 'يُرسل…', detail: null, tone: 'gold', actions: [] }
  const overdue = { state: 'overdue', label: 'فات موعده ولم يُرسل', detail: 'المجدوِل لم يرسله في وقته. أرسله الآن أو احذفه.', tone: 'warn', actions: ['send', 'delete'] }

  switch (n.status) {
    case 'scheduled':
      if (t(n.scheduled_at) > now.getTime()) {
        return { state: 'scheduled', label: `مجدول · ${whenLabel(new Date(n.scheduled_at), now)}`, detail: null, tone: 'ink', actions: ['delete'] }
      }
      return late(n.scheduled_at) ? overdue : sending
    case 'pending':
      return late(n.scheduled_at ?? n.created_at) ? overdue : sending
    case 'sending':
      return now.getTime() - t(n.updated_at ?? n.created_at) > STALL_MS
        ? { state: 'stalled', label: 'توقف أثناء الإرسال', detail: 'قد يكون وصل إلى بعض الأجهزة، فلا يُعاد إرساله تلقائياً.', tone: 'warn', actions: ['delete'] }
        : sending
    case 'sent':
      return { state: 'sent', label: `وصل إلى ${countAr(n.success_count ?? 0, 'device')}`, detail: missed(n.fail_count ?? 0), tone: 'ok', actions: [] }
    default:
      return { state: 'failed', label: 'لم يُرسل', detail: failReason(n.error_message), tone: 'warn', actions: ['send', 'delete'] }
  }
}

/** أقرب موعد للساعة المختارة: اليوم إن بقي عليها عشر دقائق على الأقل، وإلا غداً */
export function nextBestTime(hour, now = new Date()) {
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() - now.getTime() < 10 * 60e3) d.setDate(d.getDate() + 1)
  return d
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

/** 8 مساءً، 9:30 صباحاً */
export function timeLabel(d) {
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${dayPart(h)}`
}

/** اليوم/غداً/أمس، أو اسم اليوم خلال أسبوع، أو التاريخ — ثم الساعة */
export function whenLabel(d, now = new Date()) {
  const days = daysUntil(now, d)
  const day = days === 0 ? 'اليوم' : days === 1 ? 'غداً' : days === -1 ? 'أمس' : Math.abs(days) < 7 ? WEEKDAYS[d.getDay()] : null
  return day ? `${day} ${timeLabel(d)}` : `${d.getDate()} ${MONTHS[d.getMonth()]} · ${timeLabel(d)}`
}

/** إشعار جاهز لأقرب موسم خلال 45 يوماً — يُقترح ولا يُرسل */
export function seasonDraft(seasons) {
  const s = seasons.find((x) => x.days != null && x.days >= 0 && x.days <= 45)
  if (!s) return null
  return {
    season: s.label,
    when: countdown(s.days),
    title: s.days === 0 ? `${s.label} مبارك` : `${s.label} اقترب`,
    body: s.key === 'ramadan'
      ? 'اختر تهنئة رمضان واكتب اسمك عليها، وأرسلها لأهلك قبل الزحمة.'
      : `تهاني ${s.label} جاهزة باسمك. اختر واحدة وأرسلها في ثوانٍ.`,
  }
}

/** مقارنة الإصدارات كما يفعل التطبيق: الأجزاء غير الرقمية تُسقط */
const parts = (v) => String(v).split('.').filter((p) => /^\d+$/.test(p)).map(Number)
export function versionLess(a, b) {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  }
  return false
}

/** رسالة التحديث تظهر لمن نسخته أقدم من رقمها — كم جهازاً من أجهزة الفترة */
export function versionReach(rows, target) {
  const known = rows.filter((r) => parts(r.app_version).length > 0)
  return {
    below: known.filter((r) => versionLess(r.app_version, target)).reduce((s, r) => s + Number(r.devices), 0),
    total: known.reduce((s, r) => s + Number(r.devices), 0),
  }
}

export const isVersion = (v) => /^\d+(\.\d+){0,3}$/.test(String(v).trim())
