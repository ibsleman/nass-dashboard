// حسابات «الأرقام» — دوال خالصة فوق ملخصات القاعدة (admin_stats_*). الجلب في supabase.js والعرض في NumbersPage.
import { OCCASION_LABEL } from './occasions'

export const PERIODS = [
  { days: 7, label: '7 أيام' },
  { days: 30, label: '30 يوماً' },
  { days: 90, label: '90 يوماً' },
]

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** الفترة تنتهي الآن وتبدأ أول يومها الأول؛ والسابقة بطولها نفسه للمقارنة */
export function periodRange(days, now = new Date()) {
  const from = addDays(startOfDay(now), -(days - 1))
  return { from, to: now, prevFrom: addDays(from, -days), prevTo: from }
}

/** كل أيام الفترة بالترتيب، واليوم بلا نشاط صفر */
export function fillDays(rows, from, days) {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return Array.from({ length: days }, (_, i) => {
    const day = ymd(addDays(from, i))
    const r = byDay.get(day)
    return { day, devices: r?.devices ?? 0, opens: r?.opens ?? 0, exports: r?.exports ?? 0, views: r?.views ?? 0, viewers: r?.viewers ?? 0, exporters: r?.exporters ?? 0 }
  })
}

/** «+20%» أو «−25%» عن الفترة السابقة — لا شيء حين لا أساس */
export function deltaText(now, before) {
  if (!before) return null
  const pct = Math.round(((now - before) / before) * 100)
  return { text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`, up: pct >= 0 }
}

/**
 * نسبة من شاهد قالباً فصدّره — بالجلسات (exporters/viewers) لا بالأحداث: المشاهدة الواحدة قد تنتهي
 * بحفظ ومشاركة معاً. لا تتجاوز 100%: تصدير بلا مشاهدة مسجّلة يأتي من إصدارات أقدم.
 */
export function exportRate(exporters, viewers) {
  return viewers ? Math.min(100, Math.round((exporters / viewers) * 100)) : null
}

const coverOf = (t) => t.thumbnail_url || t.image_url || null
const visible = (t) => t.is_visible !== false

/** التصدير والمشاهدة لكل مناسبة، الأكثر تصديراً أولاً، وغلافها أكثر قوالبها تصديراً */
export function byOccasion(stats, overview) {
  const byId = new Map(overview.map((t) => [t.id, t]))
  const acc = new Map()
  for (const s of stats) {
    const t = byId.get(s.template_id)
    if (!t) continue
    const o = acc.get(t.category) ?? { key: t.category, label: OCCASION_LABEL[t.category] ?? t.category, exports: 0, views: 0, exporters: 0, viewers: 0, best: null }
    o.exports += s.exports
    o.views += s.views
    o.exporters += s.exporters ?? 0
    o.viewers += s.viewers ?? 0
    if (!o.best || s.exports > o.best.exports) o.best = { exports: s.exports, cover: coverOf(t) }
    acc.set(t.category, o)
  }
  return [...acc.values()]
    .filter((o) => o.exports + o.views > 0)
    .map(({ best, exporters, viewers, ...o }) => ({
      ...o, rate: exportRate(exporters, viewers), cover: best?.cover ?? null,
      templates: overview.filter((t) => t.category === o.key && visible(t)).length,
    }))
    .sort((a, b) => b.exports - a.exports)
}

/** قوالب ظاهرة أقدم من الفترة لم يصدّرها أحد فيها — مرشّحة للإخفاء أو لتبديل صورتها */
export function idleTemplates(stats, overview, from) {
  const s = new Map(stats.map((x) => [x.template_id, x]))
  return overview
    .filter((t) => visible(t) && t.created_at && new Date(t.created_at) < from && !(s.get(t.id)?.exports > 0))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((t) => ({ id: t.id, category: t.category, cover: coverOf(t), views: s.get(t.id)?.views ?? 0, created_at: t.created_at }))
}

/** الأكثر تصديراً مع نسبة التصدير من المشاهدة */
export function topWithRate(stats, overview, n = 10) {
  const byId = new Map(overview.map((t) => [t.id, t]))
  return stats
    .filter((s) => s.exports > 0 && byId.has(s.template_id))
    .sort((a, b) => b.exports - a.exports)
    .slice(0, n)
    .map((s) => {
      const t = byId.get(s.template_id)
      return { id: t.id, category: t.category, cover: coverOf(t), exports: s.exports, views: s.views, rate: exportRate(s.exporters ?? 0, s.viewers ?? 0) }
    })
}

/** أزحم ساعتين متتاليتين لفتح التطبيق (تلتف بعد منتصف الليل) — أفضل وقت لإشعار */
export function bestWindow(hours) {
  const opens = new Array(24).fill(0)
  for (const h of hours) opens[h.hour] = h.opens
  const total = opens.reduce((a, b) => a + b, 0)
  let start = 0, best = -1
  for (let h = 0; h < 24; h++) {
    const v = opens[h] + opens[(h + 1) % 24]
    if (v > best) { best = v; start = h }
  }
  return { start, end: (start + 2) % 24, share: total ? Math.round((best / total) * 100) : 0, opens }
}

/** الساعة كما تُقال: 8 مساءً، 9 صباحاً، 12 ظهراً */
export function hourLabel(h) {
  const n = h % 12 || 12
  const part = h < 5 ? 'ليلاً' : h < 12 ? 'صباحاً' : h < 15 ? 'ظهراً' : h < 18 ? 'عصراً' : 'مساءً'
  return `${n} ${part}`
}

const versionKey = (v) => v.split('.').map((x) => parseInt(x, 10) || 0)
const compareVersions = (a, b) => {
  const x = versionKey(a), y = versionKey(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0)
  return 0
}

/** إصدارات التطبيق على الأجهزة، الأحدث أولاً، وحصة كل منها */
export function versionShares(rows) {
  const total = rows.reduce((s, r) => s + r.devices, 0)
  return [...rows]
    .sort((a, b) => compareVersions(a.app_version, b.app_version))
    .map((r) => ({ version: r.app_version, devices: r.devices, share: total ? Math.round((r.devices / total) * 100) : 0 }))
}

/** أسعار «نصّ المميز» محوّلة إلى ما يعادل شهراً — تقدير قبل اقتطاع آبل وقبل الضريبة */
const PLANS = [
  { id: 'com.nass.premium.yearly', label: 'سنوي', perMonth: 19.99 / 12 },
  { id: 'com.nass.premium.monthly', label: 'شهري', perMonth: 3.99 },
  { id: 'com.nass.premium.weekly', label: 'أسبوعي', perMonth: (1.49 * 52) / 12 },
]

export function subscriptionSummary(rows) {
  const count = new Map(rows.map((r) => [r.product_id, Number(r.active)]))
  const plans = PLANS.map((p) => ({ label: p.label, count: count.get(p.id) ?? 0, perMonth: p.perMonth })).filter((p) => p.count > 0)
  return {
    total: plans.reduce((s, p) => s + p.count, 0),
    plans: plans.map(({ label, count: c }) => ({ label, count: c })),
    monthly: Math.round(plans.reduce((s, p) => s + p.count * p.perMonth, 0) * 100) / 100,
  }
}
