import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import NotificationsTab from './reach/NotificationsTab'
import UpdateTab from './reach/UpdateTab'

// «التواصل»: كل ما يصل المستخدم من خارج القوالب — الإشعارات ورسالة التحديث داخل التطبيق
function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[15px] ${
          isActive ? 'font-bold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full after:bg-gold' : 'text-ink-2 hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function ReachPage() {
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8">
      <header className="grid gap-2">
        <h1 className="text-[30px] font-extrabold leading-tight">التواصل</h1>
        <nav className="flex gap-6 border-b border-hair" aria-label="أقسام التواصل">
          <Tab to="notifications">الإشعارات</Tab>
          <Tab to="update">رسالة التحديث</Tab>
        </nav>
      </header>
      <Routes>
        <Route index element={<Navigate to="notifications" replace />} />
        <Route path="notifications" element={<NotificationsTab />} />
        <Route path="update" element={<UpdateTab />} />
      </Routes>
    </div>
  )
}
