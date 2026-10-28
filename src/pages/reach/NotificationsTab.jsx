import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NotificationsDesk from '../../components/reach/NotificationsDesk'
import Toast, { useToast } from '../../components/Toast'
import {
  createNotification, deleteNotification, markNotificationFailed, fetchAudienceCounts, fetchNotifications, fetchReachStats, fetchSchedulerReady, sendNotification,
} from '../../lib/supabase'
import { notificationView, seasonDraft } from '../../lib/reach'
import { bestWindow } from '../../lib/numbers'
import { upcomingSeasons } from '../../lib/today'

// الإشعارات: المكتب (اللقطة البطلة) فوق بيانات حقيقية. السجل يُحدَّث وحده ما دام فيه إشعار يُرسل.
export default function NotificationsTab() {
  const [params] = useSearchParams()
  const [toast, showToast] = useToast()
  const [list, setList] = useState(null)
  const [counts, setCounts] = useState(null)
  const [ready, setReady] = useState(undefined)
  const [bestHour, setBestHour] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(() => fetchNotifications().then(setList, (e) => setError(e.message)), [])

  useEffect(() => {
    reload()
    fetchAudienceCounts().then(setCounts, () => setCounts({ all: 0 }))
    fetchSchedulerReady().then(setReady, () => setReady(null))
    // أفضل وقت من «الأرقام»؛ إن لم تُحدَّث القاعدة بعد يبقى الخيار معطلاً بلا خطأ
    fetchReachStats(30).then(({ hours }) => {
      const total = hours.reduce((s, h) => s + Number(h.opens), 0)
      if (total >= 20) setBestHour(bestWindow(hours.map((h) => ({ hour: h.hour, opens: Number(h.opens) }))).start)
    }, () => {})
  }, [reload])

  const busy = (list ?? []).some((n) => notificationView(n).state === 'sending')
  useEffect(() => {
    if (!busy) return
    const t = setInterval(reload, 2500)
    return () => clearInterval(t)
  }, [busy, reload])

  const suggestion = useMemo(() => seasonDraft(upcomingSeasons([], new Date())), [])

  const onCreate = async (payload) => {
    const row = await createNotification(payload)
    setList((l) => [row, ...(l ?? [])])
    return row
  }
  const onSend = async (id) => {
    setList((l) => l.map((n) => (n.id === id ? { ...n, status: 'sending', updated_at: new Date().toISOString() } : n)))
    try {
      await sendNotification(id)
    } catch (e) {
      await markNotificationFailed(id, e.message).catch(() => {})
      throw e
    } finally {
      await reload()
    }
  }
  const onDelete = async (id) => {
    try {
      await deleteNotification(id)
      setList((l) => l.filter((n) => n.id !== id))
    } catch (e) {
      showToast(`تعذّر الحذف: ${e.message}`, 'error')
    }
  }

  if (error && !list) return <p className="rounded-card bg-warn/10 px-4 py-3 text-[13px] text-warn">تعذّر قراءة الإشعارات: {error}</p>
  if (!list || !counts || ready === undefined) {
    return (
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-card bg-hair" />)}</div>
        <div className="mx-auto h-[600px] w-[300px] animate-pulse rounded-[50px] bg-hair" />
      </div>
    )
  }

  return (
    <>
      <NotificationsDesk
        counts={counts}
        schedulerReady={ready}
        bestHour={bestHour}
        suggestion={suggestion}
        notifications={list}
        onCreate={onCreate}
        onSend={onSend}
        onDelete={onDelete}
        initialWhen={params.get('when') === 'best' ? 'best' : 'now'}
      />
      <Toast toast={toast} />
    </>
  )
}
