import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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
  const publicUrl = data.publicUrl.replace('https://dlecapxnppfmpokoitek.supabase.co', 'https://cdn.ibsleman.com')
  return { publicUrl, fileName }
}

/** حذف ملف من Storage */
export async function deleteFile(fileName) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([fileName])
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
  const { data, error } = await supabaseAdmin.from('templates').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTemplate(id, payload) {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabaseAdmin.from('templates').delete().eq('id', id)
  if (error) throw error
}
