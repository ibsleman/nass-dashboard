import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { backfillThumbnails, needsThumbnail, thumbnailFile, thumbnailFromUrl, thumbnailFromVideo } from '../lib/thumbnail'
import { countAr } from '../lib/today'
import { updateTemplate, uploadFile } from '../lib/supabase'

/**
 * مرة واحدة للقوالب القديمة: تُحمَّل الصورة الكاملة، تُصغَّر في المتصفح، تُرفع، ويُكتب thumbnail_url.
 * الأجوال تلتقطها في مزامنتها التالية (updated_at يرتفع مع الحفظ) فتصير شبكاتها أخف أيضاً.
 */
export default function ThumbnailsBackfill({ overview, onChanged }) {
  const reduce = useReducedMotion()
  const [run, setRun] = useState(null) // { done, failed, total, finished }
  const ctrl = useRef(null)
  const todo = (overview ?? []).filter(needsThumbnail)
  if (!overview || (!todo.length && !run)) return null

  const start = async () => {
    ctrl.current = new AbortController()
    setRun({ done: 0, failed: 0, total: todo.length })
    const r = await backfillThumbnails(todo, {
      make: (t) => (t.type === 'video' ? thumbnailFromVideo(t.video_url, t.text_appear_time ?? 1) : thumbnailFromUrl(t.image_url)),
      upload: async (blob) => (await uploadFile(thumbnailFile(blob), 'thumbnails')).publicUrl,
      save: (t, url) => updateTemplate(t.id, { thumbnail_url: url, updated_at: new Date().toISOString() }),
      onProgress: (p) => setRun((r) => ({ ...r, ...p })),
      signal: ctrl.current.signal,
    })
    setRun((s) => ({ ...s, done: r.done, failed: r.failed.length, finished: true }))
    onChanged?.()
  }

  const working = run && !run.finished
  const pct = run ? Math.round(((run.done + run.failed) / run.total) * 100) : 0

  return (
    <section className="grid gap-3 rounded-card border border-gold/30 bg-gold/10 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-live="polite">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-bold">
          {run?.finished
            ? `صُنعت ${countAr(run.done, 'thumbnail')}${run.failed ? ` · تعذّرت ${run.failed}` : ''}`
            : `${countAr(todo.length, 'template')} بلا صورة مصغّرة`}
        </h2>
        <p className="text-[13px] text-ink-2">
          {run?.finished
            ? 'الشبكات هنا وفي التطبيق صارت تحمّل الصورة الصغيرة. الأجوال تأخذها في مزامنتها التالية.'
            : 'كل بطاقة هنا وفي شبكات التطبيق تحمّل الصورة الكاملة (نحو 1.3 م.ب). اصنعها مرة واحدة، تستغرق دقائق ولا تغيّر القوالب نفسها.'}
        </p>
        {run && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
            <motion.i
              className="block h-full rounded-full bg-gold"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 224, damping: 27.5 }}
            />
          </div>
        )}
        {working && <p className="num text-[11px] text-ink-2">{run.done + run.failed} من {run.total}</p>}
      </div>
      {!run?.finished && (
        working ? (
          <button type="button" onClick={() => ctrl.current?.abort()} className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold">
            أوقف
          </button>
        ) : (
          <button type="button" onClick={start} className="min-h-11 rounded-xl bg-gold px-4 text-[13px] font-semibold text-gold-on">
            اصنعها الآن
          </button>
        )
      )}
    </section>
  )
}
