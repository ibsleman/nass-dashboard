// ترتيب المناسبات في رئيسية التطبيق — نفس قاعدة التطبيق (Category.sorted + fetchCategoryOrder):
// المفعّلة برقمها، وما لا رقم له أو مُطفأ يأتي في الآخر بترتيب التطبيق الأصلي (التطبيق لا يخفيه).
import { OCCASION_KEYS } from './occasions'

/** البطاقات الظاهرة دون تمرير على آيفون 393pt: هامش 20 + بطاقة 84 + فراغ 12 ⇒ الرابعة تنتهي عند 392 */
export const FIRST_SCREEN = 4

export function appOrder(rows) {
  const order = new Map(rows.filter((r) => r.is_active).map((r) => [r.key, r.display_order]))
  return [...OCCASION_KEYS].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}

/** الأرقام 1..n حسب الترتيب الجديد، للصفوف التي تغيّر رقمها فقط */
export function orderPatch(rows, keys) {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return keys
    .map((k, i) => ({ row: byKey.get(k), display_order: i + 1 }))
    .filter(({ row, display_order }) => row && row.display_order !== display_order)
    .map(({ row, display_order }) => ({ id: row.id, display_order }))
}

/** نقل بطاقة خطوة للأمام (-1) أو للخلف (+1) — من لوحة المفاتيح */
export function moveKey(keys, key, delta) {
  const i = keys.indexOf(key)
  const j = i + delta
  if (i < 0 || j < 0 || j >= keys.length) return keys
  const next = [...keys]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** موسم خلال 30 يوماً لا يراه الناس دون تمرير — يُقترح تقديمه */
export function seasonNudge(seasons, keys) {
  const s = seasons
    .filter((x) => x.days != null && x.days >= 0 && x.days <= 30)
    .map((x) => ({ key: x.key, label: x.label, days: x.days, position: keys.indexOf(x.key) + 1 }))
    .find((x) => x.position > FIRST_SCREEN)
  return s ?? null
}
