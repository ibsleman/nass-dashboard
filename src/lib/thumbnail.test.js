import { describe, it, expect } from 'vitest'
import { thumbSize, hasAlpha, needsThumbnail, backfillThumbnails, THUMB_MAX_W } from './thumbnail'

describe('thumbSize — sharp enough for the app grid, never upscaled', () => {
  it('a 1080×1920 template becomes 600 wide, same shape', () => {
    expect(THUMB_MAX_W).toBe(600)
    expect(thumbSize(1080, 1920)).toEqual({ w: 600, h: 1067 })
  })
  it('a small image stays as it is', () => {
    expect(thumbSize(420, 640)).toEqual({ w: 420, h: 640 })
  })
  it('a very tall image is capped by height', () => {
    expect(thumbSize(1080, 4000)).toEqual({ w: 324, h: 1200 })
  })
})

describe('hasAlpha — frames keep their photo window', () => {
  const px = (...alphas) => ({ data: new Uint8ClampedArray(alphas.flatMap((a) => [10, 20, 30, a])) })
  it('opaque', () => expect(hasAlpha(px(255, 255, 255))).toBe(false))
  it('any transparent pixel', () => expect(hasAlpha(px(255, 0, 255))).toBe(true))
  it('ignores a nearly opaque edge from compression', () => expect(hasAlpha(px(255, 252, 255))).toBe(false))
})

describe('needsThumbnail', () => {
  const t = (extra) => ({ id: '1', type: 'image', image_url: 'https://cdn/a.png', thumbnail_url: null, ...extra })
  it('an image without its own thumbnail needs one', () => {
    expect(needsThumbnail(t())).toBe(true)
    expect(needsThumbnail(t({ thumbnail_url: 'https://cdn/a.png' }))).toBe(true) // نسخة الصورة الكاملة نفسها
  })
  it('a real thumbnail is enough', () => {
    expect(needsThumbnail(t({ thumbnail_url: 'https://cdn/thumbnails/a.jpg' }))).toBe(false)
  })
  it('a video without a cover needs one; with a cover it does not', () => {
    expect(needsThumbnail(t({ type: 'video', image_url: null, video_url: 'https://cdn/v.mp4' }))).toBe(true)
    expect(needsThumbnail(t({ type: 'video', image_url: null, video_url: 'https://cdn/v.mp4', thumbnail_url: 'https://cdn/thumbnails/v.png' }))).toBe(false)
  })
  it('nothing to make it from', () => {
    expect(needsThumbnail(t({ image_url: null }))).toBe(false)
  })
})

describe('backfillThumbnails — one at a time, keeps going, can stop', () => {
  const rows = ['a', 'b', 'c'].map((id) => ({ id, type: 'image', image_url: `https://cdn/${id}.png`, thumbnail_url: null }))

  it('makes, uploads and saves each, reporting progress', async () => {
    const saved = [], progress = []
    const r = await backfillThumbnails(rows, {
      make: async (t) => `blob-${t.id}`,
      upload: async (blob) => `https://cdn/thumbnails/${blob}.jpg`,
      save: async (t, url) => saved.push([t.id, url]),
      onProgress: (p) => progress.push(p.done),
    })
    expect(saved).toEqual([['a', 'https://cdn/thumbnails/blob-a.jpg'], ['b', 'https://cdn/thumbnails/blob-b.jpg'], ['c', 'https://cdn/thumbnails/blob-c.jpg']])
    expect(progress).toEqual([1, 2, 3])
    expect(r).toEqual({ done: 3, failed: [] })
  })

  it('a broken template does not stop the rest', async () => {
    const r = await backfillThumbnails(rows, {
      make: async (t) => { if (t.id === 'b') throw new Error('تعذّر تحميل الصورة'); return t.id },
      upload: async (b) => b, save: async () => {},
    })
    expect(r.done).toBe(2)
    expect(r.failed).toEqual([{ id: 'b', error: 'تعذّر تحميل الصورة' }])
  })

  it('stops between templates when asked', async () => {
    const ctrl = new AbortController()
    const seen = []
    const r = await backfillThumbnails(rows, {
      make: async (t) => { seen.push(t.id); if (t.id === 'a') ctrl.abort(); return t.id },
      upload: async (b) => b, save: async () => {}, signal: ctrl.signal,
    })
    expect(seen).toEqual(['a'])
    expect(r.done).toBe(1)
  })
})
