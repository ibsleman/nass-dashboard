import { useState, useEffect, useRef } from "react";
import {
  fetchAppUpdates,
  createAppUpdate,
  toggleAppUpdate,
  deleteAppUpdate,
  uploadUpdateImage,
} from "../lib/supabase";

// ── helpers ──────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  version: "",
  title: "",
  message: "",
  image_url: "",
  type: "optional",
};

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#16a34a" : "#d1d5db",
        position: "relative",
        transition: "background .2s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}

function Badge({ children, color = "gray" }) {
  const colors = {
    green:  { bg: "#dcfce7", text: "#15803d" },
    red:    { bg: "#fee2e2", text: "#b91c1c" },
    gray:   { bg: "#f3f4f6", text: "#6b7280" },
    orange: { bg: "#ffedd5", text: "#c2410c" },
    blue:   { bg: "#dbeafe", text: "#1d4ed8" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "#ef4444" : "#16a34a",
      color: "#fff", padding: "10px 20px", borderRadius: 10,
      fontSize: 14, fontWeight: 500, zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,.2)", animation: "fadeIn .2s ease",
    }}>
      {msg}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function AppUpdatesManager() {
  const [updates, setUpdates]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [togglingId, setTogglingId]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [toast, setToast]               = useState({ msg: "", type: "ok" });
  const imageInputRef                   = useRef(null);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3000);
  }

  // ── fetch ─────────────────────────────────────────────────────────────────
  async function loadUpdates() {
    setLoading(true);
    try {
      const data = await fetchAppUpdates();
      setUpdates(data);
    } catch (err) {
      showToast("خطأ في التحميل: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUpdates(); }, []);

  // ── publish ───────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!form.version.trim()) { showToast("أدخل رقم الإصدار", "error"); return; }
    if (!form.title.trim())   { showToast("أدخل عنوان التحديث", "error"); return; }
    setSaving(true);
    try {
      const created = await createAppUpdate({
        version:   form.version.trim(),
        title:     form.title.trim(),
        message:   form.message.trim() || null,
        image_url: form.image_url || null,
        type:      form.type,
        is_active: false,
      });
      setUpdates((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast("تم نشر التحديث بنجاح ✓");
    } catch (err) {
      showToast("خطأ في النشر: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── toggle active ─────────────────────────────────────────────────────────
  async function handleToggle(update) {
    setTogglingId(update.id);
    try {
      const updated = await toggleAppUpdate(update.id, !update.is_active);
      setUpdates((prev) =>
        prev.map((u) => {
          if (u.id === updated.id) return updated;
          if (updated.is_active) return { ...u, is_active: false };
          return u;
        })
      );
    } catch (err) {
      showToast("خطأ: " + err.message, "error");
    } finally {
      setTogglingId(null);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await deleteAppUpdate(id);
      setUpdates((prev) => prev.filter((u) => u.id !== id));
      showToast("تم الحذف");
    } catch (err) {
      showToast("خطأ في الحذف: " + err.message, "error");
    } finally {
      setConfirmDelete(null);
    }
  }

  // ── image upload ──────────────────────────────────────────────────────────
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadUpdateImage(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      showToast("تم رفع الصورة ✓");
    } catch (err) {
      showToast("فشل رفع الصورة: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  }

  // ── styles ────────────────────────────────────────────────────────────────
  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "20px 24px",
    marginBottom: 16,
  };

  const row = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const lbl  = { fontSize: 14, color: "#374151", fontWeight: 500, marginBottom: 6, display: "block" };
  const inp  = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const btn = (variant = "primary") => ({
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background:
      variant === "primary" ? "#7c3aed"
      : variant === "danger" ? "#ef4444"
      : "#f3f4f6",
    color: variant === "ghost" ? "#374151" : "#fff",
  });

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }) : "—";

  if (loading) return (
    <div style={{ textAlign: "center", padding: 80, color: "#9ca3af" }}>جارٍ التحميل…</div>
  );

  const updateToDelete = confirmDelete ? updates.find((u) => u.id === confirmDelete) : null;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px", direction: "rtl" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .update-row:hover{background:#f9fafb!important}
      `}</style>

      {/* ── Header ── */}
      <div style={{ ...row, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>تحديثات التطبيق</h1>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
            إدارة إشعارات التحديثات الإجبارية والاختيارية
          </div>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setShowForm((v) => !v); }}
          style={btn("primary")}
        >
          {showForm ? "إخفاء الفورم" : "+ تحديث جديد"}
        </button>
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <div style={{ ...card, animation: "fadeIn .2s ease", borderColor: "#7c3aed", borderWidth: 1.5 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>نشر تحديث جديد</div>
          <div style={{ display: "grid", gap: 14 }}>

            {/* Version + Title */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div>
                <label style={lbl}>رقم الإصدار *</label>
                <input
                  style={inp}
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label style={lbl}>عنوان التحديث *</label>
                <input
                  style={inp}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="ما الجديد في هذا الإصدار؟"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label style={lbl}>رسالة / وصف</label>
              <textarea
                style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.6 }}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="اكتب تفاصيل التحديث هنا…"
              />
            </div>

            {/* Image + Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Image upload */}
              <div>
                <label style={lbl}>صورة التحديث (اختياري)</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    style={{ ...btn("ghost"), padding: "9px 16px", fontSize: 13 }}
                    disabled={uploading}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {uploading ? "جارٍ الرفع…" : "رفع صورة"}
                  </button>
                  {form.image_url && (
                    <span style={{ fontSize: 12, color: "#16a34a" }}>✓ تم الرفع</span>
                  )}
                </div>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="preview"
                    style={{ marginTop: 8, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }}
                  />
                )}
              </div>

              {/* Type */}
              <div>
                <label style={lbl}>نوع التحديث</label>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {[
                    { value: "optional", label: "اختياري", color: "#1d4ed8" },
                    { value: "forced",   label: "إجباري",   color: "#dc2626" },
                  ].map(({ value, label, color }) => (
                    <label
                      key={value}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                        padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                        border: `2px solid ${form.type === value ? color : "#e5e7eb"}`,
                        background: form.type === value ? color + "10" : "#fff",
                        color: form.type === value ? color : "#6b7280",
                        transition: "all .15s",
                      }}
                    >
                      <input
                        type="radio"
                        name="update_type"
                        value={value}
                        checked={form.type === value}
                        onChange={() => setForm({ ...form, type: value })}
                        style={{ accentColor: color }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowForm(false)} style={btn("ghost")}>إلغاء</button>
            <button
              onClick={handlePublish}
              disabled={saving || uploading}
              style={{ ...btn("primary"), opacity: saving || uploading ? 0.7 : 1 }}
            >
              {saving ? "جارٍ النشر…" : "نشر التحديث"}
            </button>
          </div>
        </div>
      )}

      {/* ── Updates Table ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          سجل التحديثات
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
          {updates.length} تحديث — تحديث واحد فقط يكون نشطاً في نفس الوقت
        </div>

        {updates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#d1d5db", fontSize: 14 }}>
            لا توجد تحديثات بعد — أضف أول تحديث من الأعلى
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 90px 90px 52px 80px",
              gap: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#9ca3af",
              borderBottom: "2px solid #f3f4f6",
            }}>
              <span>الإصدار</span>
              <span>التحديث</span>
              <span>النوع</span>
              <span>التاريخ</span>
              <span style={{ textAlign: "center" }}>نشط</span>
              <span></span>
            </div>

            {updates.map((update) => (
              <div
                key={update.id}
                className="update-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 90px 90px 52px 80px",
                  gap: 10,
                  alignItems: "center",
                  padding: "14px 12px",
                  borderBottom: "1px solid #f9fafb",
                  borderRadius: 8,
                  transition: "background .15s",
                }}
              >
                {/* Version */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "#7c3aed",
                  background: "#f5f3ff", padding: "3px 8px",
                  borderRadius: 6, textAlign: "center", width: "fit-content",
                }}>
                  {update.version}
                </div>

                {/* Title + message */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 2 }}>
                    {update.title}
                  </div>
                  {update.message && (
                    <div style={{
                      fontSize: 12, color: "#9ca3af",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {update.message}
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <div>
                  <Badge color={update.type === "forced" ? "red" : "blue"}>
                    {update.type === "forced" ? "إجباري" : "اختياري"}
                  </Badge>
                </div>

                {/* Date */}
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {formatDate(update.created_at)}
                </div>

                {/* Toggle */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Toggle
                    checked={update.is_active}
                    onChange={() => handleToggle(update)}
                    disabled={togglingId === update.id}
                  />
                </div>

                {/* Delete */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setConfirmDelete(update.id)}
                    style={{ ...btn("danger"), padding: "6px 12px", fontSize: 13 }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Confirm Delete Dialog ── */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ ...card, maxWidth: 380, margin: 0, animation: "fadeIn .2s ease" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>حذف التحديث؟</div>
            <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              سيتم حذف الإصدار{" "}
              <strong style={{ color: "#7c3aed" }}>{updateToDelete?.version}</strong>{" "}
              ("{updateToDelete?.title}") نهائياً.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btn("ghost")}>إلغاء</button>
              <button onClick={() => handleDelete(confirmDelete)} style={btn("danger")}>حذف</button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  );
}
