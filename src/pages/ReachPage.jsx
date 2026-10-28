import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import LegacyRoom from '../components/LegacyRoom'
import NotificationsManager from './NotificationsManager'
import AppUpdatesManager from './AppUpdatesManager'

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
    <LegacyRoom>
      <div className="mx-auto grid max-w-[1400px] gap-2 px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-extrabold leading-tight">التواصل</h1>
        <nav className="flex gap-6 border-b border-hair" aria-label="أقسام التواصل">
          <Tab to="notifications">الإشعارات</Tab>
          <Tab to="update">رسالة التحديث</Tab>
        </nav>
      </div>
      <Routes>
        <Route index element={<Navigate to="notifications" replace />} />
        <Route path="notifications" element={<NotificationsManager />} />
        <Route path="update" element={<AppUpdatesManager />} />
      </Routes>
    </LegacyRoom>
  )
}
