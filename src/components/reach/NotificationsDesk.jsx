import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import NotificationCard, { SLIDE } from './NotificationCard'
import { LockScreen } from './PhoneFrame'
import HoldButton from '../HoldButton'
import Segmented from '../Segmented'
import { audienceOptions, countryLabel, failReason, nextBestTime, notificationView, timeLabel, whenLabel } from '../../lib/reach'
import { countAr } from '../../lib/today'

// اللقطة البطلة في «التواصل»: ما تكتبه يظهر على شاشة قفل كما سيراه الناس، والضغط المطوّل يرسله
// فتنزل البطاقة نفسها من الشاشة إلى رأس السجل، وتحتها تُروى حالته: يُرسل… ثم وصل إلى كذا جهازاً.
// (مواد: التحوّل بدل الاستبدال · الحالة تُروى حركياً · الجسدية للأفعال الحساسة)

const POP = { type: 'spring', stiffness: 385, damping: 27.5, mass: 1 }
const EMPTY = { title: '', body: '', audience: 'all', when: 'now', at: '' }
const CARD_W = 'w-[258px]'

const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function Dot({ tone }) {
  const color = { gold: 'bg-gold', ok: 'bg-ok', warn: 'bg-warn', ink: 'bg-ink-3' }[tone]
  return (
    <span className="relative mt-[7px] grid h-2 w-2 shrink-0 place-items-center">
      {tone === 'gold' && <motion.span className="absolute h-2 w-2 rounded-full bg-gold" animate={{ scale: [1, 2.4], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: [0.25, 0.1, 0.25, 1] }} />}
      <span className={`h-2 w-2 rounded-full ${color}`} />
    </span>
  )
}

function HistoryItem({ n, view, morphId, fresh, onSend, onDelete, now }) {
  const shown = new Date(n.sent_at ?? n.scheduled_at ?? n.created_at)
  const audience = n.target_type === 'country' ? countryLabel(n.target_country) : 'الكل'
  return (
    <motion.li
      layout="position"
      transition={SLIDE}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      className="grid gap-2"
    >
      <NotificationCard layoutId={morphId} title={n.title} body={n.body} time={timeLabel(shown)} className={CARD_W} />
      {/* الحالة تُكتب بعد هبوط البطاقة، لا قبلها فوق سطر ما تحتها */}
      <motion.div
        className="grid gap-1 px-1"
        initial={fresh ? { opacity: 0, y: -6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...POP, delay: 0.24 }}
      >
        <div className="flex items-start gap-2">
          <Dot tone={view.tone} />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={view.label}
              className={`text-[14px] font-semibold ${view.tone === 'warn' ? 'text-warn' : view.tone === 'ok' ? 'text-ink' : 'text-ink'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.11 } }}
              transition={POP}
            >
              {view.label}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="ps-4 text-[12.5px] text-ink-2">
          {audience} · {whenLabel(shown, now)}
        </p>
        {view.detail && <p className="ps-4 text-[12.5px] text-ink-2">{view.detail}</p>}
        {view.actions.length > 0 && (
          <div className="mt-1 grid grid-cols-2 gap-2 ps-4">
            {view.actions.includes('send') && (
              <HoldButton compact tone="gold" label="أرسله الآن" hint="اضغط مطوّلاً للإرسال" working="يُرسل…" onConfirm={() => onSend(n.id)} />
            )}
            {view.actions.includes('delete') && (
              <HoldButton compact label={view.state === 'scheduled' ? 'ألغِه' : 'احذفه'} hint={view.state === 'scheduled' ? 'اضغط مطوّلاً للإلغاء' : 'اضغط مطوّلاً للحذف'} onConfirm={() => onDelete(n.id)} />
            )}
          </div>
        )}
      </motion.div>
    </motion.li>
  )
}

/**
 * مكتب الإشعارات — واجهة خالصة؛ الجلب والحفظ يأتيان من الصفحة (أو من المختبر).
 * onCreate(payload) ← الصف المحفوظ · onSend(id) · onDelete(id)
 */
export default function NotificationsDesk({
  counts, schedulerReady, bestHour, suggestion, notifications, onCreate, onSend, onDelete, initialWhen = 'now', now: nowProp,
}) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY, when: initialWhen }))
  const [draftKey, setDraftKey] = useState(0)
  const [errors, setErrors] = useState({})
  // الاقتراح يُعرض مرة: يختفي عند أول كتابة أو إرسال ولا يعود فيدفع المكتب كله للأسفل
  const [suggestOpen, setSuggestOpen] = useState(true)
  const morphs = useRef(new Map())
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    if (nowProp) return
    const t = setInterval(() => setClock(new Date()), 20e3)
    return () => clearInterval(t)
  }, [nowProp])
  const now = nowProp ?? clock

  const audience = useMemo(() => audienceOptions(counts ?? { all: 0 }), [counts])
  const target = audience.find((a) => a.key === draft.audience) ?? audience[0]
  const best = bestHour != null ? nextBestTime(bestHour, now) : null
  const canSchedule = schedulerReady === true
  const when = !canSchedule && draft.when !== 'now' ? 'now' : draft.when === 'best' && !best ? 'now' : draft.when
  const at = when === 'best' ? best : when === 'later' && draft.at ? new Date(draft.at) : null
  const laterInvalid = when === 'later' && (!at || at.getTime() < now.getTime() + 60e3)
  const ready = draft.title.trim() && draft.body.trim() && target.devices > 0 && !laterInvalid
  const set = (k) => (e) => { setSuggestOpen(false); setDraft((d) => ({ ...d, [k]: e.target.value })) }

  async function confirm() {
    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      target_type: target.key === 'all' ? 'all' : 'country',
      target_country: target.key === 'all' ? null : target.key,
      status: at ? 'scheduled' : 'pending',
      scheduled_at: at ? at.toISOString() : null,
    }
    const created = await onCreate(payload)
    // البطاقة في الشاشة تحمل هوية مكانية تنتقل مع الصف الجديد إلى السجل
    morphs.current.set(created.id, `push-draft-${draftKey}`)
    setDraft((d) => ({ ...EMPTY, audience: d.audience, when: d.when === 'later' ? 'now' : d.when }))
    setDraftKey((k) => k + 1)
    if (!at) {
      onSend(created.id).catch((e) => setErrors((x) => ({ ...x, [created.id]: e.message })))
    }
  }

  const send = (id) => onSend(id).then(
    () => setErrors(({ [id]: _, ...x }) => x),
    (e) => setErrors((x) => ({ ...x, [id]: e.message })),
  )

  const viewOf = (n) => (errors[n.id] && n.status !== 'sent'
    ? { state: 'failed', label: 'لم يُرسل', detail: failReason(errors[n.id]), tone: 'warn', actions: ['send', 'delete'] }
    : notificationView(n, now))

  const whenOptions = [
    { key: 'now', label: 'الآن' },
    { key: 'best', label: best ? `أفضل وقت · ${whenLabel(best, now)}` : 'أفضل وقت', disabled: !canSchedule || !best },
    { key: 'later', label: 'وقت آخر', disabled: !canSchedule },
  ]

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-12">
          {/* ── المكتب: النص والجمهور والموعد ── */}
          <section className="grid gap-6 lg:pt-2" aria-label="إشعار جديد">
            {suggestion && suggestOpen && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/30 bg-gold/[0.07] px-4 py-3">
                <p className="text-[14px]">
                  <span className="font-semibold">{suggestion.season} {suggestion.when}.</span>{' '}
                  <span className="text-ink-2">نص جاهز للتذكير: «{suggestion.title}»</span>
                </p>
                <button type="button" onClick={() => { setSuggestOpen(false); setDraft((d) => ({ ...d, title: suggestion.title, body: suggestion.body })) }} className="min-h-10 rounded-full border border-gold/50 px-4 text-[13px] font-semibold text-gold hover:bg-gold/10">
                  استعمله
                </button>
              </div>
            )}

            <div className="grid gap-4">
              <label className="block">
                <span className="field-label">العنوان</span>
                <input className="field font-semibold" value={draft.title} onChange={set('title')} maxLength={100} placeholder="مثلاً: تهاني العيد وصلت" />
              </label>
              <label className="block">
                <span className="field-label">النص</span>
                <textarea className="field min-h-[112px] resize-y" value={draft.body} onChange={set('body')} maxLength={300} placeholder="جملة أو جملتان. ما يزيد عن أربعة أسطر يُقص على الشاشة." />
              </label>
            </div>

            <div>
              <span className="field-label">لمن</span>
              {audience[0].devices === 0 ? (
                <p className="text-[14px] text-ink-2">لا أجهزة مسجّلة للإشعارات بعد.</p>
              ) : (
                <Segmented id="audience" label="الجمهور" value={target.key} onChange={(k) => setDraft((d) => ({ ...d, audience: k }))}
                  options={audience.map((a) => ({ key: a.key, label: `${a.label} · ${a.devices.toLocaleString('en-US')}` }))} />
              )}
            </div>

            <div>
              <span className="field-label">متى</span>
              <Segmented id="when" label="موعد الإرسال" value={when} onChange={(k) => setDraft((d) => ({ ...d, when: k, at: k === 'later' && !d.at ? toLocalInput(new Date(now.getTime() + 3600e3)) : d.at }))} options={whenOptions} />
              {when === 'later' && (
                <input type="datetime-local" className="field mt-3 max-w-[320px]" value={draft.at} min={toLocalInput(now)} onChange={set('at')} dir="ltr" />
              )}
              {schedulerReady === false && <p className="mt-2 text-[12.5px] text-ink-2">الجدولة تحتاج تفعيلاً لمرة واحدة في الخادم. حتى ذلك الحين يُرسل الإشعار فوراً فقط.</p>}
              {schedulerReady == null && <p className="mt-2 text-[12.5px] text-ink-2">الجدولة تحتاج تحديثاً لقاعدة البيانات. حتى ذلك الحين يُرسل الإشعار فوراً فقط.</p>}
              {when === 'best' && <p className="mt-2 text-[12.5px] text-ink-2">أكثر ساعتين يفتح فيهما الناس التطبيق في آخر 30 يوماً.</p>}
            </div>

            <HoldButton
              key={draftKey}
              tone="gold"
              disabled={!ready}
              label={at ? `جدوِله · ${whenLabel(at, now)}` : `أرسل الآن إلى ${countAr(target.devices, 'device')}`}
              hint={at ? 'اضغط مطوّلاً للجدولة' : 'اضغط مطوّلاً للإرسال'}
              working={at ? 'يُجدوَل…' : 'يُرسل…'}
              onConfirm={confirm}
              className="max-w-[420px]"
            />
          </section>

          {/* ── الشاشة ثم السجل تحتها: البطاقة تنزل من الأولى إلى الثاني ── */}
          <div className="grid justify-items-center gap-8">
            <LockScreen now={now}>
              <AnimatePresence initial={false}>
                <NotificationCard
                  key={draftKey}
                  layoutId={`push-draft-${draftKey}`}
                  title={draft.title}
                  body={draft.body}
                  placeholder
                  initial={{ opacity: 0, y: 24, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  // الجديدة تصعد بعد أن تغادر المرسَلة، فيُقرأ الرحيل أولاً
                  transition={{ ...POP, delay: draftKey ? 0.2 : 0 }}
                />
              </AnimatePresence>
            </LockScreen>

            <section className="grid w-[300px] gap-4 px-[21px]" aria-label="سجل الإشعارات">
              <h2 className="text-[17px] font-bold">السجل</h2>
              {notifications.length === 0 ? (
                <p className="text-[13px] text-ink-2">لم تُرسل إشعارات بعد.</p>
              ) : (
                <ul className="grid gap-6">
                  <AnimatePresence initial={false}>
                    {notifications.map((n) => (
                      <HistoryItem key={n.id} n={n} view={viewOf(n)} morphId={morphs.current.get(n.id) ?? `push-${n.id}`} fresh={morphs.current.has(n.id)} onSend={send} onDelete={onDelete} now={now} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </div>
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}
