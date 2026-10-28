import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)
const KEY = 'nass_theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** المظهر يتبع الجهاز (كالتطبيق) ما لم يختر المشرف نهارياً أو ليلياً من الإعدادات */
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const stored = localStorage.getItem(KEY)
      // القيم القديمة 'dark'/'light' كانت تُكتب تلقائياً عند كل فتح — تُعامل كاختيار حسب الجهاز
      return stored === 'pick-light' || stored === 'pick-dark' ? stored.slice(5) : 'auto'
    } catch {
      return 'auto'
    }
  })
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const onChange = (e) => setSystemDark(e.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const isDark = mode === 'auto' ? systemDark : mode === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      if (mode === 'auto') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, `pick-${mode}`)
    } catch { /* التخزين محجوب: يبقى الاختيار لهذه الجلسة */ }
  }, [isDark, mode])

  const toggleTheme = () => setMode(isDark ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ isDark, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
