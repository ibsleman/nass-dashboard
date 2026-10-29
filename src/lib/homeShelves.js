// رفوف الرئيسية («رائج اليوم» و«جديدنا») — حالة كل رف: وضع + قوائم (مثبّت/مخفي للتلقائي، اختيار لليدوي).
// دوال خالصة: كل فعل يعيد الحالة الكاملة التالية، فتُحفظ دفعة واحدة (admin_set_home_shelf) ويتراجع عنها بالمثل.
// الترتيب نفسه يحسبه الخادم (home_shelf_compute) — هنا لا يُعاد حسابه.

export const SHELF_LIMIT = 12

export const SHELVES = [
  { key: 'trending', label: 'رائج اليوم', rule: 'المثبّت أولاً، ثم الرائج في آخر 24 ساعة، ثم آخر 7 أيام، ثم الأحدث. 3 قوالب كحد أقصى من كل مناسبة.' },
  { key: 'new', label: 'جديدنا', rule: 'المثبّت أولاً، ثم الأحدث نشراً. 3 قوالب كحد أقصى من كل مناسبة.' },
]

export const REASON_LABEL = { pin: 'مثبّت', today: 'رائج اليوم', week: 'رائج الأسبوع', newest: 'الأحدث', manual: 'اختيارك' }

const listOf = (s, kind) => s.items.filter((i) => i.kind === kind).sort((a, b) => a.position - b.position)
const withList = (s, kind, idList) => ({
  ...s,
  items: [...s.items.filter((i) => i.kind !== kind), ...idList.map((template_id, position) => ({ kind, template_id, position }))],
})
const idsOf = (s, kind) => listOf(s, kind).map((i) => i.template_id)
const without = (arr, id) => arr.filter((x) => x !== id)

export function togglePin(s, id) {
  const pins = idsOf(s, 'pin')
  const next = withList(s, 'pin', pins.includes(id) ? without(pins, id) : [...pins, id])
  return withList(next, 'hide', without(idsOf(next, 'hide'), id))
}

export function toggleHide(s, id) {
  const hides = idsOf(s, 'hide')
  const next = withList(s, 'hide', hides.includes(id) ? without(hides, id) : [...hides, id])
  return withList(next, 'pin', without(idsOf(next, 'pin'), id))
}

export function addPick(s, id) {
  const picks = idsOf(s, 'pick')
  if (picks.includes(id) || picks.length >= SHELF_LIMIT) return s
  return withList(s, 'pick', [...picks, id])
}

export const removePick = (s, id) => withList(s, 'pick', without(idsOf(s, 'pick'), id))

/** يحرّك قالباً خطوة داخل قائمته (المثبّتات أو الاختيارات): -1 للأمام، 1 للخلف */
export function move(s, kind, id, dir) {
  const list = idsOf(s, kind)
  const i = list.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return s
  ;[list[i], list[j]] = [list[j], list[i]]
  return withList(s, kind, list)
}

/** اليدوي لا يبدأ فارغاً: أول تحويل يأخذ ما يعرضه الرف الآن */
export function setMode(s, mode, shownIds = []) {
  const next = { ...s, mode }
  if (mode === 'manual' && idsOf(s, 'pick').length === 0) return withList(next, 'pick', shownIds.slice(0, SHELF_LIMIT))
  return next
}

/** ما في المكتبة وليس على الرف، بترتيبها */
export function restOf(catalog, shown) {
  const on = new Set(shown.map((r) => r.template_id))
  return catalog.filter((c) => !on.has(c.template_id))
}
