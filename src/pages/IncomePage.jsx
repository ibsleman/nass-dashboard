import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import AdScreen, { AdMedia } from '../components/income/AdScreen'
import { PhoneFrame } from '../components/reach/PhoneFrame'
import HoldButton from '../components/HoldButton'
import Segmented, { SETTLE } from '../components/Segmented'
import Toast, { useToast } from '../components/Toast'
import {
  deleteCustomAd, fetchAdsSettings, fetchCustomAds, fetchLiveAdId, fetchSubscribers, saveAdsSettings, saveCustomAd, uploadAdMedia,
} from '../lib/supabase'
import { MODES, PLACEMENTS, dateLabel, adError, adPayload, adStatus, momentsSummary, nextPriority, placementMode, placementNote, placementPatch, placementShows } from '../lib/income'
import { subscriptionSummary } from '../lib/numbers'
import { countAr } from '../lib/today'

// «الدخل»: ثلاث لحظات في رحلة المستخدم المجاني — اختيار قالب، حفظ، مشاركة — وفي كل لحظة تقرر ماذا يرى.
// اختيار واحد لكل لحظة بدل مفتاحين متعارضين (جوجل/مخصص)، والهاتف الصغير فوقها يريك النتيجة،
// والجملة أعلاها تتغير في الإطار نفسه (مادة التزامن). القاعدة نفسها التي يقرر بها التطبيق.

const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const EMPTY_AD = {
  title: '', image_url: '', video_url: '', contact_label: '', contact_button_url: '', view_label: '', watch_button_url: '',
  countdown_secs: 5, start_date: '', end_date: '', show_on_select: true, show_on_save: true, show_on_share: true, is_active: true,
}

// ─── الهاتف الصغير: ما يظهر في اللحظة ─────────────────────────────────────────

function MiniScreen({ mode, ad }) {
  if (mode === 'custom' && ad) return <AdScreen ad={ad} mini />
  return (
    <div className="relative grid h-full place-items-center bg-[#f1efeb] text-[#5f5a52]">
      <span className="absolute left-2 top-7 rounded bg-[#5f5a52] px-1 text-[8px] font-bold text-white" dir="ltr">Ad</span>
      <span className="text-center text-[12px] font-semibold leading-relaxed">إعلان<br />من جوجل</span>
    </div>
  )
}

// الإعلان يصعد من أسفل كما يعرضه التطبيق (ورقة كاملة الشاشة)، ويحلّ فوق السابق ثم يُرفع السابق؛
// والعودة إلى «لا شيء» تُنزله فتظهر شاشة التطبيق تحته. بلا مزج شفافية بين شاشتين.
const SHEET = {
  enter: { y: '100%' },
  shown: { y: '0%', transition: SETTLE },
  // البقاء حتى تغطيه التالية يحتاج قيمة تتغير فعلاً، وإلا انتهى الخروج فوراً واختفى قبل أن يُغطّى
  leave: (next) => (next === 'none' ? { y: '100%', transition: SETTLE } : { opacity: 0, transition: { delay: 0.45, duration: 0 } }),
}

function Moment({ p, mode, shows, liveAd, onChange }) {
  // الهاتف يعرض ما يظهر فعلاً (قاعدة التطبيق)، والاختيار تحته هو ما تريده أنت
  const shownAd = shows === 'custom' ? liveAd : null
  const note = placementNote(mode, shows, liveAd, p.key)
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <div className="relative isolate h-[300px] w-[148px] rounded-[30px] bg-[#0b0a09] p-[5px] shadow-card ring-1 ring-black/40 dark:ring-white/[0.12]">
        <div className="relative h-full overflow-hidden rounded-[25px]">
          <span aria-hidden className="absolute left-1/2 top-[6px] z-10 h-[15px] w-[50px] -translate-x-1/2 rounded-full bg-black" />
          {/* تحت كل شيء: التطبيق يكمل بلا إعلان */}
          <div className="absolute inset-0 grid place-items-center bg-bg text-center text-[11px] leading-relaxed text-ink-2">
            <span>
              <span className="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-full bg-ok/15 text-ok">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2.5]"><path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              يكمل مباشرة<br />بلا إعلان
            </span>
          </div>
          <AnimatePresence initial={false} custom={shows}>
            {shows !== 'none' && (
              <motion.div key={`${shows}-${shownAd?.id ?? ''}`} className="absolute inset-0 shadow-[0_-12px_24px_-12px_rgb(0_0_0/0.5)]"
                custom={shows} variants={SHEET} initial="enter" animate="shown" exit="leave">
                <MiniScreen mode={shows} ad={shownAd} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="text-[15px] font-bold">{p.label}</p>
      <Segmented id={`moment-${p.key}`} label={p.label} value={mode} onChange={onChange} options={MODES} />
      <p className={`min-h-[36px] max-w-[230px] text-[12px] leading-relaxed ${note ? 'text-warn' : 'text-transparent'}`} aria-live="polite">{note ?? '—'}</p>
    </div>
  )
}

function Moments({ settings, liveAd, onChange }) {
  const modes = Object.fromEntries(PLACEMENTS.map((p) => [p.key, placementMode(settings, p.key)]))
  const shows = Object.fromEntries(PLACEMENTS.map((p) => [p.key, placementShows(settings, liveAd, p.key)]))
  const summary = momentsSummary(shows)
  return (
    <section className="rounded-card border border-hair bg-surface p-5 md:p-6" aria-label="ماذا يرى المستخدم المجاني">
      <h2 className="text-[17px] font-bold">ماذا يرى المستخدم المجاني</h2>
      {/* الجملة القديمة تخرج (110ms) ثم تُكتب الجديدة — لا سطران متراكبان */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={summary} className="mt-1 min-h-[21px] text-[14px] text-ink-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.11 } }} transition={POP}>
          {summary}
        </motion.p>
      </AnimatePresence>
      <div className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-4">
        {PLACEMENTS.map((p) => <Moment key={p.key} p={p} mode={modes[p.key]} shows={shows[p.key]} liveAd={liveAd} onChange={(m) => onChange(p.key, m)} />)}
      </div>
      <p className="mt-4 text-[12.5px] text-ink-2">مشتركو «نصّ المميز» لا يرون أي إعلان. أرباح جوجل في <a className="font-semibold text-gold" href="https://admob.google.com/v2/home" target="_blank" rel="noreferrer">AdMob</a>.</p>
    </section>
  )
}

// ─── «نصّ المميز» ─────────────────────────────────────────────────────────────

function Premium({ rows }) {
  const s = rows ? subscriptionSummary(rows) : null
  return (
    <section className="grid content-start gap-3 rounded-card border border-hair bg-surface p-5" aria-label="نصّ المميز">
      <h2 className="text-[17px] font-bold">نصّ المميز</h2>
      {!s ? (
        <div className="h-24 animate-pulse rounded-thumb bg-hair" />
      ) : (
        <>
          <p className="num text-[44px] font-extrabold leading-none">{s.total.toLocaleString('en-US')}</p>
          <p className="text-[13px] text-ink-2">{s.total ? `مشترك فعلي الآن (${s.plans.map((p) => `${p.label} ${p.count}`).join(' · ')})` : 'لا مشتركين فعليين بعد.'}</p>
          {s.total > 0 && (
            <p className="text-[14px]">نحو <span className="num font-bold">${s.monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> في الشهر قبل حصة آبل.</p>
          )}
          <a href="https://appstoreconnect.apple.com/" target="_blank" rel="noreferrer" className="mt-1 text-[13px] font-semibold text-gold">التفاصيل في App Store Connect</a>
        </>
      )}
    </section>
  )
}

// ─── إعلاناتك ────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  live: 'bg-gold text-gold-on',
  queued: 'bg-sunken text-ink-2',
  waiting: 'bg-sunken text-ink-2',
  ended: 'bg-warn/10 text-warn',
  off: 'bg-sunken text-ink-3',
}

function AdRow({ ad, status, busy, onToggle, onEdit, onDelete }) {
  return (
    <motion.li layout="position" transition={SETTLE} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-card border border-hair bg-surface p-3">
      <div className="h-[114px] w-[64px] overflow-hidden rounded-thumb bg-black"><AdMedia ad={ad} /></div>
      <div className="grid min-w-0 content-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold">{ad.title}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status.state]}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-2">
            {PLACEMENTS.filter((p) => ad[`show_on_${p.key}`]).map((p) => p.short).join(' · ') || 'لا لحظة'}
            {' · '}عدّ {ad.countdown_secs} ث
            {(ad.start_date || ad.end_date) && ` · ${ad.start_date ? dateLabel(ad.start_date) : 'من الآن'} ← ${ad.end_date ? dateLabel(ad.end_date) : 'بلا نهاية'}`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} onClick={onToggle}
            className={`min-h-9 rounded-[10px] border px-2 text-[12px] font-semibold disabled:opacity-50 ${ad.is_active ? 'border-hair text-ink' : 'border-gold/45 text-gold hover:bg-gold/10'}`}>
            {ad.is_active ? 'أوقفه' : 'شغّله'}
          </button>
          <button type="button" onClick={onEdit} className="min-h-9 rounded-[10px] border border-hair px-2 text-[12px] font-semibold hover:border-gold hover:text-gold">عدّله</button>
          <HoldButton compact label="احذفه" onConfirm={onDelete} />
        </div>
      </div>
    </motion.li>
  )
}

function AdEditor({ initial, onSave, onCancel, showToast }) {
  const [f, setF] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const flip = (k) => () => setF((x) => ({ ...x, [k]: !x[k] }))
  const error = adError(f)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAdMedia(file)
      const video = file.type.startsWith('video/')
      setF((x) => ({ ...x, image_url: video ? '' : url, video_url: video ? url : '' }))
    } catch (err) {
      showToast(`تعذّر الرفع: ${err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(adPayload(f))
    } finally {
      setSaving(false)
    }
  }

  const media = f.video_url || f.image_url
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }} transition={POP}
      className="grid items-start gap-8 rounded-card border border-gold/35 bg-surface p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      aria-label={initial.id ? 'تعديل إعلان' : 'إعلان جديد'}
    >
      <div className="grid gap-5">
        <h3 className="text-[17px] font-bold">{initial.id ? 'تعديل الإعلان' : 'إعلان جديد'}</h3>
        <label className="block">
          <span className="field-label">اسم الإعلان (لك فقط، لا يظهر في التطبيق)</span>
          <input className="field font-semibold" value={f.title} onChange={set('title')} placeholder="مثلاً: عرض متجر العيد" />
        </label>
        <div>
          <span className="field-label">الصورة أو الفيديو (عمودي يملأ الشاشة)</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={pick} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="min-h-11 rounded-full border border-hair px-4 text-[13px] font-semibold hover:border-gold hover:text-gold disabled:opacity-50">
              {uploading ? 'يُرفع…' : media ? 'بدّلها' : 'ارفع من جهازك'}
            </button>
            <input className="field min-h-11 flex-1 basis-[240px] text-[13px]" dir="ltr" placeholder="أو الصق رابطاً https://…"
              value={f.video_url || f.image_url}
              onChange={(e) => { const v = e.target.value; const video = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(v); setF((x) => ({ ...x, image_url: video ? '' : v, video_url: video ? v : '' })) }} />
          </div>
        </div>
        <label className="block">
          <span className="field-label">{Number(f.countdown_secs) ? `زر الإغلاق يظهر بعد ${countAr(Number(f.countdown_secs), 'second')}` : 'زر الإغلاق يظهر فوراً'}</span>
          <input type="range" min={0} max={30} value={f.countdown_secs} onChange={set('countdown_secs')} className="w-full max-w-[360px] accent-[rgb(var(--c-gold))]" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <span className="field-label !mb-0">الزر الذهبي (تواصل)</span>
            <input className="field" value={f.contact_label} onChange={set('contact_label')} placeholder="تواصل معنا" />
            <input className="field text-[13px]" dir="ltr" value={f.contact_button_url} onChange={set('contact_button_url')} placeholder="https://wa.me/…" />
          </div>
          <div className="grid gap-2">
            <span className="field-label !mb-0">الزر الثاني (مشاهدة)</span>
            <input className="field" value={f.view_label} onChange={set('view_label')} placeholder="مشاهدة" />
            <input className="field text-[13px]" dir="ltr" value={f.watch_button_url} onChange={set('watch_button_url')} placeholder="https://…" />
          </div>
        </div>
        <p className="-mt-2 text-[12px] text-ink-2">الزر بلا رابط لا يظهر للمستخدم.</p>
        <div>
          <span className="field-label">يظهر عند</span>
          <div className="flex flex-wrap gap-2">
            {PLACEMENTS.map((p) => (
              <button key={p.key} type="button" aria-pressed={f[`show_on_${p.key}`]} onClick={flip(`show_on_${p.key}`)}
                className={`min-h-10 rounded-full border px-4 text-[13px] font-semibold ${f[`show_on_${p.key}`] ? 'border-gold bg-gold/10 text-gold' : 'border-hair text-ink-2'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid max-w-[460px] gap-4 sm:grid-cols-2">
          <label className="block"><span className="field-label">يبدأ (اختياري)</span><input type="date" className="field" value={f.start_date ?? ''} onChange={set('start_date')} /></label>
          <label className="block"><span className="field-label">ينتهي (اختياري)</span><input type="date" className="field" value={f.end_date ?? ''} onChange={set('end_date')} /></label>
        </div>
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" checked={f.is_active} onChange={flip('is_active')} className="h-5 w-5 accent-[rgb(var(--c-gold))]" />
          شغّله بعد الحفظ
        </label>
        {error && <p className="text-[13px] text-warn">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={Boolean(error) || saving || uploading} onClick={save}
            className="min-h-[52px] min-w-[180px] rounded-field bg-gold px-6 text-[15px] font-semibold text-gold-on disabled:opacity-40">
            {saving ? 'يُحفظ…' : 'احفظ الإعلان'}
          </button>
          <button type="button" onClick={onCancel} className="min-h-[52px] rounded-field px-5 text-[15px] text-ink-2 hover:text-ink">إلغاء</button>
        </div>
      </div>
      <div className="grid justify-items-center gap-2">
        <PhoneFrame screenClassName="bg-black"><AdScreen ad={f} /></PhoneFrame>
        <p className="text-[12px] text-ink-2">كما يراه المستخدم في التطبيق</p>
      </div>
    </motion.section>
  )
}

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const [toast, showToast] = useToast()
  const [settings, setSettings] = useState(null)
  const [ads, setAds] = useState(null)
  const [liveId, setLiveId] = useState(null)
  const [subs, setSubs] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const today = ymd(new Date())

  const reloadAds = () => Promise.all([fetchCustomAds(), fetchLiveAdId()]).then(([a, id]) => { setAds(a); setLiveId(id) })

  useEffect(() => {
    fetchAdsSettings().then((s) => setSettings(s ?? {}), (e) => showToast(`تعذّر قراءة الإعدادات: ${e.message}`, 'error'))
    reloadAds().catch((e) => showToast(`تعذّر قراءة الإعلانات: ${e.message}`, 'error'))
    fetchSubscribers().then(setSubs, () => setSubs([]))
  }, [showToast])

  const liveAd = useMemo(() => ads?.find((a) => a.id === liveId) ?? null, [ads, liveId])

  async function changeMoment(key, mode) {
    const before = settings
    const patch = placementPatch(settings, key, mode)
    setSettings((s) => ({ ...s, ...patch }))
    try {
      setSettings(await saveAdsSettings(patch))
    } catch (e) {
      setSettings(before)
      showToast(`لم يُحفظ: ${e.message}`, 'error')
    }
  }

  async function saveAd(payload) {
    const id = editing.id
    // الإعلان الذي يُشغَّل الآن يتقدّم غيره، فيصير هو ما يراه الناس
    const turnedOn = payload.is_active && !(id && ads.find((a) => a.id === id)?.is_active)
    try {
      await saveCustomAd(turnedOn ? { ...payload, priority: nextPriority(ads) } : payload, id)
      setEditing(null)
      await reloadAds()
      showToast(id ? 'حُفظ التعديل' : 'أُضيف الإعلان')
    } catch (e) {
      showToast(`تعذّر الحفظ: ${e.message}`, 'error')
    }
  }

  async function toggle(ad) {
    setBusyId(ad.id)
    try {
      await saveCustomAd(ad.is_active ? { is_active: false } : { is_active: true, priority: nextPriority(ads) }, ad.id)
      await reloadAds()
    } catch (e) {
      showToast(`تعذّر التغيير: ${e.message}`, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(ad) {
    try {
      await deleteCustomAd(ad)
      await reloadAds()
    } catch (e) {
      showToast(`تعذّر الحذف: ${e.message}`, 'error')
    }
  }

  const toForm = (ad) => ({ ...EMPTY_AD, ...Object.fromEntries(Object.entries(ad).map(([k, v]) => [k, v ?? ''])) })

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8">
        <h1 className="text-[30px] font-extrabold leading-tight">الدخل</h1>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {settings ? <Moments settings={settings} liveAd={liveAd} onChange={changeMoment} /> : <div className="h-[520px] animate-pulse rounded-card bg-hair" />}
          <Premium rows={subs} />
        </div>

        <section className="grid gap-4" aria-label="إعلاناتك">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-bold">إعلاناتك</h2>
              <p className="text-[13px] text-ink-2">يظهر إعلان واحد في كل وقت: آخر ما شغّلته ضمن مدته.</p>
            </div>
            {!editing && (
              <button type="button" onClick={() => setEditing({ ...EMPTY_AD })} className="min-h-11 rounded-full bg-gold px-5 text-[14px] font-semibold text-gold-on">
                إعلان جديد
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {editing && <AdEditor key={editing.id ?? 'new'} initial={toForm(editing)} onSave={saveAd} onCancel={() => setEditing(null)} showToast={showToast} />}
          </AnimatePresence>
          {!ads ? (
            <div className="h-36 animate-pulse rounded-card bg-hair" />
          ) : ads.length === 0 ? (
            !editing && <p className="rounded-card border border-dashed border-hair p-6 text-center text-[14px] text-ink-2">لا إعلانات لك بعد. أضف إعلاناً لمتجرك أو لشريك واعرضه بدل جوجل في اللحظة التي تختارها.</p>
          ) : (
            <LayoutGroup>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {ads.map((ad) => (
                    <AdRow key={ad.id} ad={ad} status={adStatus(ad, liveId, today)} busy={busyId === ad.id}
                      onToggle={() => toggle(ad)} onEdit={() => setEditing(ad)} onDelete={() => remove(ad)} />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
        </section>
      </div>
      <Toast toast={toast} />
    </MotionConfig>
  )
}
