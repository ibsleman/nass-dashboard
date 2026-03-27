import { useState, useEffect, useCallback } from 'react'
import Sidebar, { CATEGORIES } from '../components/Sidebar'
import FilterBar from '../components/FilterBar'
import TemplateCard from '../components/TemplateCard'
import TemplateModal from '../components/TemplateModal'
import DeleteConfirm from '../components/DeleteConfirm'
import { useTheme } from '../context/ThemeContext'
import {
  fetchTemplates,
  insertTemplate,
  updateTemplate,
  deleteTemplate,
  deleteFile,
} from '../lib/supabase'

export default function Dashboard() {
  const { isDark, toggleTheme } = useTheme()
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key)
  const [templates, setTemplates]           = useState([])
  const [loading, setLoading]               = useState(false)
  const [typeFilter, setTypeFilter]         = useState('all')
  const [premiumFilter, setPremiumFilter]   = useState('all')
  const [counts, setCounts]                 = useState({})

  // Modal
  const [modalOpen, setModalOpen]     = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  // ─── تحميل القوالب ──────────────────────────────────────────────────────────

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

  // عداد كل الأقسام عند أول تحميل
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

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── فلترة ──────────────────────────────────────────────────────────────────

  const filtered = templates.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (premiumFilter === 'free'    &&  t.is_premium)  return false
    if (premiumFilter === 'premium' && !t.is_premium)  return false
    return true
  })

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const handleSave = async (payload, id) => {
    if (id) {
      const updated = await updateTemplate(id, payload)
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
      showToast('تم تعديل القالب بنجاح ✓')
    } else {
      const created = await insertTemplate(payload)
      setTemplates((prev) => [created, ...prev])
      setCounts((prev) => ({ ...prev, [activeCategory]: (prev[activeCategory] ?? 0) + 1 }))
      showToast('تم نشر القالب بنجاح ✓')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const extractPath = (url) => {
        if (!url) return null
        try {
          const u = new URL(url)
          const parts = u.pathname.split('/storage/v1/object/public/templates/')
          return parts[1] ?? null
        } catch { return null }
      }
      const imgPath = extractPath(deleteTarget.image_url)
      const vidPath = extractPath(deleteTarget.video_url)
      await Promise.all([
        imgPath ? deleteFile(imgPath) : Promise.resolve(),
        vidPath ? deleteFile(vidPath) : Promise.resolve(),
      ])
      await deleteTemplate(deleteTarget.id)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setCounts((prev) => ({
        ...prev,
        [activeCategory]: Math.max(0, (prev[activeCategory] ?? 1) - 1),
      }))
      showToast('تم حذف القالب بنجاح')
    } catch (err) {
      showToast('خطأ في الحذف: ' + err.message, 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ══════════ Top Header — يمتد على كامل العرض ══════════ */}
      <header className="flex-shrink-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm flex items-center px-5 gap-3">

        {/* ① الشعار — أقصى اليمين في RTL (أول عنصر DOM) */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-md">
            <span className="text-white font-black text-base">N</span>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Nass CMS</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">إدارة القوالب</p>
          </div>
        </div>

        {/* فاصل */}
        <div className="w-px h-7 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mx-1" />

        {/* ② عنوان القسم النشط — يملأ المساحة الوسطى */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{activeCat?.emoji}</span>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white truncate leading-tight">
              {activeCat?.label}
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{activeCat?.key}</p>
          </div>
        </div>

        {/* ③ الأزرار — أقصى اليسار في RTL (آخر عنصر DOM) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* تبديل الثيم */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* زر إضافة قالب */}
          <button
            onClick={() => { setEditTemplate(null); setModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 transition-all text-sm"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">إضافة قالب</span>
          </button>
        </div>
      </header>

      {/* ══════════ Body ══════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* السايدبار — يمين (أول في DOM = يمين في RTL) */}
        <Sidebar
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          counts={counts}
        />

        {/* المحتوى الرئيسي — يسار */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6">

            <FilterBar
              typeFilter={typeFilter}
              premiumFilter={premiumFilter}
              onTypeChange={setTypeFilter}
              onPremiumChange={setPremiumFilter}
              total={filtered.length}
            />

            {/* ─── Grid ─────────────────────────────────────────── */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
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
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex items-center justify-center mb-5 shadow-inner">
                  <span className="text-4xl">{activeCat?.emoji}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  لا توجد قوالب
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
                  {typeFilter !== 'all' || premiumFilter !== 'all'
                    ? 'لا توجد قوالب تطابق الفلتر الحالي، جرب تغيير الفلتر'
                    : `ابدأ بإضافة أول قالب في قسم "${activeCat?.label}"`}
                </p>
                {typeFilter === 'all' && premiumFilter === 'all' && (
                  <button
                    onClick={() => { setEditTemplate(null); setModalOpen(true) }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white text-sm font-semibold hover:from-brand-700 hover:to-brand-600 transition-all shadow-md"
                  >
                    إضافة قالب جديد
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {filtered.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={(t)  => { setEditTemplate(t); setModalOpen(true) }}
                    onDelete={(t) => setDeleteTarget(t)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

      </div>

      {/* ══════════ Modals ══════════ */}
      <TemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editTemplate={editTemplate}
        category={activeCategory}
      />

      <DeleteConfirm
        isOpen={!!deleteTarget}
        templateName={deleteTarget?.image_name || deleteTarget?.video_name || 'هذا القالب'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* ══════════ Toast ══════════ */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${
            toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          }`}
        >
          {toast.type === 'error' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  )
}
