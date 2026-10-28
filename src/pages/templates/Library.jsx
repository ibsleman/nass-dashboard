import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'
import TemplateCard from '../../components/TemplateCard'
import TemplateModal from '../../components/TemplateModal'
import BulkUploadModal from '../../components/BulkUploadModal'
import DeleteConfirm from '../../components/DeleteConfirm'
import Toast, { useToast } from '../../components/Toast'
import { extractStoragePath } from '../../lib/cdn'
import { OCCASIONS, OCCASION_LABEL } from '../../lib/occasions'
import {
  fetchTemplates,
  insertTemplate,
  updateTemplate,
  deleteTemplate,
  deleteFile,
  updateTemplatesVisibility,
  deleteTemplates,
} from '../../lib/supabase'

// قوالب مناسبة واحدة: الشبكة والرفع والإخفاء والحذف كما كانت (تُعاد بناؤها في المرحلة الثالثة)،
// والمناسبات صارت شريط صور حقيقية بدل قائمة الإيموجي الجانبية.

/** صورة تمثّل المناسبة: أحدث قالب فيها */
function coverOf(rows) {
  const t = rows.find((r) => r.image_url || r.thumbnail_url)
  return t ? (t.thumbnail_url || t.image_url) : null
}

function OccasionStrip({ overview, active, onPick }) {
  const byOccasion = useMemo(() => {
    const map = Object.fromEntries(OCCASIONS.map((o) => [o.key, []]))
    for (const t of overview ?? []) (map[t.category] ??= []).push(t)
    return map
  }, [overview])

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8 scrollbar-thin" role="tablist" aria-label="المناسبات">
      {OCCASIONS.map((o) => {
        const rows = byOccasion[o.key] ?? []
        const cover = coverOf(rows)
        const on = o.key === active
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(o.key)}
            className={`group relative h-[132px] w-[96px] flex-shrink-0 overflow-hidden rounded-thumb text-start ${on ? 'ring-2 ring-gold ring-offset-2 ring-offset-bg' : ''}`}
          >
            {cover ? (
              <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] group-hover:scale-105" />
            ) : (
              <span className="absolute inset-0 bg-sunken" />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <span className="absolute inset-x-2 bottom-2 grid gap-0.5 text-[#F7F2E8]">
              <span className="text-[13px] font-bold leading-tight">{o.label}</span>
              <span className={`num text-[11px] ${rows.length ? 'opacity-80' : 'text-[#F2B39C]'}`}>
                {overview ? (rows.length ? `${rows.length} قالباً` : 'لا قوالب') : '…'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function Library({ overview, onChanged }) {
  const { occasion } = useParams()
  const navigate = useNavigate()
  const activeCategory = OCCASION_LABEL[occasion] ? occasion : OCCASIONS[0].key
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [premiumFilter, setPremiumFilter] = useState('all')
  const [toast, showToast] = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)

  const loadTemplates = useCallback(async (category) => {
    setLoading(true)
    try {
      setTemplates(await fetchTemplates(category))
    } catch (err) {
      showToast('خطأ في تحميل القوالب: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadTemplates(activeCategory)
    setTypeFilter('all')
    setPremiumFilter('all')
    setSelectedIds(new Set())
  }, [activeCategory, loadTemplates])

  const filtered = templates.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (premiumFilter === 'free' && t.is_premium) return false
    if (premiumFilter === 'premium' && !t.is_premium) return false
    return true
  })

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  const handleSave = async (payload, id) => {
    if (id) {
      // كل تعديل يرفع updated_at كي تلتقطه الأجوال في مزامنتها التالية (المزامنة بالفرق عليه)
      const updated = await updateTemplate(id, { ...payload, updated_at: new Date().toISOString() })
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
      showToast('تم تعديل القالب')
    } else {
      const created = await insertTemplate(payload)
      setTemplates((prev) => [created, ...prev])
      showToast('تم نشر القالب')
    }
    onChanged?.()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await Promise.all([
        extractStoragePath(deleteTarget.image_url) ? deleteFile(extractStoragePath(deleteTarget.image_url)) : Promise.resolve(),
        extractStoragePath(deleteTarget.video_url) ? deleteFile(extractStoragePath(deleteTarget.video_url)) : Promise.resolve(),
      ])
      await deleteTemplate(deleteTarget.id)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      showToast('تم حذف القالب')
      onChanged?.()
    } catch (err) {
      showToast('خطأ في الحذف: ' + err.message, 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ─── التحديد الجماعي ────────────────────────────────────────────────────────
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id)))
  }

  const handleToggleVisibility = async (template) => {
    const wasVisible = template.is_visible !== false
    try {
      await updateTemplatesVisibility([template.id], !wasVisible)
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, is_visible: !wasVisible } : t)))
      // كانت الرسالة معكوسة: تقول «أُظهر» وهو قد أُخفي
      showToast(wasVisible ? 'تم إخفاء القالب' : 'تم إظهار القالب')
      onChanged?.()
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error')
    }
  }

  const handleBulkSetVisibility = async (isVisible) => {
    const ids = [...selectedIds]
    setBulkLoading(true)
    try {
      await updateTemplatesVisibility(ids, isVisible)
      setTemplates((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, is_visible: isVisible } : t)))
      setSelectedIds(new Set())
      showToast(isVisible ? `تم إظهار ${ids.length} قالب` : `تم إخفاء ${ids.length} قالب`)
      onChanged?.()
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const executeBulkDelete = async () => {
    const ids = [...selectedIds]
    setBulkLoading(true)
    try {
      const selectedTemplates = templates.filter((t) => ids.includes(t.id))
      await Promise.allSettled(
        selectedTemplates.flatMap((t) => [
          extractStoragePath(t.image_url) ? deleteFile(extractStoragePath(t.image_url)) : null,
          extractStoragePath(t.video_url) ? deleteFile(extractStoragePath(t.video_url)) : null,
        ].filter(Boolean)),
      )
      await deleteTemplates(ids)
      setTemplates((prev) => prev.filter((t) => !ids.includes(t.id)))
      setSelectedIds(new Set())
      showToast(`تم حذف ${ids.length} قالب`)
      onChanged?.()
    } catch (err) {
      showToast('خطأ في الحذف: ' + err.message, 'error')
    } finally {
      setBulkLoading(false)
      setBulkDeletePending(false)
    }
  }

  const label = OCCASION_LABEL[activeCategory]
  const allSelected = selectedIds.size === filtered.length && filtered.length > 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <OccasionStrip overview={overview} active={activeCategory} onPick={(k) => navigate(`../occasions/${k}`)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-extrabold">{label}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="min-h-11 rounded-xl border border-hair bg-surface px-4 text-[13px] font-semibold hover:border-gold"
          >
            رفع عدة قوالب
          </button>
          <button
            type="button"
            onClick={() => { setEditTemplate(null); setModalOpen(true) }}
            className="min-h-11 rounded-xl bg-gold px-4 text-[13px] font-semibold text-gold-on hover:brightness-105"
          >
            قالب جديد
          </button>
        </div>
      </div>

      <FilterBar
        typeFilter={typeFilter}
        premiumFilter={premiumFilter}
        onTypeChange={setTypeFilter}
        onPremiumChange={setPremiumFilter}
        total={filtered.length}
      />

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex min-h-11 items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            <span className={`grid h-4 w-4 place-items-center rounded border-2 ${allSelected ? 'border-gold bg-gold' : 'border-ink-3'}`}>
              {allSelected && <span className="h-1.5 w-1.5 rounded-sm bg-gold-on" />}
            </span>
            تحديد الكل
          </button>
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 p-2">
              <span className="num rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">{selectedIds.size} محدد</span>
              <button type="button" onClick={() => handleBulkSetVisibility(false)} disabled={bulkLoading} className="min-h-9 rounded-xl border border-hair bg-surface px-3 text-[12px] font-bold disabled:opacity-50">إخفاء المحدد</button>
              <button type="button" onClick={() => handleBulkSetVisibility(true)} disabled={bulkLoading} className="min-h-9 rounded-xl border border-hair bg-surface px-3 text-[12px] font-bold disabled:opacity-50">إظهار المحدد</button>
              <button type="button" onClick={() => setBulkDeletePending(true)} disabled={bulkLoading} className="min-h-9 rounded-xl bg-warn px-3 text-[12px] font-bold text-white disabled:opacity-50">حذف المحدد</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="min-h-9 px-2 text-[12px] text-ink-2 hover:text-ink">إلغاء التحديد</button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] animate-pulse rounded-card bg-hair" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-hair px-4 py-16 text-center">
          <h3 className="text-[17px] font-bold">لا قوالب هنا</h3>
          <p className="max-w-xs text-[13px] text-ink-2">
            {typeFilter !== 'all' || premiumFilter !== 'all'
              ? 'لا قوالب تطابق التصفية الحالية.'
              : `«${label}» بلا قوالب. المستخدم يرى القسم فارغاً.`}
          </p>
          {typeFilter === 'all' && premiumFilter === 'all' && (
            <button
              type="button"
              onClick={() => { setEditTemplate(null); setModalOpen(true) }}
              className="min-h-11 rounded-xl bg-gold px-5 text-[13px] font-semibold text-gold-on"
            >
              أضف أول قالب
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={(t) => { setEditTemplate(t); setModalOpen(true) }}
              onDelete={(t) => setDeleteTarget(t)}
              isSelected={selectedIds.has(template.id)}
              onToggleSelect={handleToggleSelect}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      )}

      <BulkUploadModal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} onSave={handleSave} category={activeCategory} />
      <TemplateModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} editTemplate={editTemplate} category={activeCategory} />
      <DeleteConfirm
        isOpen={!!deleteTarget}
        templateName={deleteTarget?.image_name || deleteTarget?.video_name || 'هذا القالب'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
      <DeleteConfirm
        isOpen={bulkDeletePending}
        templateName={`${selectedIds.size} قالب`}
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkDeletePending(false)}
        loading={bulkLoading}
      />
      <Toast toast={toast} />
    </div>
  )
}
