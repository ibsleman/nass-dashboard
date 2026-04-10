import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// ── Country list ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "SA", label: "🇸🇦 المملكة العربية السعودية" },
  { code: "AE", label: "🇦🇪 الإمارات العربية المتحدة" },
  { code: "OM", label: "🇴🇲 سلطنة عُمان" },
  { code: "KW", label: "🇰🇼 الكويت" },
  { code: "BH", label: "🇧🇭 البحرين" },
  { code: "QA", label: "🇶🇦 قطر" },
  { code: "EG", label: "🇪🇬 مصر" },
  { code: "JO", label: "🇯🇴 الأردن" },
  { code: "IQ", label: "🇮🇶 العراق" },
  { code: "MA", label: "🇲🇦 المغرب" },
];

const COUNTRY_FLAG = {
  SA: "🇸🇦", AE: "🇦🇪", OM: "🇴🇲", KW: "🇰🇼", BH: "🇧🇭",
  QA: "🇶🇦", EG: "🇪🇬", JO: "🇯🇴", IQ: "🇮🇶", MA: "🇲🇦",
};

const STATUS_CONFIG = {
  pending:   { label: "في الانتظار", bg: "rgba(234,179,8,0.18)",   text: "#fbbf24" },
  sending:   { label: "جاري الإرسال", bg: "rgba(59,130,246,0.18)", text: "#60a5fa" },
  sent:      { label: "تم الإرسال",   bg: "rgba(22,163,74,0.18)",  text: "#4ade80" },
  failed:    { label: "فشل",          bg: "rgba(239,68,68,0.18)",  text: "#f87171" },
  scheduled: { label: "مجدول",        bg: "rgba(139,92,246,0.18)", text: "#a78bfa" },
};

const EMPTY_FORM = {
  title: "",
  body: "",
  target: "all",
  country: "SA",
  schedule: false,
  scheduled_at: "",
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.text,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "error" ? "#ef4444" : "#16a34a",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,.3)",
        whiteSpace: "nowrap",
      }}
    >
      {msg}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "#a78bfa" }) {
  return (
    <div
      style={{
        background: "#0f0f1a",
        border: "1px solid rgba(124,58,237,0.2)",
        borderRadius: 14,
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
        boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
      }}
    >
      <p style={{ fontSize: 12, color: "#6b6b8a", marginBottom: 6, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {value ?? "—"}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotificationsManager() {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: null, active: null, sentThisMonth: null });
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const intervalRef = useRef(null);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3000);
  }

  // ── fetch notifications ───────────────────────────────────────────────────
  async function fetchNotifications() {
    const { data, error } = await supabase
      .from("push_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setNotifications(data);
  }

  // ── fetch stats ───────────────────────────────────────────────────────────
  async function fetchStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalRes, activeRes, sentRes] = await Promise.all([
      supabase.from("device_tokens").select("id", { count: "exact", head: true }),
      supabase.from("device_tokens").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("push_notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", monthStart),
    ]);

    setStats({
      total: totalRes.count ?? 0,
      active: activeRes.count ?? 0,
      sentThisMonth: sentRes.count ?? 0,
    });
  }

  // ── initial load + polling ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchNotifications(), fetchStats()]);
      setLoading(false);
    }
    init();

    intervalRef.current = setInterval(fetchNotifications, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── form helpers ──────────────────────────────────────────────────────────
  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.title.trim()) { showToast("اكتب عنوان الإشعار", "error"); return; }
    if (!form.body.trim())  { showToast("اكتب نص الإشعار", "error"); return; }
    if (form.schedule && !form.scheduled_at) {
      showToast("حدد وقت الجدولة", "error");
      return;
    }

    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      target: form.target,
      country: form.target === "country" ? form.country : null,
      status: form.schedule ? "scheduled" : "pending",
      scheduled_at: form.schedule ? new Date(form.scheduled_at).toISOString() : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("push_notifications")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      showToast("خطأ في الحفظ: " + insertError.message, "error");
      setSubmitting(false);
      return;
    }

    if (!form.schedule) {
      // Call Edge Function
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey  = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ notification_id: inserted.id }),
        });
      } catch (err) {
        // Edge function call failed — notification is already inserted as pending
        showToast("تم إنشاء الإشعار لكن فشل الإرسال: " + err.message, "error");
        setSubmitting(false);
        await fetchNotifications();
        return;
      }
      showToast("تم إرسال الإشعار بنجاح");
    } else {
      showToast("تمت جدولة الإشعار بنجاح");
    }

    setForm({ ...EMPTY_FORM });
    setSubmitting(false);
    await fetchNotifications();
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    const { error } = await supabase.from("push_notifications").delete().eq("id", id);
    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast("تم الحذف");
    } else {
      showToast("خطأ في الحذف", "error");
    }
    setConfirmDelete(null);
  }

  // ── styles ────────────────────────────────────────────────────────────────
  const card = {
    background: "#0f0f1a",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 16,
    padding: "20px 24px",
    marginBottom: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#e5e7eb",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    direction: "rtl",
  };

  const labelStyle = { fontSize: 13, color: "#9ca3af", fontWeight: 500, marginBottom: 6, display: "block" };

  const radioGroup = {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  };

  const submitBtnStyle = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    cursor: submitting ? "not-allowed" : "pointer",
    fontWeight: 700,
    fontSize: 15,
    background: submitting ? "#4b5563" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
    color: "#fff",
    boxShadow: submitting ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
    transition: "all 0.2s",
    marginTop: 8,
    opacity: submitting ? 0.7 : 1,
  };

  const thStyle = {
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "#6b6b8a",
    textAlign: "right",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    whiteSpace: "nowrap",
  };

  const tdStyle = {
    padding: "12px 14px",
    fontSize: 13,
    color: "#d1d5db",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    verticalAlign: "middle",
    textAlign: "right",
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", direction: "rtl", minHeight: "100%" }}>

      <style>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        input::placeholder, textarea::placeholder { color: #4b5563; }
        select option { background: #1a1a2e; color: #e5e7eb; }
        .notif-row:hover td { background: rgba(124,58,237,0.04); }
        input[type="radio"] { accent-color: #7c3aed; }
      `}</style>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb", margin: 0 }}>
          🔔 إدارة الإشعارات
        </h1>
        <p style={{ fontSize: 13, color: "#6b6b8a", marginTop: 4 }}>
          أرسل أو جدول إشعارات Push للمستخدمين
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="إجمالي الأجهزة المسجلة" value={stats.total} color="#a78bfa" />
        <StatCard label="الأجهزة النشطة"           value={stats.active} color="#4ade80" />
        <StatCard label="إشعارات هذا الشهر"        value={stats.sentThisMonth} color="#60a5fa" />
      </div>

      {/* ── Send / Schedule Form ── */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e5e7eb", marginBottom: 20, marginTop: 0 }}>
          إرسال / جدولة إشعار
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Title */}
            <div>
              <label style={labelStyle}>العنوان *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="عنوان الإشعار..."
                style={inputStyle}
                maxLength={100}
              />
            </div>

            {/* Target */}
            <div>
              <label style={labelStyle}>الاستهداف</label>
              <div style={radioGroup}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#e5e7eb", fontSize: 14 }}>
                  <input
                    type="radio"
                    name="target"
                    value="all"
                    checked={form.target === "all"}
                    onChange={() => setField("target", "all")}
                  />
                  الكل
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#e5e7eb", fontSize: 14 }}>
                  <input
                    type="radio"
                    name="target"
                    value="country"
                    checked={form.target === "country"}
                    onChange={() => setField("target", "country")}
                  />
                  دولة محددة
                </label>
              </div>

              {/* Country dropdown */}
              {form.target === "country" && (
                <select
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  style={{ ...inputStyle, marginTop: 10 }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>النص *</label>
            <textarea
              value={form.body}
              onChange={(e) => setField("body", e.target.value)}
              placeholder="نص الإشعار..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
              maxLength={300}
            />
          </div>

          {/* Schedule toggle */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>وقت الإرسال</label>
            <div style={radioGroup}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#e5e7eb", fontSize: 14 }}>
                <input
                  type="radio"
                  name="schedule"
                  checked={!form.schedule}
                  onChange={() => setField("schedule", false)}
                />
                إرسال فوري
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#e5e7eb", fontSize: 14 }}>
                <input
                  type="radio"
                  name="schedule"
                  checked={form.schedule}
                  onChange={() => setField("schedule", true)}
                />
                جدولة لوقت لاحق
              </label>
            </div>

            {/* DateTime picker */}
            {form.schedule && (
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setField("scheduled_at", e.target.value)}
                style={{ ...inputStyle, marginTop: 10, colorScheme: "dark" }}
              />
            )}
          </div>

          <button type="submit" disabled={submitting} style={submitBtnStyle}>
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
                جاري المعالجة...
              </span>
            ) : form.schedule ? "جدولة الإشعار" : "إرسال الآن"}
          </button>
        </form>
      </div>

      {/* ── Notifications History Table ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e5e7eb", margin: 0 }}>
            سجل الإشعارات
          </h2>
          <button
            onClick={fetchNotifications}
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: 8,
              color: "#a78bfa",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            تحديث
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b6b8a" }}>
            <svg style={{ width: 32, height: 32, margin: "0 auto 12px", animation: "spin 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="rgba(124,58,237,0.3)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 14 }}>جاري التحميل...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>🔕</p>
            <p style={{ color: "#6b6b8a", fontSize: 14 }}>لا توجد إشعارات بعد</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={thStyle}>العنوان</th>
                  <th style={thStyle}>الهدف</th>
                  <th style={thStyle}>الحالة</th>
                  <th style={thStyle}>الوقت</th>
                  <th style={thStyle}>النتائج</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => {
                  const canDelete = ["pending", "scheduled", "failed"].includes(n.status);
                  const timeLabel = n.status === "scheduled" && n.scheduled_at
                    ? new Date(n.scheduled_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })
                    : n.sent_at
                      ? new Date(n.sent_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })
                      : new Date(n.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });

                  return (
                    <tr key={n.id} className="notif-row">
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#e5e7eb", marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: "#6b6b8a", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.body}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {n.target === "all" ? (
                          <span style={{ color: "#9ca3af", fontSize: 13 }}>🌍 الكل</span>
                        ) : (
                          <span style={{ fontSize: 13 }}>
                            {COUNTRY_FLAG[n.country] || "🏳"} {n.country}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={n.status} />
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {timeLabel}
                      </td>
                      <td style={tdStyle}>
                        {n.status === "sent" ? (
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ {n.success_count ?? 0}</span>
                            {" / "}
                            <span style={{ color: "#f87171", fontWeight: 600 }}>✗ {n.fail_count ?? 0}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#4b5563", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {canDelete && (
                          confirmDelete === n.id ? (
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                onClick={() => handleDelete(n.id)}
                                style={{
                                  background: "#ef4444", border: "none", borderRadius: 6,
                                  color: "#fff", fontSize: 11, fontWeight: 700,
                                  padding: "4px 10px", cursor: "pointer",
                                }}
                              >
                                تأكيد
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                style={{
                                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                                  borderRadius: 6, color: "#9ca3af", fontSize: 11,
                                  fontWeight: 600, padding: "4px 10px", cursor: "pointer",
                                }}
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(n.id)}
                              title="حذف"
                              style={{
                                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)",
                                borderRadius: 8, color: "#f87171", padding: "6px 8px",
                                cursor: "pointer", display: "inline-flex", alignItems: "center",
                              }}
                            >
                              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
