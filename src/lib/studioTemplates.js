import { supabase } from './supabase'
import { OCCASIONS } from './occasions'

/** مناسبات الرئيسية الـ11 — القسم الصالح للنشر */
export const HOME_CATEGORIES = OCCASIONS
const HOME_KEYS = new Set(HOME_CATEGORIES.map((c) => c.key))

export const STATUS_LABELS = { draft: 'مسودات', published: 'منشور', archived: 'مؤرشف' }

/** الاستوديو يرفع `thumb.jpg` بجانب `bundle.aar` في مجلد النسخة */
export function thumbnailFor(version) {
  if (!version?.bundle_url) return null
  return version.bundle_url.replace(/bundle\.aar$/, 'thumb.jpg')
}

export function latestVersion(template) {
  const list = template?.design_template_versions ?? []
  if (list.length === 0) return null
  return [...list].sort((a, b) => b.version - a.version)[0]
}

export function liveVersion(template) {
  return (template?.design_template_versions ?? []).find((v) => v.version === template.current_version) ?? null
}

/** صورة البطاقة: المنشورة إن وُجدت وإلا مصغّرة آخر نسخة */
export function cardThumbnail(template) {
  return template.thumbnail_url || thumbnailFor(latestVersion(template))
}

export function validatePublish(form, version) {
  if (!version) return 'اختر نسخة للنشر'
  if (!form.name_ar?.trim()) return 'الاسم مطلوب'
  if (!HOME_KEYS.has(form.category_id)) return 'القسم يجب أن يكون إحدى مناسبات الرئيسية'
  if (form.publish_from && form.publish_until && form.publish_from > form.publish_until) return 'تاريخ النهاية قبل تاريخ البداية'
  return null
}

/**
 * ما يُكتب على الصف. `published` يوجّه النسخة الحية ومصغّرتها؛
 * الأرشفة والإرجاع لمسودة لا يلمسان النسخة الحية (الرجوع للنشر يعيدها كما كانت).
 */
export function publishPatch(form, version, status) {
  const patch = {
    name_ar: form.name_ar?.trim() ?? '',
    category_id: form.category_id,
    occasion: form.occasion?.trim() ? form.occasion.trim() : null,
    is_premium: !!form.is_premium,
    sort_order: Number(form.sort_order) || 0,
    publish_from: form.publish_from || null,
    publish_until: form.publish_until || null,
    status,
  }
  if (status === 'published') {
    patch.current_version = version.version
    patch.thumbnail_url = thumbnailFor(version)
  }
  return patch
}

export function groupByStatus(templates) {
  const byNewest = (a, b) => (latestVersion(b)?.created_at ?? '').localeCompare(latestVersion(a)?.created_at ?? '')
  const groups = { draft: [], published: [], archived: [] }
  for (const t of templates) (groups[t.status] ?? groups.draft).push(t)
  groups.draft.sort(byNewest)
  groups.published.sort((a, b) => a.sort_order - b.sort_order || byNewest(a, b))
  groups.archived.sort(byNewest)
  return groups
}

// ─── الخادم (جلسة المشرف — سياسات admin_write_*) ─────────────────────────────

export async function fetchStudioTemplates() {
  const { data, error } = await supabase
    .from('design_templates')
    .select('id, slug, category_id, occasion, name_ar, status, is_premium, sort_order, current_version, min_app_build, canvas_w, canvas_h, thumbnail_url, publish_from, publish_until, created_at, updated_at, design_template_versions(version, schema_version, bundle_url, bundle_bytes, font_ids, element_ids, stress_test_urls, created_at)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateStudioTemplate(id, patch) {
  const { data, error } = await supabase
    .from('design_templates')
    .update(patch)
    .eq('id', id)
    .select('id, status, current_version, thumbnail_url, updated_at')
    .single()
  if (error) throw error
  return data
}
