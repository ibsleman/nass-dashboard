// حسابات «اليوم» (G1 الداش بورد): المواسم بتقويم أم القرى، ما ينتظر المشرف، ونبض التطبيق.
// دوال خالصة — الجلب في supabase.js والعرض في TodayPage.
import { OCCASIONS, OCCASION_LABEL } from './occasions'
import { hasSpot } from './nameSpot'
import { needsThumbnail } from './thumbnail'

/** المواسم التي يُستعد لها: الشهر والتاريخ الهجري لأول يوم */
export const SEASONS = [
  { key: 'ramadan', hm: 9, hd: 1, verb: 'يبدأ نحو' },
  { key: 'eidAlFitr', hm: 10, hd: 1, verb: 'نحو' },
  { key: 'eidAlAdha', hm: 12, hd: 10, verb: 'نحو' },
]
/** هدف الموسم من القوالب الظاهرة — رقم ابتدائي يُعدَّل لاحقاً من الإعدادات */
export const SEASON_TARGET = 30
/** موسم أبعد من هذا لا يُنبَّه عليه في «ينتظرك» */
export const SEASON_WINDOW_DAYS = 150

const hijriFormat = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
const hijri = (d) => {
  const p = hijriFormat.formatToParts(d)
  const get = (type) => parseInt(p.find((x) => x.type === type)?.value, 10)
  return { m: get('month'), d: get('day') }
}
const noon = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x }

/** أول يوم قادم (من اليوم) يوافق الشهر والتاريخ الهجريين */
export function nextHijri(today, hm, hd) {
  const start = noon(today)
  for (let i = 0; i < 400; i++) {
    const d = new Date(start.getTime() + i * 864e5)
    const h = hijri(d)
    if (h.m === hm && h.d === hd) return d
  }
  return null
}

/** أيام تقويمية كاملة بين يومين بالتوقيت المحلي */
export function daysUntil(from, to) {
  return Math.round((noon(to) - noon(from)) / 864e5)
}

const PLURALS = {
  day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يوماً', other: 'يوم', zero: 'لا أيام' },
  template: { one: 'قالب واحد', two: 'قالبان', few: 'قوالب', many: 'قالباً', other: 'قالب', zero: 'لا قوالب' },
  occasion: { one: 'مناسبة واحدة', two: 'مناسبتان', few: 'مناسبات', many: 'مناسبة', other: 'مناسبة', zero: 'لا مناسبات' },
  thumbnail: { one: 'مصغّرة واحدة', two: 'مصغّرتان', few: 'مصغّرات', many: 'مصغّرة', other: 'مصغّرة', zero: 'لا مصغّرات' },
  device: { one: 'جهاز واحد', two: 'جهازان', few: 'أجهزة', many: 'جهازاً', other: 'جهاز', zero: 'لا أجهزة' },
  // بعد «بعد»: مجرور — «بعد ثانيتين»، «بعد 5 ثوانٍ»
  second: { one: 'ثانية واحدة', two: 'ثانيتين', few: 'ثوانٍ', many: 'ثانية', other: 'ثانية', zero: 'لا ثوانٍ' },
}

/** العدد العربي بأرقام لاتينية (قرار التطبيق): 1، 2، 3–10، 11–99، 100+ بحسب آخر خانتين */
export function countAr(n, noun) {
  const f = PLURALS[noun]
  if (n === 0) return f.zero
  if (n === 1) return f.one
  if (n === 2) return f.two
  const r = n % 100
  const num = n.toLocaleString('en-US')
  if (r >= 3 && r <= 10) return `${num} ${f.few}`
  if (r >= 11 && r <= 99) return `${num} ${f.many}`
  return `${num} ${f.other}`
}

export function countdown(days) {
  if (days === 0) return 'اليوم'
  if (days === 1) return 'غداً'
  if (days === 2) return 'بعد يومين'
  return `بعد ${countAr(days, 'day')}`
}

const visible = (t) => t.is_visible !== false
const coverOf = (t) => t.thumbnail_url || t.image_url || null

/**
 * ما يراه المستخدمون من مناسبة: العدد والفيديو والمجاني ومنذ متى أُضيف آخر قالب.
 * الغلاف: أكثر قوالبها تصديراً (`exportIds`)، وإلا أحدثها — الأحدث قد يكون رفعاً عابراً لا يمثّلها.
 */
export function seasonReadiness(overview, key, today, exportIds = []) {
  const rows = overview.filter((t) => t.category === key && visible(t))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const loved = topTemplates(exportIds, rows, 1)[0]
  const last = rows.reduce((m, t) => (t.created_at && (!m || t.created_at > m) ? t.created_at : m), null)
  return {
    total: rows.length,
    video: rows.filter((t) => t.type === 'video').length,
    free: rows.filter((t) => !t.is_premium).length,
    target: SEASON_TARGET,
    lastAddedDays: last ? daysUntil(new Date(last), today) : null,
    cover: loved?.cover ?? rows.map(coverOf).find(Boolean) ?? null,
  }
}

/** المواسم الثلاثة بترتيب قربها، ومع كل منها جاهزيته */
export function upcomingSeasons(overview, today, exportIds = []) {
  return SEASONS
    .map((s) => {
      const date = nextHijri(today, s.hm, s.hd)
      return { ...s, label: OCCASION_LABEL[s.key], date, days: date ? daysUntil(today, date) : null, ...seasonReadiness(overview, s.key, today, exportIds) }
    })
    .filter((s) => s.date)
    .sort((a, b) => a.days - b.days)
}

/**
 * «ينتظرك» — ما يحتاج يد المشرف فقط، الأنفع أولاً، وكل بند يأخذه إلى مكان الفعل.
 * يختفي البند حين يزول سببه (لا «تم» وهمية). بلا صور قوالب يحمل رقمه (`badge`) مكانها.
 */
export function inboxItems({ overview, seasons, studioDrafts = 0, failedPush = 0 }) {
  const items = []
  const unplaced = overview.filter((t) => !hasSpot(t))
  if (unplaced.length) {
    items.push({
      id: 'names',
      title: `${countAr(unplaced.length, 'template')} بلا مكان للاسم`,
      detail: 'التطبيق يخمّن المكان الآن. ضعه بنفسك وتأخذه الأجهزة في المزامنة التالية.',
      action: { label: 'ابدأ', to: '/templates/place' },
      covers: unplaced.map(coverOf).filter(Boolean).slice(0, 3),
    })
  }

  const heavy = overview.filter(needsThumbnail)
  if (heavy.length) {
    items.push({
      id: 'thumbs',
      title: `${countAr(heavy.length, 'template')} بلا صورة مصغّرة`,
      detail: 'اللوحة وشبكات التطبيق تحمّل الصورة الكاملة لكل بطاقة. اصنع المصغّرات مرة واحدة.',
      action: { label: 'اصنعها', to: '/templates/occasions' },
      covers: [],
      badge: String(heavy.length),
    })
  }

  for (const s of seasons) {
    if (s.days > SEASON_WINDOW_DAYS || s.total >= s.target) continue
    items.push({
      id: `season-${s.key}`,
      title: s.total === 0
        ? `${s.label} ${countdown(s.days)} وليس فيه أي قالب`
        : `${s.label} ${countdown(s.days)} وفيه ${countAr(s.total, 'template')} فقط`,
      detail: s.total === 0
        ? 'المستخدم يفتح القسم فيجده فارغاً.'
        : `هدفك ${s.target}. المجاني منها ${s.free}${s.video ? ` والفيديو ${s.video}` : ''}.`,
      action: { label: 'أضف', to: `/templates/occasions/${s.key}` },
      covers: s.cover ? [s.cover] : [],
      badge: s.cover ? undefined : String(s.days),
      tone: s.total === 0 ? 'warn' : undefined,
    })
  }

  if (studioDrafts) {
    items.push({
      id: 'studio',
      title: `${countAr(studioDrafts, 'template')} من الاستوديو تنتظر نشرك`,
      detail: 'راجع أسماءها الستة، ثم انشرها أو أرجعها للمصمم.',
      action: { label: 'راجع', to: '/templates/studio' },
      covers: [],
      badge: String(studioDrafts),
    })
  }

  const seasonal = new Set(SEASONS.map((s) => s.key))
  const empty = OCCASIONS.filter((o) => !seasonal.has(o.key) && !overview.some((t) => t.category === o.key && visible(t)))
  if (empty.length) {
    items.push({
      id: 'empty',
      title: `${countAr(empty.length, 'occasion')} بلا قوالب`,
      detail: `${empty.map((o) => o.label).join('، ')}. المستخدم يرى هذه الأقسام فارغة.`,
      action: { label: 'أضف', to: `/templates/occasions/${empty[0].key}` },
      covers: [],
      badge: String(empty.length),
    })
  }

  if (failedPush) {
    items.push({
      id: 'push',
      title: failedPush === 1 ? 'إشعار لم يُرسَل هذا الأسبوع' : `${failedPush} إشعارات لم تُرسَل هذا الأسبوع`,
      detail: 'افتحه لترى السبب وتعيد إرساله.',
      action: { label: 'اعرضه', to: '/reach/notifications' },
      covers: [],
      badge: String(failedPush),
      tone: 'warn',
    })
  }
  return items
}

/** عدّ الأحداث في آخر `days` يوماً محلياً: الأقدم أولاً واليوم آخراً */
export function bucketByDay(dates, today, days) {
  const out = new Array(days).fill(0)
  for (const d of dates) {
    const back = daysUntil(d, today)
    if (back >= 0 && back < days) out[days - 1 - back]++
  }
  return out
}

/** الفرق بالنسبة المئوية — `null` حين لا أساس للمقارنة */
export function deltaPercent(now, before) {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}

export function distinctCount(rows, key) {
  return new Set(rows.map((r) => r[key])).size
}

/** الأكثر تصديراً: عدّ المعرّفات، وربطها بقوالبها (المحذوف يسقط) */
export function topTemplates(ids, overview, n = 5) {
  const counts = new Map()
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  const byId = new Map(overview.map((t) => [t.id, t]))
  return [...counts.entries()]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, count]) => ({ id, count, category: byId.get(id).category, cover: coverOf(byId.get(id)) }))
}
