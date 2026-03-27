import { useState, useEffect, useCallback } from 'react'
import Sidebar, { CATEGORIES } from '../components/Sidebar'
import FilterBar from '../components/FilterBar'
import TemplateCard from '../components/TemplateCard'
import TemplateModal from '../components/TemplateModal'
import DeleteConfirm from '../components/DeleteConfirm'
import { fetchTemplates, insertTemplate, updateTemplate, deleteTemplate, deleteFile } from '../lib/supabase'

export default function Dashboard() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [premiumFilter, setPremiumFilter] = useState('all')
  const [counts, setCounts] = useState({})

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  // ─── Load templates ───────────────────────────────────────────────────────

  const loadTemplates = useCallback(async (category) => {
    setLoading(true)
    try {
      const data = await fetchTemplates(category)
      setTemplates(data)
    } catch (err) {
      showToast('خطأ في تحميل القوالب: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load counts for all categories on mount
  useEffect(() => {
    ;(async () => {
      const result = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const data = await fetchTemplates(cat.key)
            result[cat.key] = data.length
          } catch {
            result[cat.key] = 0
          }
        })
      )
      setCounts(result)
    })()
  }, [])

  useEffect(() => {
    loadTemplates(activeCategory)
    setTypeFilter('all')
    setPremiumFilter('all')
  }, [activeCategory, loadTemplates])

  // ─── Toast helper ─────────────────────────────────────────────────────────

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Filtered templates ───────────────────────────────────────────────────

  const filtered = templates.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (premiumFilter === 'free' && t.is_premium) return false
    if (premiumFilter === 'premium' && !t.is_premium) return false
    return true
  })

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async (payload, id) => {
    if (id) {
      const updated = await updateTemplate(id, payload)
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
      showToast('تم تعديل القالب بنجاح')
    } else {
      const created = await insertTemplate(payload)
      setTemplates((prev) => [created, ...prev])
      setCounts((prev) => ({ ...prev, [activeCategory]: (prev[activeCategory] ?? 0) + 1 }))
      showToast('تم نشر القالب بنجاح')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // حذف الملفات من Storage
      const { image_url, video_url } = deleteTarget
      const extractPath = (url) => {
        if (!url) return null
        try {
          const u = new URL(url)
          // المسار بعد /storage/v1/object/public/templates/
          const parts = u.pathname.split('/storage/v1/object/public/templates/')
          return parts[1] ?? null
        } catch { return null }
      }
      const imgPath = extractPath(image_url)
      const vidPath = extractPath(video_url)
      await Promise.all([
        imgPath ? deleteFile(imgPath) : Promise.resolve(),
        vidPath ? deleteFile(vidPath) : Promise.resolve(),
      ])
      await deleteTemplate(deleteTarget.id)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setCounts((prev) => ({ ...prev, [activeCategory]: Math.max(0, (prev[activeCategory] ?? 1) - 1) }))
      showToast('تم حذف القالب بنجاح')
    } catch (err) {
      showToast('خطأ في الحذف: ' + err.message, 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ─── Category label ───────────────────────────────────────────────────────

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        counts={counts}
      />

      {/* المحتوى الرئيسي */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeCat?.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeCat?.label}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{activeCat?.key}</p>
            </div>
          </div>
          <button
            onClick={() => { setEditTemplate(null); setModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 transition-all text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة قالب
          </button>
        </div>

        <div className="px-8 py-6">
          {/* Filters */}
          <FilterBar
            typeFilter={typeFilter}
            premiumFilter={premiumFilter}
            onTypeChange={setTypeFilter}
            onPremiumChange={setPremiumFilter}
            total={filtered.length}
          />

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse">
                  <div className="aspect-[9/16]" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <span className="text-3xl">{activeCat?.emoji}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">لا توجد قوالب</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                {typeFilter !== 'all' || premiumFilter !== 'all'
                  ? 'لا توجد قوالب تطابق الفلتر الحالي'
                  : 'ابدأ بإضافة أول قالب لهذا القسم'}
              </p>
              {typeFilter === 'all' && premiumFilter === 'all' && (
                <button
                  onClick={() => { setEditTemplate(null); setModalOpen(true) }}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
                >
                  إضافة قالب
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={(t) => { setEditTemplate(t); setModalOpen(true) }}
                  onDelete={(t) => setDeleteTarget(t)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal الإضافة/التعديل */}
      <TemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editTemplate={editTemplate}
        category={activeCategory}
      />

      {/* Dialog الحذف */}
      <DeleteConfirm
        isOpen={!!deleteTarget}
        templateName={deleteTarget?.image_name || deleteTarget?.video_name || 'هذا القالب'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all ${
          toast.type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  )
}
