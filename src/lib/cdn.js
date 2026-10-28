export const getCdnUrl = (url) => {
  if (!url) return url
  // افتراضي مدمج: نسخة تطبيق المتجر تحوّل روابط supabase.co المباشرة إلى مسار CDN خاطئ
  // فتظهر الصورة فارغة — لذا لا نحفظ رابطاً مباشراً أبداً. قيمة فارغة صريحة تعطّله (للتطوير المحلي)
  const cdnDomain = import.meta.env.VITE_CDN_DOMAIN ?? 'https://cdn.ibsleman.com'
  if (!cdnDomain) return url
  const base = cdnDomain.replace(/\/$/, '')
  return url.replace(
    /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//,
    `${base}/`
  )
}

const cdnHosts = () => {
  const hosts = new Set(['cdn.ibsleman.com'])
  try { if (import.meta.env.VITE_CDN_DOMAIN) hosts.add(new URL(import.meta.env.VITE_CDN_DOMAIN).host) } catch { /* قيمة غير صالحة */ }
  return hosts
}

/** مسار الملف داخل الحاوية من رابط محفوظ — مباشر أو عبر CDN (وهو ما تحفظه القاعدة في الإنتاج) */
export function extractStoragePath(url, bucket = 'templates') {
  if (!url) return null
  try {
    const u = new URL(url)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx !== -1) return decodeURIComponent(u.pathname.slice(idx + marker.length))
    if (cdnHosts().has(u.host) && u.pathname.startsWith(`/${bucket}/`)) return decodeURIComponent(u.pathname.slice(bucket.length + 2))
    return null
  } catch {
    return null
  }
}
