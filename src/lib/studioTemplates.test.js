import { describe, it, expect } from 'vitest'
import { thumbnailFor, latestVersion, publishPatch, validatePublish, groupByStatus } from './studioTemplates'

const v = (version, extra = {}) => ({
  version, bundle_url: `https://x.supabase.co/storage/v1/object/public/design-templates/t1/v${version}/abc/bundle.aar`,
  stress_test_urls: [], created_at: `2026-10-2${version}T00:00:00Z`, ...extra,
})
const t = (extra = {}) => ({
  id: 't1', name_ar: 'قالب', category_id: 'ramadan', status: 'draft', is_premium: false, sort_order: 0,
  current_version: null, thumbnail_url: null, publish_from: null, publish_until: null,
  design_template_versions: [v(1), v(2)], ...extra,
})

describe('thumbnailFor', () => {
  it('derives thumb.jpg beside the bundle of the version', () => {
    expect(thumbnailFor(v(2))).toBe('https://x.supabase.co/storage/v1/object/public/design-templates/t1/v2/abc/thumb.jpg')
  })
})

describe('latestVersion', () => {
  it('returns the highest version number', () => {
    expect(latestVersion(t()).version).toBe(2)
    expect(latestVersion(t({ design_template_versions: [] }))).toBeNull()
  })
})

describe('validatePublish', () => {
  it('requires a version, a home category and a name', () => {
    expect(validatePublish({ name_ar: 'x', category_id: 'ramadan' }, v(1))).toBeNull()
    expect(validatePublish({ name_ar: 'x', category_id: 'promo' }, v(1))).toMatch(/القسم/)
    expect(validatePublish({ name_ar: ' ', category_id: 'ramadan' }, v(1))).toMatch(/الاسم/)
    expect(validatePublish({ name_ar: 'x', category_id: 'ramadan' }, null)).toMatch(/نسخة/)
  })
  it('rejects a window that ends before it starts', () => {
    expect(validatePublish({ name_ar: 'x', category_id: 'ramadan', publish_from: '2026-03-01', publish_until: '2026-02-01' }, v(1))).toMatch(/تاريخ/)
  })
})

describe('publishPatch', () => {
  it('publishes the chosen version with its thumbnail and the metadata', () => {
    const patch = publishPatch({ name_ar: 'قالب', category_id: 'ramadan', occasion: '', is_premium: true, sort_order: '3', publish_from: '', publish_until: '2026-04-01' }, v(1), 'published')
    expect(patch).toEqual({
      name_ar: 'قالب', category_id: 'ramadan', occasion: null, is_premium: true, sort_order: 3,
      publish_from: null, publish_until: '2026-04-01', status: 'published', current_version: 1,
      thumbnail_url: 'https://x.supabase.co/storage/v1/object/public/design-templates/t1/v1/abc/thumb.jpg',
    })
  })
  it('archiving or drafting keeps current_version untouched', () => {
    const patch = publishPatch({ name_ar: 'قالب', category_id: 'ramadan', sort_order: 0 }, v(1), 'archived')
    expect(patch.status).toBe('archived')
    expect(patch).not.toHaveProperty('current_version')
    expect(patch).not.toHaveProperty('thumbnail_url')
  })
})

describe('groupByStatus', () => {
  it('buckets templates and sorts drafts by newest version', () => {
    const a = t({ id: 'a', design_template_versions: [v(1)] })
    const b = t({ id: 'b', design_template_versions: [v(3)] })
    const p = t({ id: 'p', status: 'published' })
    const g = groupByStatus([a, p, b])
    expect(g.draft.map((x) => x.id)).toEqual(['b', 'a'])
    expect(g.published.map((x) => x.id)).toEqual(['p'])
    expect(g.archived).toEqual([])
  })
})
