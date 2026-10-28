import { createClient } from '@supabase/supabase-js'
import { getCdnUrl, extractStoragePath } from './cdn'

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

/** إشعارات الأسبوع التي لم تصل: فشلت، أو فات موعدها وهي تنتظر (لم يرسلها أحد) */
export async function fetchFailedPushCount(now = new Date()) {
  const from = startOfDay(now); from.setDate(from.getDate() - 7)
  const late = new Date(now.getTime() - 3 * 60e3).toISOString()
  const [failed, stuck] = await Promise.all([
    headCount(supabase.from('push_notifications').select('id', { count: 'exact', head: true })
      .eq('status', 'failed').gte('created_at', from.toISOString())),
    headCount(supabase.from('push_notifications').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'scheduled']).gte('created_at', from.toISOString())
      .or(`scheduled_at.lt.${late},and(scheduled_at.is.null,created_at.lt.${late})`)),
  ])
  return failed + stuck
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

// ─── «التواصل»: الإشعارات ────────────────────────────────────────────────────

export async function fetchNotifications(limit = 60) {
  const { data, error } = await supabase.from('push_notifications').select('*')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

/** الأجهزة المسجّلة للإشعارات: الكل ولكل دولة */
export async function fetchAudienceCounts() {
  const rows = await pageAll(() => supabase.from('device_tokens').select('country_code').eq('is_active', true).order('id'))
  const counts = { all: rows.length }
  for (const r of rows) if (r.country_code) counts[r.country_code] = (counts[r.country_code] ?? 0) + 1
  return counts
}

export async function createNotification(payload) {
  const { data, error } = await supabase.from('push_notifications').insert(payload).select().single()
  if (error) throw error
  return data
}

/** يرسل الآن بجلسة المشرف — دالة الإرسال في الخادم تتحقق أنه مشرف */
export async function sendNotification(id) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: supabaseAnonKey },
    body: JSON.stringify({ notification_id: id }),
  })
  // fetch لا يرمي على 401/500 — بدون هذا يبقى الإشعار «يُرسل» بلا سبب
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

/** فشل الاتصال بدالة الإرسال قبل أن تبدأ ⇒ يُسجَّل السبب في الصف كي لا يبقى «في الانتظار» بلا تفسير */
export async function markNotificationFailed(id, message) {
  await supabase.from('push_notifications').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending')
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('push_notifications').delete().eq('id', id)
  if (error) throw error
}

/** هل يرسل الخادم المجدولة بنفسه؟ null = التحديث لم يُشغَّل في القاعدة بعد */
export async function fetchSchedulerReady() {
  try {
    return await rpc('push_scheduler_ready')
  } catch (e) {
    if (e instanceof StatsNeedUpdate) return null
    throw e
  }
}

/** ساعات فتح التطبيق وإصداراته في آخر `days` يوماً — لأفضل وقت ولمن سيرى رسالة التحديث */
export async function fetchReachStats(days = 30, now = new Date()) {
  const from = startOfDay(now); from.setDate(from.getDate() - (days - 1))
  const range = { p_from: from.toISOString(), p_to: now.toISOString() }
  const [hours, versions] = await Promise.all([
    rpc('admin_stats_hours', { ...range, p_tz: TZ }),
    rpc('admin_stats_versions', range),
  ])
  return { hours, versions }
}

// ─── «الدخل»: الإعلانات ──────────────────────────────────────────────────────

export async function fetchAdsSettings() {
  const { data, error } = await supabase.from('ads_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}

export async function saveAdsSettings(patch) {
  const { data, error } = await supabase.from('ads_settings')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}

export async function fetchCustomAds() {
  const { data, error } = await supabase.from('custom_ads').select('*')
    .order('priority', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** الإعلان الذي يراه التطبيق الآن — من العرض نفسه الذي يقرؤه التطبيق */
export async function fetchLiveAdId() {
  const { data, error } = await supabase.from('active_custom_ad_now').select('id').maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function saveCustomAd(payload, id) {
  const q = id
    ? supabase.from('custom_ads').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    : supabase.from('custom_ads').insert(payload)
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}

export async function deleteCustomAd(ad) {
  const { error } = await supabase.from('custom_ads').delete().eq('id', ad.id)
  if (error) throw error
  const files = [ad.image_url, ad.video_url].map((u) => extractStoragePath(u, 'ads')).filter(Boolean)
  if (files.length) await supabase.storage.from('ads').remove(files)
}

export async function uploadAdMedia(file) {
  const kind = file.type.startsWith('video/') ? 'videos' : 'images'
  const ext = file.name.split('.').pop()
  const path = `${kind}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('ads').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return getCdnUrl(supabase.storage.from('ads').getPublicUrl(path).data.publicUrl)
}

export function fetchSubscribers() {
  return rpc('admin_stats_subscribers')
}
