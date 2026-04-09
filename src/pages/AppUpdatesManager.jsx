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
  update_type: "optional",
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
        update_type: form.update_type,
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
    background: "#0f0f1a",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 16,
    padding: "20px 24px",
    marginBottom: 16,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
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
        .update-row:hover{background:rgba(124,58,237,0.06)!important}
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
        <div style={{
          background: "#0f0f1a",
          border: "1px solid rgba(124,58,237,0.4)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 24,
          animation: "fadeIn .2s ease",
          boxShadow: "0 0 0 1px rgba(124,58,237,0.15), 0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#fff" }}>نشر تحديث جديد</div>
          <div style={{ display: "grid", gap: 16 }}>

            {/* Version + Title */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: "#a0a0b0", fontWeight: 500, marginBottom: 7, display: "block" }}>رقم الإصدار *</label>
                <input
                  style={{
                    width: "100%", padding: "10px 13px",
                    background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, fontSize: 14, outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                    color: "#fff", transition: "border-color .15s",
                  }}
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0.0"
                  onFocus={(e) => e.target.style.borderColor = "rgba(124,58,237,0.6)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#a0a0b0", fontWeight: 500, marginBottom: 7, display: "block" }}>عنوان التحديث *</label>
                <input
                  style={{
                    width: "100%", padding: "10px 13px",
                    background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, fontSize: 14, outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                    color: "#fff", transition: "border-color .15s",
                  }}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="ما الجديد في هذا الإصدار؟"
                  onFocus={(e) => e.target.style.borderColor = "rgba(124,58,237,0.6)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label style={{ fontSize: 13, color: "#a0a0b0", fontWeight: 500, marginBottom: 7, display: "block" }}>رسالة / وصف</label>
              <textarea
                style={{
                  width: "100%", padding: "10px 13px", minHeight: 90, resize: "vertical", lineHeight: 1.6,
                  background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, fontSize: 14, outline: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                  color: "#fff", transition: "border-color .15s",
                }}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="اكتب تفاصيل التحديث هنا…"
                onFocus={(e) => e.target.style.borderColor = "rgba(124,58,237,0.6)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>

            {/* Image + Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Image upload */}
              <div>
                <label style={{ fontSize: 13, color: "#a0a0b0", fontWeight: 500, marginBottom: 7, display: "block" }}>صورة التحديث (اختياري)</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />
                <div
                  onClick={() => !uploading && imageInputRef.current?.click()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 16px", borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer",
                    border: "1px dashed rgba(124,58,237,0.5)",
                    background: form.image_url ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
                    color: form.image_url ? "#a78bfa" : "#a0a0b0",
                    fontSize: 13, fontWeight: 500, transition: "all .15s",
                  }}
                >
                  {uploading ? (
                    <span>جارٍ الرفع…</span>
                  ) : form.image_url ? (
                    <span>✓ تم رفع الصورة</span>
                  ) : (
                    <span>اختر صورة للرفع</span>
                  )}
                </div>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="preview"
                    style={{ marginTop: 8, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(124,58,237,0.3)" }}
                  />
                )}
              </div>

              {/* Type */}
              <div>
                <label style={{ fontSize: 13, color: "#a0a0b0", fontWeight: 500, marginBottom: 7, display: "block" }}>نوع التحديث</label>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {[
                    { value: "optional", label: "اختياري", activeColor: "#7c3aed", activeBg: "rgba(124,58,237,0.15)" },
                    { value: "forced",   label: "إجباري",   activeColor: "#ef4444", activeBg: "rgba(239,68,68,0.12)" },
                  ].map(({ value, label, activeColor, activeBg }) => {
                    const isSelected = form.update_type === value;
                    return (
                      <label
                        key={value}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                          padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                          border: `2px solid ${isSelected ? activeColor : "rgba(255,255,255,0.1)"}`,
                          background: isSelected ? activeBg : "rgba(255,255,255,0.03)",
                          color: isSelected ? activeColor : "#6b7280",
                          transition: "all .15s", flex: 1, justifyContent: "center",
                        }}
                      >
                        <input
                          type="radio"
                          name="update_type"
                          value={value}
                          checked={isSelected}
                          onChange={() => setForm({ ...form, update_type: value })}
                          style={{ accentColor: activeColor, width: 15, height: 15 }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "9px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                color: "#a0a0b0", transition: "all .15s",
              }}
            >
              إلغاء
            </button>
            <button
              onClick={handlePublish}
              disabled={saving || uploading}
              style={{
                padding: "9px 22px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: saving || uploading ? "not-allowed" : "pointer",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                border: "none", color: "#fff",
                opacity: saving || uploading ? 0.65 : 1,
                boxShadow: saving || uploading ? "none" : "0 4px 14px rgba(124,58,237,0.4)",
                transition: "all .15s",
              }}
            >
              {saving ? "جارٍ النشر…" : "نشر التحديث"}
            </button>
          </div>
        </div>
      )}

      {/* ── Updates Table ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#fff" }}>
          سجل التحديثات
        </div>
        <div style={{ fontSize: 13, color: "#6b6b8a", marginBottom: 16 }}>
          {updates.length} تحديث — تحديث واحد فقط يكون نشطاً في نفس الوقت
        </div>

        {updates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#3d3d5c", fontSize: 14 }}>
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
              color: "#6b6b8a",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
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
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  transition: "background .15s",
                }}
              >
                {/* Version */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "#a78bfa",
                  background: "rgba(124,58,237,0.18)", padding: "3px 8px",
                  borderRadius: 6, textAlign: "center", width: "fit-content",
                }}>
                  {update.version}
                </div>

                {/* Title + message */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#e5e7eb", marginBottom: 2 }}>
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
                  <Badge color={update.update_type === "forced" ? "red" : "blue"}>
                    {update.update_type === "forced" ? "إجباري" : "اختياري"}
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
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#fff" }}>حذف التحديث؟</div>
            <div style={{ color: "#a0a0b0", fontSize: 14, marginBottom: 20 }}>
              سيتم حذف الإصدار{" "}
              <strong style={{ color: "#a78bfa" }}>{updateToDelete?.version}</strong>{" "}
              ("{updateToDelete?.title}") نهائياً.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
                  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#a0a0b0",
                }}
              >
                إلغاء
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={btn("danger")}>حذف</button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  );
}
