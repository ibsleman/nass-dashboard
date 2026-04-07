export const getCdnUrl = (url) => {
  if (!url) return url
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const cdnDomain = import.meta.env.VITE_CDN_DOMAIN
  if (!supabaseUrl || !cdnDomain) return url
  return url.replace(supabaseUrl, cdnDomain)
}

export function extractStoragePath(url, bucket = 'templates') {
  if (!url) return null
  try {
    const u = new URL(url)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return u.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}
