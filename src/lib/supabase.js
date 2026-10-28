import { createClient } from '@supabase/supabase-js'
import { getCdnUrl } from './cdn'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// لا مفتاح سري في المتصفح أبداً: الرفع والحذف يمرّان بجلسة المشرف المسجّل،
// وصلاحيات التخزين على الخادم تسمح للمشرف فقط

// ─── Storage helpers ────────────────────────────────────────────────────────

const BUCKET = 'templates'

/** رفع ملف إلى Storage وإرجاع الـ URL العام */
export async function uploadFile(file, folder = 'images') {
  const ext = file.name.split('.').pop()
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  const publicUrl = getCdnUrl(data.publicUrl)
  return { publicUrl, fileName }
}

/** حذف ملف من Storage */
export async function deleteFile(fileName) {
  const { error } = await supabase.storage.from(BUCKET).remove([fileName])
  if (error) throw error
}

// ─── Templates CRUD ─────────────────────────────────────────────────────────

export async function fetchTemplates(category) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** كل القوالب بالحقول الخفيفة — للعدّادات وصور المناسبات ودفعة «ضع الاسم» في طلب واحد */
export async function fetchTemplatesOverview() {
  const { data, error } = await supabase
    .from('templates')
    .select('id, category, type, is_premium, is_visible, image_url, thumbnail_url, video_url, text_appear_time, name_position_x, name_position_y, created_at')
    .order('created_at', { ascending: false })
    .range(0, 4999)
  if (error) throw error
  return data
}

export async function fetchTemplateCount(category) {
  const { count, error } = await supabase
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('category', category)
  if (error) throw error
  return count ?? 0
}

export async function insertTemplate(payload) {
  const { data, error } = await supabase.from('templates').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTemplate(id, payload) {
  const { data, error } = await supabase
    .from('templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw error
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

export async function updateTemplatesVisibility(ids, isVisible) {
  // updated_at: الأجوال تزامن بالفرق عليه — بدونه لا يصلها الإخفاء
  const { error } = await supabase
    .from('templates')
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function deleteTemplates(ids) {
  const { error } = await supabase.from('templates').delete().in('id', ids)
  if (error) throw error
}

// ─── «اليوم» ─────────────────────────────────────────────────────────────────

const EXPORT_EVENTS = ['template_saved', 'template_shared']
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

/** الخادم يعيد 1000 صف في الطلب — تُجلب صفحة بعد صفحة حتى `cap` */
async function pageAll(build, cap = 20000) {
  const all = []
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  return all
}

async function headCount(query) {
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

/** التصدير (حفظ + مشاركة) لكل يوم من آخر `days` يوماً، الأقدم أولاً واليوم آخراً */
export async function fetchExportSeries(days = 15, now = new Date()) {
  const today = startOfDay(now)
  return Promise.all(Array.from({ length: days }, (_, i) => {
    const from = new Date(today); from.setDate(today.getDate() - (days - 1 - i))
    const to = new Date(from); to.setDate(from.getDate() + 1)
    return headCount(supabase.from('analytics_events').select('id', { count: 'exact', head: true })
      .in('event_name', EXPORT_EVENTS).gte('created_at', from.toISOString()).lt('created_at', to.toISOString()))
  }))
}

/** معرّفات القوالب المصدَّرة في آخر 7 أيام — للأكثر تصديراً */
export async function fetchWeekExportIds(now = new Date()) {
  const from = startOfDay(now); from.setDate(from.getDate() - 7)
  const rows = await pageAll(() => supabase.from('analytics_events').select('template_id')
    .in('event_name', EXPORT_EVENTS).gte('created_at', from.toISOString()).order('created_at', { ascending: false }))
  return rows.map((r) => r.template_id)
}

/** الأجهزة التي فتحت التطبيق اليوم (جلسات بلا تكرار الجهاز) */
export async function fetchTodayDevices(now = new Date()) {
  const rows = await pageAll(() => supabase.from('user_sessions').select('device_id')
    .gte('created_at', startOfDay(now).toISOString()).order('created_at', { ascending: false }))
  return rows
}

/** مشتركو «نصّ المميز» الفعليون (لا Sandbox) */
export function fetchActiveSubscribers() {
  return headCount(supabase.from('entitlements').select('id', { count: 'exact', head: true })
    .in('status', ['active', 'grace']).eq('environment', 'production'))
}

export function fetchStudioDraftCount() {
  return headCount(supabase.from('design_templates').select('id', { count: 'exact', head: true }).eq('status', 'draft'))
}

export function fetchFailedPushCount(now = new Date()) {
  const from = startOfDay(now); from.setDate(from.getDate() - 7)
  return headCount(supabase.from('push_notifications').select('id', { count: 'exact', head: true })
    .eq('status', 'failed').gte('created_at', from.toISOString()))
}

// ─── «الأرقام» (ملخصات القاعدة: migration 20261029010000_admin_stats) ─────────

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh'

/** دالة الملخص غير موجودة بعد في القاعدة ⇒ اللوحة تطلب التحديث بدل رسالة خطأ */
export class StatsNeedUpdate extends Error {}

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    if (error.code === 'PGRST202' || /Could not find the function/i.test(error.message)) throw new StatsNeedUpdate(name)
    throw error
  }
  return data
}

/** كل ملخصات فترة واحدة + مجاميع الفترة السابقة للمقارنة */
export async function fetchStats({ from, to, prevFrom, prevTo }) {
  const range = { p_from: from.toISOString(), p_to: to.toISOString() }
  const [totals, prev, daily, templates, hours, versions, subscribers] = await Promise.all([
    rpc('admin_stats_totals', range),
    rpc('admin_stats_totals', { p_from: prevFrom.toISOString(), p_to: prevTo.toISOString() }),
    rpc('admin_stats_daily', { ...range, p_tz: TZ }),
    rpc('admin_stats_templates', range),
    rpc('admin_stats_hours', { ...range, p_tz: TZ }),
    rpc('admin_stats_versions', range),
    rpc('admin_stats_subscribers'),
  ])
  return { totals: totals[0], prev: prev[0], daily, templates, hours, versions, subscribers }
}

// ─── App Updates ─────────────────────────────────────────────────────────────

export async function fetchAppUpdates() {
  const { data, error } = await supabase
    .from('app_updates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createAppUpdate(payload) {
  const { data, error } = await supabase
    .from('app_updates')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleAppUpdate(id, isActive) {
  if (isActive) {
    const { error: deactivateError } = await supabase
      .from('app_updates')
      .update({ is_active: false })
      .neq('id', id)
    if (deactivateError) throw deactivateError
  }
  const { data, error } = await supabase
    .from('app_updates')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAppUpdate(id) {
  const { error } = await supabase.from('app_updates').delete().eq('id', id)
  if (error) throw error
}

export async function uploadUpdateImage(file) {
  const ext = file.name.split('.').pop()
  const fileName = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('updates')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('updates').getPublicUrl(fileName)
  return getCdnUrl(data.publicUrl)
}
