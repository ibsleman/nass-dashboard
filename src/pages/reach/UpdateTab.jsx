import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { PhoneFrame } from '../../components/reach/PhoneFrame'
import { SLIDE } from '../../components/reach/NotificationCard'
import HoldButton from '../../components/HoldButton'
import Segmented from '../../components/Segmented'
import Toast, { useToast } from '../../components/Toast'
import { createAppUpdate, deleteAppUpdate, fetchAppUpdates, fetchReachStats, toggleAppUpdate, uploadUpdateImage } from '../../lib/supabase'
import { isVersion, versionLess, versionReach } from '../../lib/reach'
import { countAr } from '../../lib/today'

// رسالة التحديث داخل التطبيق: تظهر عند فتحه لمن نسخته أقدم من رقمها، وواحدة فقط تظهر في كل وقت.
// المعاينة نسخة من شاشة التطبيق نفسها (AppUpdateView): الصورة أو الشعار، العنوان، الرسالة، «حدّث الآن»، و«لاحقاً» إن لم تكن إجبارية.

const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }
const EMPTY = { version: '', title: '', message: '', image_url: '', update_type: 'optional' }
const TYPES = [{ key: 'optional', label: 'اختيارية' }, { key: 'forced', label: 'إجبارية' }]
const dateLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })

function UpdateScreen({ form }) {
  const forced = form.update_type === 'forced'
  return (
    <PhoneFrame screenClassName="bg-bg">
      <div className="flex h-full flex-col px-5 pb-5 pt-14 text-center">
        <div className="grid flex-1 content-center justify-items-center gap-5">
          {form.image_url ? (
            <img src={form.image_url} alt="" className="max-h-[170px] max-w-[170px] rounded-tile object-contain shadow-card" />
          ) : (
            <span className="font-logo text-[44px] leading-none text-gold">نصّ</span>
          )}
          <div className="grid gap-2.5">
            <p className={`text-[21px] font-bold leading-snug ${form.title.trim() ? 'text-ink' : 'text-ink-3'}`}>{form.title.trim() || 'عنوان الرسالة'}</p>
            {form.message.trim() && <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{form.message.trim()}</p>}
            <p className="num text-[12px] text-ink-2">الإصدار {form.version.trim() || '—'}</p>
          </div>
        </div>
        <div className="grid gap-1">
          <span className="grid min-h-[48px] place-items-center rounded-field bg-gold text-[15px] font-semibold text-gold-on">حدّث الآن</span>
          <AnimatePresence initial={false}>
            {!forced && (
              <motion.span
                key="later"
                className="grid place-items-center overflow-hidden text-[14px] font-medium text-ink-2"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 44, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={POP}
              >
                لاحقاً
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PhoneFrame>
  )
}

function Row({ u, reach, busy, onToggle, onDelete }) {
  const r = reach(u.version)
  return (
    <motion.li layout="position" transition={SLIDE} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      className={`grid gap-3 rounded-card border p-4 ${u.is_active ? 'border-gold/40 bg-gold/[0.06]' : 'border-hair bg-surface'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            <span className="num rounded-full bg-sunken px-2 py-0.5 text-[12px] text-ink-2" dir="ltr">{u.version}</span>
            <span className="truncate">{u.title}</span>
          </p>
          <p className="mt-1 text-[12.5px] text-ink-2">
            {u.update_type === 'forced' ? 'إجبارية' : 'اختيارية'} · {dateLabel.format(new Date(u.created_at))}
          </p>
        </div>
        {u.is_active && <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-gold-on">تظهر الآن</span>}
      </div>
      {u.is_active && r && (
        <p className="text-[13px] text-ink-2">
          {r.below > 0 ? `يراها ${countAr(r.below, 'device')} من ${r.total.toLocaleString('en-US')} فتحت التطبيق في آخر 30 يوماً.` : 'لا أحد يراها: كل الأجهزة على هذا الإصدار أو أحدث.'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => onToggle(u)}
          className={`min-h-9 rounded-[10px] border px-3 text-[12px] font-semibold disabled:opacity-50 ${u.is_active ? 'border-hair text-ink' : 'border-gold/45 text-gold hover:bg-gold/10'}`}>
          {u.is_active ? 'أوقف عرضها' : 'اعرضها'}
        </button>
        <HoldButton compact label="احذفها" onConfirm={() => onDelete(u)} />
      </div>
    </motion.li>
  )
}

export default function UpdateTab() {
  const [toast, showToast] = useToast()
  const [list, setList] = useState(null)
  const [versions, setVersions] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formKey, setFormKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchAppUpdates().then(setList, (e) => showToast(`تعذّر قراءة الرسائل: ${e.message}`, 'error'))
    fetchReachStats(30).then(({ versions: v }) => setVersions(v), () => setVersions(null))
  }, [showToast])

  const reach = (v) => (versions && isVersion(v) ? versionReach(versions, v) : null)
  const newest = useMemo(() => (versions ?? []).map((r) => r.app_version).filter(isVersion).sort((a, b) => (versionLess(a, b) ? 1 : -1))[0], [versions])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const versionOk = isVersion(form.version)
  const ready = versionOk && form.title.trim() && !uploading
  const r = versionOk ? reach(form.version) : null

  async function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadUpdateImage(file)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      showToast(`تعذّر رفع الصورة: ${err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function publish() {
    try {
      const created = await createAppUpdate({
        version: form.version.trim(), title: form.title.trim(), message: form.message.trim() || null,
        image_url: form.image_url || null, update_type: form.update_type, is_active: false,
      })
      const active = await toggleAppUpdate(created.id, true)
      setList((l) => [active, ...(l ?? []).map((u) => ({ ...u, is_active: false }))])
      setForm(EMPTY)
      setFormKey((k) => k + 1)
      showToast('رسالة التحديث تظهر الآن')
    } catch (e) {
      showToast(`تعذّر النشر: ${e.message}`, 'error')
    }
  }

  async function toggle(u) {
    setBusyId(u.id)
    try {
      const next = await toggleAppUpdate(u.id, !u.is_active)
      setList((l) => l.map((x) => (x.id === next.id ? next : next.is_active ? { ...x, is_active: false } : x)))
    } catch (e) {
      showToast(`تعذّر التغيير: ${e.message}`, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(u) {
    try {
      await deleteAppUpdate(u.id)
      setList((l) => l.filter((x) => x.id !== u.id))
    } catch (e) {
      showToast(`تعذّر الحذف: ${e.message}`, 'error')
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-12">
        <section className="grid gap-6 lg:pt-2" aria-label="رسالة تحديث جديدة">
          <p className="max-w-[560px] text-[14px] leading-relaxed text-ink-2">
            تظهر عند فتح التطبيق لمن نسخته أقدم من رقمها، وواحدة فقط في كل وقت. الإجبارية لا تُغلق حتى يحدّث.
          </p>
          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
            <label className="block">
              <span className="field-label">رقم الإصدار</span>
              <input className="field num" dir="ltr" value={form.version} onChange={set('version')} placeholder={newest ?? '2.1'} inputMode="decimal" />
            </label>
            <label className="block">
              <span className="field-label">العنوان</span>
              <input className="field font-semibold" value={form.title} onChange={set('title')} maxLength={80} placeholder="مثلاً: قوالب الفيديو وصلت" />
            </label>
          </div>
          {form.version && !versionOk && <p className="-mt-3 text-[12.5px] text-warn">رقم الإصدار أرقام ونقاط فقط، مثل 2.1</p>}
          <label className="block">
            <span className="field-label">الرسالة (اختيارية)</span>
            <textarea className="field min-h-[96px] resize-y" value={form.message} onChange={set('message')} maxLength={400} placeholder="ما الجديد في سطرين." />
          </label>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <span className="field-label">النوع</span>
              <Segmented id={`update-type-${formKey}`} label="نوع الرسالة" value={form.update_type} onChange={(k) => setForm((f) => ({ ...f, update_type: k }))} options={TYPES} />
            </div>
            <div>
              <span className="field-label">صورة (اختيارية)</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="min-h-10 rounded-full border border-hair px-4 text-[13px] font-semibold hover:border-gold hover:text-gold disabled:opacity-50">
                  {uploading ? 'تُرفع…' : form.image_url ? 'بدّل الصورة' : 'اختر صورة'}
                </button>
                {form.image_url && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: '' }))} className="min-h-10 rounded-full px-3 text-[13px] text-ink-2 hover:text-ink">أزلها</button>
                )}
              </div>
            </div>
          </div>
          {form.update_type === 'forced' && <p className="text-[13px] text-warn">الإجبارية تمنع استعمال التطبيق حتى يحدّثه المستخدم من المتجر.</p>}
          {r && (
            <p className="text-[13px] text-ink-2">
              {r.below > 0 ? `سيراها ${countAr(r.below, 'device')} من ${r.total.toLocaleString('en-US')} فتحت التطبيق في آخر 30 يوماً.` : 'لن يراها أحد: كل الأجهزة على هذا الإصدار أو أحدث.'}
            </p>
          )}
          <HoldButton key={formKey} tone="gold" disabled={!ready} className="max-w-[420px]"
            label={versionOk ? `اعرضها لمن نسخته أقدم من ${form.version.trim()}` : 'اعرضها للمستخدمين'}
            hint="اضغط مطوّلاً للعرض" working="تُنشر…" onConfirm={publish} />
        </section>

        <div className="grid justify-items-center gap-8">
          <UpdateScreen form={form} />
          <section className="grid w-full max-w-[420px] gap-3 lg:w-[300px]" aria-label="الرسائل السابقة">
            <h2 className="text-[17px] font-bold">الرسائل</h2>
            {!list ? (
              <div className="h-28 animate-pulse rounded-card bg-hair" />
            ) : list.length === 0 ? (
              <p className="text-[13px] text-ink-2">لا رسائل بعد.</p>
            ) : (
              <LayoutGroup>
                <ul className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {list.map((u) => <Row key={u.id} u={u} reach={reach} busy={busyId === u.id} onToggle={toggle} onDelete={remove} />)}
                  </AnimatePresence>
                </ul>
              </LayoutGroup>
            )}
          </section>
        </div>
      </div>
      <Toast toast={toast} />
    </MotionConfig>
  )
}
