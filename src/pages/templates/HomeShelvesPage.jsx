import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import Segmented from '../../components/Segmented'
import { fetchHomeShelf, fetchHomeShelfCatalog, saveHomeShelf } from '../../lib/supabase'
import { OCCASIONS, OCCASION_LABEL } from '../../lib/occasions'
import { REASON_LABEL, SHELVES, SHELF_LIMIT, addPick, move, removePick, restOf, setMode, toggleHide, togglePin } from '../../lib/homeShelves'

// «الرئيسية»: تعدّل الرف نفسه لا جدولاً عنه (G1: docs/design/home-shelves-G1.html). القائمة العليا هي
// ما يظهر في التطبيق بترتيبه وسببه، والهاتف بجانبها يعكس الرفّين. كل فعل يُحفظ فوراً ومعه تراجع.
// اللقطة البطلة: البطاقة تطير بين «في الرف» و«خارج الرف» (layoutId واحد) والبقية تفسح لها.

const SETTLE = { type: 'spring', stiffness: 246.7, damping: 26.7, mass: 1 }
const PAGE = 40

const chipTone = {
  pin: 'bg-gold/15 text-gold',
  manual: 'bg-gold/15 text-gold',
  today: 'bg-ok/15 text-ok',
  week: 'bg-sunken text-ink-2',
  newest: 'bg-sunken text-ink-2',
  hide: 'bg-warn/10 text-warn',
}

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  return days <= 0 ? 'نُشر اليوم' : days === 1 ? 'نُشر أمس' : `نُشر قبل ${days} يوماً`
}

function Btn({ on, children, ...rest }) {
  return (
    <button type="button" {...rest}
      className={`min-h-9 min-w-11 rounded-full px-3 text-[13px] font-semibold disabled:opacity-40 ${on ? 'bg-gold text-gold-on' : 'bg-sunken text-ink hover:bg-gold/15 hover:text-gold'}`}>
      {children}
    </button>
  )
}

function Row({ t, rank, chip, shelf, children }) {
  const reduce = useReducedMotion()
  return (
    <motion.li layout={!reduce} layoutId={reduce ? undefined : `shelf-${t.template_id}`} transition={SETTLE}
      className={`grid grid-cols-[22px_52px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-hair bg-surface p-2 ${chip === 'hide' ? 'opacity-60' : ''}`}>
      <span className="num text-center text-[13px] text-ink-3">{rank ?? ''}</span>
      {t.thumb ? <img src={t.thumb} alt="" loading="lazy" className="h-[52px] w-[52px] rounded-[10px] object-cover" />
        : <span className="h-[52px] w-[52px] rounded-[10px] bg-sunken" />}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate font-semibold">{t.name || `قالب ${OCCASION_LABEL[t.occasion] ?? t.occasion}`}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
          {chip && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chipTone[chip]}`}>{chip === 'hide' ? 'مخفي' : REASON_LABEL[chip]}</span>}
          <span>{OCCASION_LABEL[t.occasion] ?? t.occasion}</span>
          <span aria-hidden>·</span>
          {shelf === 'trending'
            ? <span className="num">اليوم {t.day_score} · الأسبوع {t.week_score}</span>
            : <span>{ago(t.published_at)}</span>}
        </span>
      </span>
      <span className="flex gap-1.5">{children}</span>
    </motion.li>
  )
}

function Phone({ data, byId }) {
  const rail = (k) => (data[k]?.preview ?? []).map((p) => byId.get(p.template_id) ?? p)
  return (
    <div aria-label="الرئيسية في التطبيق" className="sticky top-6 mx-auto w-full max-w-[340px] overflow-hidden rounded-[44px] border-[8px] border-[#1d1b18] bg-[#0E0D0B] pb-6 pt-5 text-[#F3EDE2] shadow-card">
      <div className="px-5 pb-3 font-[Aref_Ruqaa,serif] text-[26px] text-[#D4A548]">نصّ</div>
      <div className="mx-4 mb-4 flex h-[38px] items-center rounded-xl bg-white/[.08] px-3 text-[13px] text-[#9C9385]">ابحث عن مناسبة</div>
      {SHELVES.map((s) => (
        <section key={s.key} className="mb-4 grid gap-2.5">
          <h3 className="flex items-center gap-2.5 px-4 text-[16px] font-bold after:h-px after:flex-1 after:bg-white/[.12]">{s.label}</h3>
          <div className="flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
            {rail(s.key).length === 0 && <p className="text-[12px] text-[#9C9385]">الرف فارغ فلا يظهر في التطبيق</p>}
            {rail(s.key).map((t) => (
              <motion.div key={t.template_id} layout transition={SETTLE} className="relative aspect-[4/5] w-[104px] shrink-0 overflow-hidden rounded-[14px] bg-[#222]">
                {t.thumb && <img src={t.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </motion.div>
            ))}
          </div>
        </section>
      ))}
      <h3 className="flex items-center gap-2.5 px-4 text-[16px] font-bold after:h-px after:flex-1 after:bg-white/[.12]">مناسبات</h3>
      <p className="px-4 pt-2 text-[12px] text-[#9C9385]">بلا تغيير: قالب من كل مناسبة بالتناوب، بترتيبك الحالي</p>
    </div>
  )
}

export default function HomeShelvesPage() {
  const [shelf, setShelf] = useState('trending')
  const [catalog, setCatalog] = useState(null)
  const [data, setData] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [undo, setUndo] = useState(null)
  const [occ, setOcc] = useState('')
  const [shown, setShown] = useState(PAGE)

  const load = useCallback(async (k) => {
    const d = await fetchHomeShelf(k)
    setData((prev) => ({ ...prev, [k]: d }))
  }, [])

  useEffect(() => {
    Promise.all([fetchHomeShelfCatalog().then(setCatalog), ...SHELVES.map((s) => load(s.key))]).catch((e) => setError(e.message))
  }, [load])

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(t)
  }, [undo])

  const byId = useMemo(() => new Map((catalog ?? []).map((c) => [c.template_id, c])), [catalog])
  const cur = data[shelf]
  const state = cur?.state
  const preview = useMemo(() => (cur?.preview ?? []).map((p) => ({ ...byId.get(p.template_id), ...p })), [cur, byId])
  const manual = state?.mode === 'manual'
  const has = (kind, id) => state?.items.some((i) => i.kind === kind && i.template_id === id)

  const rest = useMemo(() => {
    if (!catalog || !state) return []
    const list = restOf(catalog, preview).filter((c) => !occ || c.occasion === occ)
    // المخفي أولاً في التلقائي: هو ما تبحث عنه لتعيده
    return manual ? list : [...list.filter((c) => has('hide', c.template_id)), ...list.filter((c) => !has('hide', c.template_id))]
  }, [catalog, preview, occ, manual, state]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (next, message, k = shelf) => {
    const prev = data[k].state
    setBusy(true)
    setData((d) => ({ ...d, [k]: { ...d[k], state: next } }))
    try {
      await saveHomeShelf(k, next)
      await load(k)
      setUndo({ shelf: k, state: prev, message })
      setError(null)
    } catch (e) {
      setData((d) => ({ ...d, [k]: { ...d[k], state: prev } }))
      setError(`لم يُحفظ التغيير: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const doUndo = async () => {
    const u = undo
    setUndo(null)
    setBusy(true)
    try {
      await saveHomeShelf(u.shelf, u.state)
      await load(u.shelf)
    } catch (e) {
      setError(`لم يتم التراجع: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const meta = SHELVES.find((s) => s.key === shelf)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="grid min-w-0 gap-4 rounded-card bg-bg p-4 shadow-card md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented id="shelf" label="الرف" value={shelf} onChange={(k) => { setShelf(k); setShown(PAGE) }}
            options={SHELVES.map((s) => ({ key: s.key, label: s.label }))} />
          {state && (
            <Segmented id={`mode-${shelf}`} label="وضع الرف" value={state.mode}
              onChange={(m) => m !== state.mode && apply(setMode(state, m, preview.map((p) => p.template_id)), m === 'manual' ? 'صار يدوي، وبدأ من الرف الحالي' : 'رجع تلقائي')}
              options={[{ key: 'auto', label: 'تلقائي', disabled: busy }, { key: 'manual', label: 'يدوي', disabled: busy }]} />
          )}
        </div>
        <p className="max-w-[62ch] text-[13px] text-ink-2">{manual ? 'يدوي: يظهر ما تختاره فقط، بترتيبك.' : `تلقائي: ${meta.rule}`}</p>

        {error && <p role="alert" className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">{error}</p>}
        {!state || !catalog ? (
          <ul className="grid gap-2" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <li key={i} className="h-[70px] animate-pulse rounded-[14px] bg-sunken" />)}</ul>
        ) : (
          <LayoutGroup id={shelf}>
            <div className="grid gap-2">
              <h2 className="flex items-baseline gap-2 text-[15px] font-bold">في الرف الآن <span className="num text-[13px] font-normal text-ink-2">{preview.length} من {SHELF_LIMIT}</span></h2>
              <ul className="grid gap-2">
                {preview.length === 0 && <li className="rounded-[14px] border border-dashed border-hair p-4 text-[13px] text-ink-2">الرف فارغ، فلا يظهر في التطبيق. أضف قوالب من القائمة تحت.</li>}
                {preview.map((t, i) => (
                  <Row key={t.template_id} t={t} rank={i + 1} chip={t.reason} shelf={shelf}>
                    {manual ? (
                      <>
                        <Btn aria-label="تقديم" disabled={busy || i === 0} onClick={() => apply(move(state, 'pick', t.template_id, -1), 'تقدّم')}>↑</Btn>
                        <Btn disabled={busy} onClick={() => apply(removePick(state, t.template_id), 'أُزيل من الرف')}>إزالة</Btn>
                      </>
                    ) : t.reason === 'pin' ? (
                      <>
                        <Btn aria-label="تقديم" disabled={busy || i === 0} onClick={() => apply(move(state, 'pin', t.template_id, -1), 'تقدّم')}>↑</Btn>
                        <Btn on disabled={busy} onClick={() => apply(togglePin(state, t.template_id), 'أُلغي التثبيت')}>مثبّت</Btn>
                      </>
                    ) : (
                      <>
                        <Btn disabled={busy} onClick={() => apply(togglePin(state, t.template_id), 'ثُبّت في أول الرف')}>تثبيت</Btn>
                        <Btn disabled={busy} onClick={() => apply(toggleHide(state, t.template_id), 'أُخفي من الرف')}>إخفاء</Btn>
                      </>
                    )}
                  </Row>
                ))}
              </ul>
            </div>

            <div className="grid gap-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-baseline gap-2 text-[15px] font-bold">
                  {manual ? 'المكتبة' : 'خارج الرف'}
                  <span className="text-[13px] font-normal text-ink-2">{manual ? 'أضف ما تريد' : 'مخفي، أو خارج الحد، أو تجاوز سقف مناسبته'}</span>
                </h2>
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  المناسبة
                  <select id="shelf-occasion" value={occ} onChange={(e) => { setOcc(e.target.value); setShown(PAGE) }}
                    className="min-h-9 rounded-full border border-hair bg-surface px-3 text-[13px] text-ink">
                    <option value="">الكل</option>
                    {OCCASIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
              </div>
              <ul className="grid gap-2">
                {rest.slice(0, shown).map((t) => {
                  const hidden = !manual && has('hide', t.template_id)
                  return (
                    <Row key={t.template_id} t={t} chip={hidden ? 'hide' : null} shelf={shelf}>
                      {manual ? (
                        <Btn disabled={busy || preview.length >= SHELF_LIMIT} onClick={() => apply(addPick(state, t.template_id), 'أُضيف للرف')}>إضافة</Btn>
                      ) : (
                        <>
                          <Btn disabled={busy} onClick={() => apply(togglePin(state, t.template_id), 'ثُبّت في أول الرف')}>تثبيت</Btn>
                          {hidden && <Btn disabled={busy} onClick={() => apply(toggleHide(state, t.template_id), 'رجع للرف')}>إظهار</Btn>}
                        </>
                      )}
                    </Row>
                  )
                })}
              </ul>
              {rest.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-11 rounded-full text-[14px] font-semibold text-gold hover:bg-gold/10">
                  عرض المزيد ({rest.length - shown})
                </button>
              )}
            </div>
          </LayoutGroup>
        )}
      </section>

      <Phone data={data} byId={byId} />

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6" aria-live="polite">
        <AnimatePresence>
          {undo && (
            <motion.div key={undo.message + undo.shelf} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 385, damping: 30 }}
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-1.5 pe-1.5 ps-5 text-[14px] text-bg shadow-card">
              {undo.message}
              <button type="button" onClick={doUndo} disabled={busy} className="min-h-9 rounded-full bg-gold px-4 font-bold text-gold-on">تراجع</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
