import { describe, it, expect } from 'vitest'
import { extractStoragePath } from './cdn'

describe('storage path from a saved link', () => {
  it('reads direct storage links', () => {
    expect(extractStoragePath('https://abc.supabase.co/storage/v1/object/public/templates/images/1_a.png')).toBe('images/1_a.png')
    expect(extractStoragePath('http://127.0.0.1:55321/storage/v1/object/public/ads/videos/2_b.mp4', 'ads')).toBe('videos/2_b.mp4')
  })

  it('reads CDN links — what the database actually holds in production', () => {
    expect(extractStoragePath('https://cdn.ibsleman.com/templates/images/1_a.png')).toBe('images/1_a.png')
    expect(extractStoragePath('https://cdn.ibsleman.com/ads/images/3_c.jpg', 'ads')).toBe('images/3_c.jpg')
  })

  it('ignores other buckets and outside links', () => {
    expect(extractStoragePath('https://cdn.ibsleman.com/updates/images/1.png', 'ads')).toBeNull()
    expect(extractStoragePath('https://example.com/templates/images/1.png')).toBeNull()
    expect(extractStoragePath('not a url')).toBeNull()
    expect(extractStoragePath(null)).toBeNull()
  })
})
