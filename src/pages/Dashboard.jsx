import { useState, useEffect, useCallback, useRef } from 'react'
import AdsManager from './AdsManager'
import Sidebar, { CATEGORIES } from '../components/Sidebar'
import FilterBar from '../components/FilterBar'
import TemplateCard from '../components/TemplateCard'
import TemplateModal from '../components/TemplateModal'
import BulkUploadModal from '../components/BulkUploadModal'
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
  const isAdsPage = activeCategory === '__ads__'
  const [templates, setTemplates]           = useState([])
  const [loading, setLoading]               = useState(false)
  const [typeFilter, setTypeFilter]         = useState('all')
  const [premiumFilter, setPremiumFilter]   = useState('all')
  const [counts, setCounts]                 = useState({})

  // Mobile dropdown
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef                         = useRef(null)

  // Modal / Delete
  const [modalOpen, setModalOpen]         = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editTemplate, setEditTemplate]   = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [deleting, setDeleting]           = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  // ─── إغلاق الـ dropdown عند الضغط خارجه ──────────────────────────────────
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

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

  useEffect(() => {
    ;(async () => {
      const result = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const data = await fetchTemplates(cat.key)
            result[cat.key] = data.length
          } catch { result[cat.key] = 0 }
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
      await Promise.all([
        extractPath(deleteTarget.image_url) ? deleteFile(extractPath(deleteTarget.image_url)) : Promise.resolve(),
        extractPath(deleteTarget.video_url) ? deleteFile(extractPath(deleteTarget.video_url)) : Promise.resolve(),
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

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ══════════ Top Header ══════════ */}
      <header className="flex-shrink-0 h-14 md:h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm flex items-center px-3 md:px-5 gap-2 md:gap-3 relative z-40">

        {/* ① الشعار */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
            <span className="text-white font-black text-sm md:text-base">N</span>
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Nass CMS</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">إدارة القوالب</p>
          </div>
        </div>

        {/* فاصل — desktop فقط */}
        <div className="hidden md:block w-px h-7 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mx-1" />

        {/* ② mobile: dropdown الأقسام */}
        <div className="md:hidden relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-bold transition-colors active:bg-gray-200 dark:active:bg-gray-700"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 text-base">{activeCat?.emoji}</span>
              <span className="truncate">{activeCat?.label}</span>
              {counts[activeCat?.key] !== undefined && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold tabular-nums">
                  {counts[activeCat?.key]}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* قائمة الأقسام المنسدلة */}
          {mobileMenuOpen && (
            <div className="absolute top-full mt-2 inset-x-0 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 py-1.5">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => { setActiveCategory(cat.key); setMobileMenuOpen(false) }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </div>
                    {counts[cat.key] !== undefined && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums ${
                        isActive
                          ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {counts[cat.key]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ② desktop: عنوان القسم النشط */}
        <div className="hidden md:flex flex-1 items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{activeCat?.emoji}</span>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white truncate leading-tight">{activeCat?.label}</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{activeCat?.key}</p>
          </div>
        </div>

        {/* ③ الأزرار */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
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

          {/* زر رفع متعدد */}
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all text-sm"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">رفع متعدد</span>
          </button>

          {/* زر الإضافة */}
          <button
            onClick={() => { setEditTemplate(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 active:scale-95 transition-all text-sm"
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

        {/* السايدبار — مخفي على الهاتف، يظهر على md+ */}
        <Sidebar
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          counts={counts}
        />

        {/* المحتوى الرئيسي */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {isAdsPage ? (
            <AdsManager />
          ) : (
            <div className="p-3 sm:p-4 md:p-6">

              <FilterBar
                typeFilter={typeFilter}
                premiumFilter={premiumFilter}
                onTypeChange={setTypeFilter}
                onPremiumChange={setPremiumFilter}
                total={filtered.length}
              />

              {/* ─── Grid ─── */}
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
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
                <div className="flex flex-col items-center justify-center py-20 md:py-28 text-center px-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex items-center justify-center mb-4 shadow-inner">
                    <span className="text-3xl md:text-4xl">{activeCat?.emoji}</span>
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-700 dark:text-gray-300 mb-1.5">لا توجد قوالب</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 max-w-xs">
                    {typeFilter !== 'all' || premiumFilter !== 'all'
                      ? 'لا توجد قوالب تطابق الفلتر الحالي'
                      : `ابدأ بإضافة أول قالب في قسم "${activeCat?.label}"`}
                  </p>
                  {typeFilter === 'all' && premiumFilter === 'all' && (
                    <button
                      onClick={() => { setEditTemplate(null); setModalOpen(true) }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white text-sm font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 transition-all"
                    >
                      إضافة قالب جديد
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
                  {filtered.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={(t)   => { setEditTemplate(t); setModalOpen(true) }}
                      onDelete={(t) => setDeleteTarget(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ══════════ Modals ══════════ */}
      <BulkUploadModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSave={handleSave}
        category={activeCategory}
      />

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
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 md:px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold whitespace-nowrap ${
          toast.type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
        }`}>
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
