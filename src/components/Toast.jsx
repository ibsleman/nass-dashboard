import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/** رسالة قصيرة أسفل الشاشة — تصعد من الحافة التي تختفي إليها */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, type = 'success') => {
    clearTimeout(timer.current)
    setToast({ message, type, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 5000 : 3500)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [toast, show]
}

export default function Toast({ toast }) {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            className={`max-w-[560px] rounded-2xl px-5 py-3 text-[13px] font-semibold shadow-card ${
              toast.type === 'error' ? 'bg-warn text-white' : 'bg-ink text-bg'
            }`}
            initial={reduce ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 385, damping: 30 }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
