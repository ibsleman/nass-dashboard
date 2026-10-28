// مختبر معزول للقطة البطلة في «القوالب»: الحذف بضغط مطوّل ثم إعادة تدفق الشبكة.
// ?theme=dark|light · الحذف وهمي
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import '../src/index.css'
import TemplateTile from '../src/components/TemplateTile'
import HoldButton from '../src/components/HoldButton'
import rows from './fixtures/templates.json'

const q = new URLSearchParams(location.search)
const theme = q.get('theme')
document.documentElement.classList.toggle('dark', theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

function Lab() {
  const reduce = useReducedMotion()
  const [list, setList] = useState(() => rows.filter((r) => r.type !== 'video').slice(0, 10))
  const [cleared, setCleared] = useState(false)
  const [selected, setSelected] = useState(new Set())
  window.__count = list.length
  const remove = (t) => new Promise((res) => setTimeout(() => { setList((l) => l.filter((x) => x.id !== t.id)); res() }, 250))
  return (
    <main className="min-h-screen bg-bg px-4 py-8 md:px-10">
      <div className="mx-auto grid max-w-[1180px] gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[30px] font-extrabold">رمضان</h1>
          <div className="w-[320px]">
            <HoldButton label={cleared ? 'حُذف' : `اضغط مطوّلاً لحذف ${list.length} قوالب`} onConfirm={() => new Promise((r) => setTimeout(() => { setCleared(true); r() }, 300))} className="w-full" />
          </div>
        </header>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <TemplateTile
                key={t.id}
                template={t}
                reduce={reduce}
                selected={selected.has(t.id)}
                selecting={selected.size > 0}
                onToggleSelect={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })}
                onEdit={() => {}}
                onToggleVisibility={(x) => setList((l) => l.map((y) => (y.id === x.id ? { ...y, is_visible: y.is_visible === false } : y)))}
                onDelete={remove}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><Lab /></BrowserRouter></StrictMode>)
