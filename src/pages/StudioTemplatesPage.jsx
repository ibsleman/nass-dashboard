import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCdnUrl } from '../lib/cdn'
import {
  HOME_CATEGORIES, STATUS_LABELS,
  fetchStudioTemplates, updateStudioTemplate,
  cardThumbnail, thumbnailFor, latestVersion, liveVersion,
  validatePublish, publishPatch, groupByStatus,
} from '../lib/studioTemplates'

const CATEGORY_LABEL = Object.fromEntries(HOME_CATEGORIES.map((c) => [c.key, c.label]))
const SIZE_LABEL = { 1080: 'مربع', 1350: 'منشور', 1920: 'ستوري' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' })
}
function dateInput(iso) { return iso ? iso.slice(0, 10) : '' }

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    brand:  'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  }
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${tones[tone]}`}>{children}</span>
}

/** بطاقة قالب في القائمة */
function StudioCard({ template, onOpen }) {
  const latest = latestVersion(template)
  const thumb = getCdnUrl(cardThumbnail(template))
  const count = template.design_template_versions?.length ?? 0
  return (
    <button onClick={onOpen}
      className="group text-right bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all overflow-hidden">
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {thumb
          ? <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">بلا صورة</div>}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{template.name_ar}</p>
          {template.is_premium ? <Badge tone="amber">مدفوع</Badge> : <Badge>مجاني</Badge>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {CATEGORY_LABEL[template.category_id] ?? <span className="text-red-500">قسم غير معروف: {template.category_id || '—'}</span>}
          {' · '}{SIZE_LABEL[template.canvas_h] ?? `${template.canvas_w}×${template.canvas_h}`}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
          {count} {count === 1 ? 'نسخة' : 'نسخ'} · آخرها {fmtDate(latest?.created_at)}
          {template.status === 'published' && template.current_version ? ` · الحية v${template.current_version}` : ''}
        </p>
      </div>
    </button>
  )
}

/** نافذة المراجعة والنشر */
function ReviewModal({ template, onClose, onSaved, showToast }) {
  const versions = useMemo(
    () => [...(template.design_template_versions ?? [])].sort((a, b) => b.version - a.version),
    [template],
  )
  const live = liveVersion(template)
  const [selected, setSelected] = useState(live ?? versions[0] ?? null)
  const [form, setForm] = useState({
    name_ar: template.name_ar ?? '',
    category_id: template.category_id ?? '',
    occasion: template.occasion ?? '',
    is_premium: !!template.is_premium,
    sort_order: template.sort_order ?? 0,
    publish_from: dateInput(template.publish_from),
    publish_until: dateInput(template.publish_until),
  })
  const [busy, setBusy] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function act(status) {
    if (status === 'published') {
      const problem = validatePublish(form, selected)
      if (problem) { showToast(problem, 'error'); return }
    }
    setBusy(status)
    try {
      const patch = publishPatch(form, selected, status)
      const row = await updateStudioTemplate(template.id, patch)
      onSaved({ ...template, ...patch, ...row })
      showToast(status === 'published' ? `نُشرت النسخة v${selected.version}` : status === 'archived' ? 'أُرشف القالب' : 'أُرجع إلى مسودة')
      onClose()
    } catch (err) {
      showToast('تعذّر الحفظ: ' + err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const stress = selected?.stress_test_urls ?? []
  const preview = getCdnUrl(thumbnailFor(selected))
  const inputCls = 'w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400'
  const labelCls = 'block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-5xl h-[94dvh] sm:h-auto sm:max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800 overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white truncate">{template.name_ar}</h3>
            <p className="text-[11px] text-gray-400">
              <Badge tone={template.status === 'published' ? 'green' : template.status === 'archived' ? 'gray' : 'brand'}>{STATUS_LABELS[template.status]}</Badge>
              {live ? <span className="mr-2">الحية v{live.version}</span> : null}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="إغلاق">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0">
          {/* ── المراجعة ── */}
          <section className="p-5 space-y-4 border-b lg:border-b-0 lg:border-l border-gray-100 dark:border-gray-800">
            <div className="flex gap-4 items-start">
              <div className="w-40 sm:w-52 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square">
                {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={labelCls}>النسخ</p>
                <ul className="space-y-1">
                  {versions.length === 0 && <li className="text-xs text-gray-400">لا نسخ مرفوعة بعد</li>}
                  {versions.map((v) => {
                    const isSel = selected?.version === v.version
                    return (
                      <li key={v.version}>
                        <button onClick={() => setSelected(v)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${isSel ? 'bg-brand-500 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                          <span className="font-bold tabular-nums">v{v.version}</span>
                          <span className={`text-[11px] ${isSel ? 'text-white/80' : 'text-gray-400'}`}>{fmtDate(v.created_at)}</span>
                          {template.current_version === v.version && <Badge tone={isSel ? 'gray' : 'green'}>الحية</Badge>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <div>
              <p className={labelCls}>فحص الأسماء (من «علي» إلى أطولها)</p>
              {stress.length === 0
                ? <p className="text-xs text-gray-400">لا صور فحص لهذه النسخة</p>
                : <div className="grid grid-cols-3 gap-2">
                    {stress.map((u, i) => (
                      <a key={i} href={getCdnUrl(u)} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square">
                        <img src={getCdnUrl(u)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>}
            </div>
            <p className="text-[11px] text-gray-400">
              {SIZE_LABEL[template.canvas_h] ?? ''} {template.canvas_w}×{template.canvas_h} · أقل إصدار {template.min_app_build}
              {selected?.font_ids?.length ? ` · خطوط: ${selected.font_ids.length}` : ''}
              {selected?.element_ids?.length ? ` · عناصر: ${selected.element_ids.length}` : ''}
            </p>
          </section>

          {/* ── الضبط والنشر ── */}
          <section className="p-5 space-y-3">
            <div><label className={labelCls}>الاسم</label><input className={inputCls} value={form.name_ar} onChange={set('name_ar')} /></div>
            <div>
              <label className={labelCls}>القسم</label>
              <select className={inputCls} value={form.category_id} onChange={set('category_id')}>
                <option value="">اختر القسم…</option>
                {HOME_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>المناسبة الفرعية (اختياري)</label><input className={inputCls} value={form.occasion} onChange={set('occasion')} placeholder="مثل: eid-adha" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>الترتيب</label><input type="number" className={inputCls} value={form.sort_order} onChange={set('sort_order')} /></div>
              <label className="flex items-center gap-2 pt-5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.is_premium} onChange={set('is_premium')} className="w-4 h-4 accent-brand-500" />
                مدفوع
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>يظهر من</label><input type="date" className={inputCls} value={form.publish_from} onChange={set('publish_from')} /></div>
              <div><label className={labelCls}>حتى</label><input type="date" className={inputCls} value={form.publish_until} onChange={set('publish_until')} /></div>
            </div>

            <div className="pt-2 space-y-2">
              <button disabled={!!busy || !selected} onClick={() => act('published')}
                className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-brand-500/25 transition-colors">
                {busy === 'published' ? 'ينشر…' : selected ? `نشر النسخة v${selected.version}` : 'اختر نسخة'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!!busy || template.status === 'archived'} onClick={() => act('archived')}
                  className="py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">
                  {busy === 'archived' ? '…' : 'أرشفة'}
                </button>
                <button disabled={!!busy || template.status === 'draft'} onClick={() => act('draft')}
                  className="py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">
                  {busy === 'draft' ? '…' : 'إرجاع لمسودة'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">الرجوع لنسخة سابقة: اختر النسخة من القائمة ثم «نشر». الأرشفة تخفي القالب من التطبيق فوراً.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function StudioTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('draft')
  const [open, setOpen] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { setTemplates(await fetchStudioTemplates()) }
    catch (err) { showToast('تعذّر تحميل قوالب الاستوديو: ' + err.message, 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => groupByStatus(templates), [templates])
  const list = groups[tab] ?? []

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">قوالب الاستوديو</h1>
          <p className="text-xs text-gray-400">مسودات المصممين — راجع صور الأسماء ثم انشر، بلا فتح الاستوديو</p>
        </div>
        <button onClick={load} className="text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">تحديث</button>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            {label} <span className="tabular-nums text-[11px] opacity-70">{groups[key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">لا قوالب هنا</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {list.map((t) => <StudioCard key={t.id} template={t} onOpen={() => setOpen(t)} />)}
        </div>
      )}

      {open && (
        <ReviewModal template={open} onClose={() => setOpen(null)} showToast={showToast}
          onSaved={(updated) => setTemplates((all) => all.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))} />
      )}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold whitespace-nowrap ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
