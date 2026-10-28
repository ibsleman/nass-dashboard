import { NavLink, Outlet, useLocation } from 'react-router-dom'

// القائمة على قدر عمل المدير لا على جداول قاعدة البيانات (G1 الداش بورد).
// «اليوم» يأتي في المرحلة الثانية — لا مكان في القائمة لصفحة لم تُبنَ بعد.
export const PLACES = [
  { to: '/templates', label: 'القوالب' },
  { to: '/numbers', label: 'الأرقام' },
  { to: '/reach', label: 'التواصل' },
  { to: '/income', label: 'الدخل' },
]
const SETTINGS = { to: '/settings', label: 'الإعدادات' }

function Logo({ className = '' }) {
  return (
    <span className={`font-logo inline-flex items-baseline gap-0.5 leading-none ${className}`} aria-label="نص">
      نص<i className="inline-block h-[0.2em] w-[0.2em] rounded-full bg-gold" aria-hidden />
    </span>
  )
}

function SideLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex min-h-11 items-center rounded-xl px-3 text-[15px] transition-colors ${
          isActive
            ? 'bg-surface font-bold text-ink shadow-[inset_0_0_0_1px_rgb(var(--c-hair)/var(--hair-alpha))] before:absolute before:-start-4 before:top-3 before:bottom-3 before:w-[3px] before:rounded-e-[3px] before:bg-gold'
            : 'font-medium text-ink-2 hover:bg-sunken hover:text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function TabLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `grid min-h-11 justify-items-center gap-0.5 py-1.5 text-[11px] ${isActive ? 'font-bold text-ink' : 'text-ink-2'}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-gold' : 'bg-transparent'}`} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function Shell() {
  const { pathname } = useLocation()
  const current = [...PLACES, SETTINGS].find((p) => pathname.startsWith(p.to))

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-ink">
      <aside className="hidden w-[212px] flex-shrink-0 flex-col gap-6 border-e border-hair px-4 py-6 md:flex">
        <Logo className="px-3 text-[30px]" />
        <nav className="grid gap-1" aria-label="أقسام اللوحة">
          {PLACES.map((p) => <SideLink key={p.to} {...p} />)}
        </nav>
        <nav className="mt-auto grid gap-1" aria-label="الإعدادات">
          <SideLink {...SETTINGS} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-hair px-4 md:hidden">
          <Logo className="text-[26px]" />
          <span className="text-[15px] font-bold">{current?.label}</span>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hair bg-surface px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="أقسام اللوحة"
      >
        {[...PLACES, SETTINGS].map((p) => <TabLink key={p.to} {...p} />)}
      </nav>
    </div>
  )
}
