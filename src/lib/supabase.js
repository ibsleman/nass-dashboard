import { createClient } from '@supabase/supabase-js'
import { getCdnUrl } from './cdn'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase

// ─── Storage helpers ────────────────────────────────────────────────────────

const BUCKET = 'templates'

/** رفع ملف إلى Storage وإرجاع الـ URL العام */
export async function uploadFile(file, folder = 'images') {
  const ext = file.name.split('.').pop()
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName)
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
  const { error } = await supabase
    .from('templates')
    .update({ is_visible: isVisible })
    .in('id', ids)
  if (error) throw error
}

export async function deleteTemplates(ids) {
  const { error } = await supabase.from('templates').delete().in('id', ids)
  if (error) throw error
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
  const { error } = await supabaseAdmin.storage
    .from('updates')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabaseAdmin.storage.from('updates').getPublicUrl(fileName)
  return getCdnUrl(data.publicUrl)
}
