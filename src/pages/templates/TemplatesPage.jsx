import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { fetchTemplatesOverview } from '../../lib/supabase'
import { hasSpot } from '../../lib/nameSpot'
import Library from './Library'
import ThumbnailsBackfill from '../../components/ThumbnailsBackfill'
import PlacePage from './PlacePage'
import StudioTemplatesPage from '../StudioTemplatesPage'

// «القوالب»: كل ما يخص القوالب في مكان واحد — المناسبات، قوالب الاستوديو، ووضع الاسم

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-1 text-[15px] ${
          isActive ? 'font-bold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full after:bg-gold' : 'text-ink-2 hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function TemplatesPage() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    fetchTemplatesOverview().then(setOverview, (e) => setError(e.message))
  }, [])
  useEffect(reload, [reload])

  const unplaced = useMemo(() => (overview ? overview.filter((t) => !hasSpot(t)).length : null), [overview])

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8">
      <header className="grid gap-4">
        <h1 className="text-[30px] font-extrabold leading-tight">القوالب</h1>
        <nav className="flex gap-6 overflow-x-auto border-b border-hair" aria-label="أقسام القوالب">
          <Tab to="occasions">المناسبات</Tab>
          <Tab to="studio">قوالب الاستوديو</Tab>
          <Tab to="place">
            ضع الاسم
            {unplaced > 0 && <span className="num rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">{unplaced}</span>}
          </Tab>
        </nav>
      </header>

      {error && <p className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">تعذّر تحميل القوالب: {error}</p>}

      <ThumbnailsBackfill overview={overview} onChanged={reload} />

      <Routes>
        <Route index element={<Navigate to="occasions" replace />} />
        <Route path="occasions/:occasion?" element={<Library overview={overview} onChanged={reload} />} />
        <Route path="studio" element={<StudioTemplatesPage />} />
        <Route path="place" element={<PlacePage overview={overview} onChanged={reload} />} />
      </Routes>
    </div>
  )
}
