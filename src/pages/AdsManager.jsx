import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getCdnUrl } from "../lib/cdn";

// ── helpers ──────────────────────────────────────────────────────
const EMPTY_AD = {
  title: "",
  image_url: "",
  video_url: "",
  contact_label: "",
  contact_button_url: "",
  view_label: "",
  watch_button_url: "",
  countdown_secs: 5,
  show_on_select: true,
  show_on_save: true,
  show_on_share: true,
  is_active: false,
  start_date: "",
  end_date: "",
};

async function uploadMedia(file, type) {
  const ext = file.name.split(".").pop();
  const path = `${type}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("ads")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("ads").getPublicUrl(path);
  return getCdnUrl(data.publicUrl);
}

// ── Toggle ───────────────────────────────────────────────────────
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

// ── Badge ────────────────────────────────────────────────────────
function Badge({ children, color = "gray" }) {
  const colors = {
    green: { bg: "#dcfce7", text: "#15803d" },
    red:   { bg: "#fee2e2", text: "#b91c1c" },
    gray:  { bg: "#f3f4f6", text: "#6b7280" },
    blue:  { bg: "#dbeafe", text: "#1d4ed8" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
      }}
    >
      {children}
    </span>
  );
}

// ── Toast ────────────────────────────────────────────────────────
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
        boxShadow: "0 4px 20px rgba(0,0,0,.2)",
      }}
    >
      {msg}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────
export default function AdsManager() {
  const [settings, setSettings]         = useState(null);
  const [ads, setAds]                   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [editingAd, setEditingAd]       = useState(null);
  const [toast, setToast]               = useState({ msg: "", type: "ok" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [conflictWarning, setConflictWarning] = useState("");

  // Media upload state
  const [imageMode, setImageMode]         = useState("url");
  const [videoMode, setVideoMode]         = useState("url");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3000);
  }

  function showConflictWarning(msg) {
    setConflictWarning(msg);
    setTimeout(() => setConflictWarning(""), 4000);
  }

  // ── fetch ─────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("ads_settings").select("*").single(),
      supabase.from("custom_ads").select("*").order("priority", { ascending: false }),
    ]);
    if (s) setSettings(s);
    if (a) setAds(a);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  // ── save settings (with conflict prevention) ──────────────────
  async function saveSettings(patch) {
    let finalPatch = { ...patch };
    let warned = false;

    const customToGoogle = {
      custom_select_enabled: "google_select_enabled",
      custom_save_enabled:   "google_save_enabled",
      custom_share_enabled:  "google_share_enabled",
    };
    const googleToCustom = {
      google_select_enabled: "custom_select_enabled",
      google_save_enabled:   "custom_save_enabled",
      google_share_enabled:  "custom_share_enabled",
    };

    for (const [key, val] of Object.entries(patch)) {
      if (val === true) {
        const opposite = customToGoogle[key] || googleToCustom[key];
        if (opposite && settings?.[opposite]) {
          finalPatch[opposite] = false;
          if (!warned) {
            showConflictWarning("تم إيقاف نفس الحدث في إعلانات جوجل تلقائياً لتجنب التضارب.");
            warned = true;
          }
        }
      }
    }

    const next = { ...settings, ...finalPatch };
    setSettings(next);
    const { error } = await supabase
      .from("ads_settings")
      .update(finalPatch)
      .eq("id", 1);
    if (error) showToast("خطأ في الحفظ", "error");
    else showToast("تم الحفظ");
  }

  // ── save ad (insert or update) ────────────────────────────────
  async function saveAd() {
    if (!editingAd.title.trim()) {
      showToast("اكتب عنوان الإعلان", "error");
      return;
    }
    if (!editingAd.image_url && !editingAd.video_url) {
      showToast("أضف صورة أو فيديو للإعلان", "error");
      return;
    }
    if (editingAd.contact_label?.trim() && !editingAd.contact_button_url?.trim()) {
      showToast("أضف رابط زر التواصل", "error");
      return;
    }
    if (editingAd.view_label?.trim() && !editingAd.watch_button_url?.trim()) {
      showToast("أضف رابط زر المشاهدة", "error");
      return;
    }

    setSaving(true);
    const payload = { ...editingAd };
    if (!payload.start_date)        payload.start_date        = null;
    if (!payload.end_date)          payload.end_date          = null;
    if (!payload.image_url)         payload.image_url         = null;
    if (!payload.video_url)         payload.video_url         = null;
    if (!payload.contact_button_url) payload.contact_button_url = null;
    if (!payload.watch_button_url)  payload.watch_button_url  = null;
    if (!payload.contact_label)     payload.contact_label     = null;
    if (!payload.view_label)        payload.view_label        = null;

    let error;
    if (payload.id) {
      ({ error } = await supabase.from("custom_ads").update(payload).eq("id", payload.id));
    } else {
      delete payload.id;
      ({ error } = await supabase.from("custom_ads").insert(payload));
    }
    setSaving(false);
    if (error) { showToast("خطأ في الحفظ: " + error.message, "error"); return; }
    showToast(payload.id ? "تم التعديل" : "تم الإضافة");
    setEditingAd(null);
    fetchAll();
  }

  async function toggleAd(ad) {
    const { error } = await supabase
      .from("custom_ads")
      .update({ is_active: !ad.is_active })
      .eq("id", ad.id);
    if (!error) setAds(ads.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
    else showToast("خطأ", "error");
  }

  async function deleteAd(id) {
    const { error } = await supabase.from("custom_ads").delete().eq("id", id);
    if (!error) { setAds(ads.filter(a => a.id !== id)); showToast("تم الحذف"); }
    else showToast("خطأ في الحذف", "error");
    setConfirmDelete(null);
  }

  // ── media handlers ────────────────────────────────────────────
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadMedia(file, "images");
      setEditingAd(prev => ({ ...prev, image_url: url, video_url: "" }));
    } catch (err) {
      showToast("فشل رفع الصورة: " + err.message, "error");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadMedia(file, "videos");
      setEditingAd(prev => ({ ...prev, video_url: url, image_url: "" }));
    } catch (err) {
      showToast("فشل رفع الفيديو: " + err.message, "error");
    } finally {
      setUploadingVideo(false);
    }
  }

  function clearImage() {
    setEditingAd(prev => ({ ...prev, image_url: "" }));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function clearVideo() {
    setEditingAd(prev => ({ ...prev, video_url: "" }));
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function openNewAd() {
    setImageMode("url");
    setVideoMode("url");
    setEditingAd({ ...EMPTY_AD });
  }

  function openEditAd(ad) {
    setImageMode("url");
    setVideoMode("url");
    setEditingAd({ ...ad });
  }

  // ── inline styles for main view ───────────────────────────────
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

  const labelStyle  = { fontSize: 14, color: "#374151", fontWeight: 500 };
  const sublabel    = { fontSize: 12, color: "#9ca3af", marginTop: 2 };

  const btnStyle = (variant = "primary") => ({
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background: variant === "primary" ? "#1d4ed8" : variant === "danger" ? "#ef4444" : "#f3f4f6",
    color: variant === "ghost" ? "#374151" : "#fff",
  });

  if (loading) return (
    <div style={{ textAlign: "center", padding: 80, color: "#9ca3af" }}>
      جارٍ التحميل…
    </div>
  );

  // Mutual exclusion: disable a section only when the OTHER side is set and THIS side is empty
  const hasImage     = !!editingAd?.image_url;
  const hasVideo     = !!editingAd?.video_url;
  const imageDisabled = hasVideo && !hasImage;
  const videoDisabled = hasImage && !hasVideo;

  const adToDelete = confirmDelete ? ads.find(a => a.id === confirmDelete) : null;

  // Tailwind classes matching TemplateModal
  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm";
  const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2";

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px", direction: "rtl" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ad-row:hover{background:#f9fafb!important}
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ ...row, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>إدارة الإعلانات</h1>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
            تحكم في إعلانات جوجل والإعلانات المخصصة
          </div>
        </div>
        <button onClick={openNewAd} style={btnStyle("primary")}>
          + إعلان جديد
        </button>
      </div>

      {/* Conflict warning */}
      {conflictWarning && (
        <div style={{
          padding: "10px 16px",
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          fontSize: 13,
          color: "#92400e",
          marginBottom: 16,
          animation: "fadeIn .2s ease",
        }}>
          ⚠️ {conflictWarning}
        </div>
      )}

      {/* ── Google Ads Settings ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          إعلانات جوجل AdMob
        </div>
        {[
          { key: "google_select_enabled", label: "عند اختيار قالب", sub: "إعلان يظهر عند الضغط على أي قالب" },
          { key: "google_save_enabled",   label: "عند الحفظ",        sub: "إعلان يظهر عند حفظ قالب" },
          { key: "google_share_enabled",  label: "عند المشاركة",     sub: "إعلان يظهر عند مشاركة قالب" },
        ].map(({ key, label: l, sub }) => (
          <div key={key} style={{ ...row, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={labelStyle}>{l}</div>
              <div style={sublabel}>{sub}</div>
            </div>
            <Toggle
              checked={settings?.[key] ?? true}
              onChange={v => saveSettings({ [key]: v })}
            />
          </div>
        ))}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, fontSize: 13, color: "#15803d" }}>
          ملاحظة: عند تفعيل الإعلانات المخصصة، تأخذ الأولوية على إعلانات جوجل في نفس الموضع.
        </div>
      </div>

      {/* ── Custom Ads Master Switch ── */}
      <div style={{ ...card, ...row }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>الإعلانات المخصصة</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
            تفعيل هذا الخيار يعرض إعلاناتك بدلاً من إعلانات جوجل
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge color={settings?.custom_ads_enabled ? "green" : "gray"}>
            {settings?.custom_ads_enabled ? "مفعّلة" : "موقوفة"}
          </Badge>
          <Toggle
            checked={settings?.custom_ads_enabled ?? false}
            onChange={v => saveSettings({ custom_ads_enabled: v })}
          />
        </div>
      </div>

      {/* ── Custom Ads Event Toggles ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          مواضع الإعلانات المخصصة
        </div>
        {[
          { key: "custom_select_enabled", label: "عند اختيار قالب", sub: "إعلان مخصص يظهر عند الضغط على أي قالب" },
          { key: "custom_save_enabled",   label: "عند الحفظ",        sub: "إعلان مخصص يظهر عند حفظ قالب" },
          { key: "custom_share_enabled",  label: "عند المشاركة",     sub: "إعلان مخصص يظهر عند مشاركة قالب" },
        ].map(({ key, label: l, sub }) => (
          <div key={key} style={{ ...row, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={labelStyle}>{l}</div>
              <div style={sublabel}>{sub}</div>
            </div>
            <Toggle
              checked={settings?.[key] ?? true}
              onChange={v => saveSettings({ [key]: v })}
            />
          </div>
        ))}
      </div>

      {/* ── Custom Ads List ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          قائمة الإعلانات المخصصة
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
          {ads.length} إعلان
        </div>

        {ads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#d1d5db" }}>
            لا توجد إعلانات مخصصة بعد — أضف إعلاناً جديداً
          </div>
        ) : ads.map(ad => {
          const isExpired   = ad.end_date   && new Date(ad.end_date)   < new Date();
          const isScheduled = ad.start_date && new Date(ad.start_date) > new Date();
          return (
            <div
              key={ad.id}
              className="ad-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 10px",
                borderBottom: "1px solid #f3f4f6",
                borderRadius: 8,
                transition: "background .15s",
                cursor: "default",
              }}
            >
              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "#111827" }}>
                  {ad.title}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {isExpired   && <Badge color="red">منتهي</Badge>}
                  {isScheduled && <Badge color="blue">مجدول</Badge>}
                  {ad.show_on_select && <Badge>اختيار</Badge>}
                  {ad.show_on_save   && <Badge>حفظ</Badge>}
                  {ad.show_on_share  && <Badge>مشاركة</Badge>}
                  {ad.start_date && (
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {ad.start_date} → {ad.end_date || "∞"}
                    </span>
                  )}
                </div>
              </div>

              {/* Active toggle */}
              <Toggle checked={ad.is_active} onChange={() => toggleAd(ad)} />

              {/* Actions */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => openEditAd(ad)}
                  style={{ ...btnStyle("ghost"), padding: "6px 12px", fontSize: 13 }}
                >
                  تعديل
                </button>
                <button
                  onClick={() => setConfirmDelete(ad.id)}
                  style={{ ...btnStyle("danger"), padding: "6px 12px", fontSize: 13 }}
                >
                  حذف
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════ Ad Form Modal — Tailwind dark theme ══════════ */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">

          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !saving && setEditingAd(null)}
          />

          {/* Modal container */}
          <div className="relative w-full sm:max-w-2xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800 overflow-hidden">

            {/* Drag handle — mobile only */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {editingAd.id ? "تعديل إعلان" : "إعلان جديد"}
              </h2>
              <button
                onClick={() => !saving && setEditingAd(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form body */}
            <div
              className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-5"
              style={{ direction: "rtl" }}
            >

              {/* ── العنوان ── */}
              <div>
                <label className={labelCls}>العنوان *</label>
                <input
                  className={inputCls}
                  value={editingAd.title}
                  onChange={e => setEditingAd({ ...editingAd, title: e.target.value })}
                  placeholder="عنوان الإعلان"
                />
              </div>

              {/* ── الوسيط (صورة أو فيديو) ── */}
              <div>
                <label className={labelCls}>الوسيط *</label>

                {/* Image section */}
                <div className={`transition-opacity duration-200 ${imageDisabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">صورة</span>

                    <div className="flex gap-1 mr-auto">
                      <button
                        type="button"
                        onClick={() => setImageMode("url")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          imageMode === "url"
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        رابط
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode("upload")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          imageMode === "upload"
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        رفع
                      </button>
                    </div>

                    {hasImage && (
                      <button
                        type="button"
                        onClick={clearImage}
                        className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        حذف
                      </button>
                    )}
                  </div>

                  {imageMode === "url" ? (
                    <input
                      className={inputCls}
                      value={editingAd.image_url || ""}
                      onChange={e => setEditingAd({
                        ...editingAd,
                        image_url: e.target.value,
                        video_url: e.target.value ? "" : editingAd.video_url,
                      })}
                      placeholder="https://…"
                    />
                  ) : (
                    <>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <div
                        onClick={() => imageInputRef.current?.click()}
                        className={`flex items-center justify-center gap-2 w-full h-16 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                          hasImage
                            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 dark:hover:border-brand-500"
                        }`}
                      >
                        {uploadingImage ? (
                          <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            جارٍ الرفع…
                          </span>
                        ) : hasImage ? (
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ تم رفع الصورة</span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">اضغط لاختيار صورة</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">أو</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {/* Video section */}
                <div className={`transition-opacity duration-200 ${videoDisabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">فيديو</span>

                    <div className="flex gap-1 mr-auto">
                      <button
                        type="button"
                        onClick={() => setVideoMode("url")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          videoMode === "url"
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        رابط
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoMode("upload")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          videoMode === "upload"
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        رفع
                      </button>
                    </div>

                    {hasVideo && (
                      <button
                        type="button"
                        onClick={clearVideo}
                        className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        حذف
                      </button>
                    )}
                  </div>

                  {videoMode === "url" ? (
                    <input
                      className={inputCls}
                      value={editingAd.video_url || ""}
                      onChange={e => setEditingAd({
                        ...editingAd,
                        video_url: e.target.value,
                        image_url: e.target.value ? "" : editingAd.image_url,
                      })}
                      placeholder="https://…"
                    />
                  ) : (
                    <>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleVideoUpload}
                      />
                      <div
                        onClick={() => videoInputRef.current?.click()}
                        className={`flex items-center justify-center gap-2 w-full h-16 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                          hasVideo
                            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 dark:hover:border-brand-500"
                        }`}
                      >
                        {uploadingVideo ? (
                          <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            جارٍ الرفع…
                          </span>
                        ) : hasVideo ? (
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ تم رفع الفيديو</span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">اضغط لاختيار فيديو</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── عد تنازلي ── */}
              <div>
                <label className={labelCls}>عد تنازلي (ثوانٍ)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className={inputCls}
                  value={editingAd.countdown_secs}
                  onChange={e => setEditingAd({ ...editingAd, countdown_secs: +e.target.value })}
                />
              </div>

              {/* ── زر التواصل ── */}
              <div>
                <label className={labelCls}>زر التواصل</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    value={editingAd.contact_label || ""}
                    onChange={e => setEditingAd({ ...editingAd, contact_label: e.target.value })}
                    placeholder="نص الزر — مثال: تواصل معنا"
                  />
                  <input
                    className={inputCls}
                    value={editingAd.contact_button_url || ""}
                    onChange={e => setEditingAd({ ...editingAd, contact_button_url: e.target.value })}
                    placeholder="واتساب / إيميل / أي رابط"
                  />
                </div>
              </div>

              {/* ── زر المشاهدة ── */}
              <div>
                <label className={labelCls}>زر المشاهدة</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    value={editingAd.view_label || ""}
                    onChange={e => setEditingAd({ ...editingAd, view_label: e.target.value })}
                    placeholder="نص الزر — مثال: مشاهدة"
                  />
                  <input
                    className={inputCls}
                    value={editingAd.watch_button_url || ""}
                    onChange={e => setEditingAd({ ...editingAd, watch_button_url: e.target.value })}
                    placeholder="يوتيوب / تيك توك / أي رابط"
                  />
                </div>
              </div>

              {/* ── نطاق التاريخ ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>تاريخ البداية (اختياري)</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={editingAd.start_date || ""}
                    onChange={e => setEditingAd({ ...editingAd, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>تاريخ النهاية (اختياري)</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={editingAd.end_date || ""}
                    onChange={e => setEditingAd({ ...editingAd, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* ── الحالة ── */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAd({ ...editingAd, is_active: !editingAd.is_active })}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    editingAd.is_active ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    editingAd.is_active ? "right-1" : "left-1"
                  }`} />
                </button>
                <span className={`text-sm font-medium ${
                  editingAd.is_active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}>
                  {editingAd.is_active ? "نشط" : "موقوف"}
                </span>
              </div>

              {/* ── يظهر في ── */}
              <div>
                <label className={labelCls}>يظهر في</label>
                <div className="flex gap-5 flex-wrap">
                  {[
                    { key: "show_on_select", label: "عند اختيار قالب" },
                    { key: "show_on_save",   label: "عند الحفظ" },
                    { key: "show_on_share",  label: "عند المشاركة" },
                  ].map(({ key, label: l }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editingAd[key]}
                        onChange={e => setEditingAd({ ...editingAd, [key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-brand-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setEditingAd(null)}
                disabled={saving}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all text-sm disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveAd}
                disabled={saving || uploadingImage || uploadingVideo}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 text-white font-semibold shadow-md hover:from-brand-700 hover:to-brand-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    جارٍ الحفظ…
                  </span>
                ) : (editingAd.id ? "حفظ التعديلات" : "حفظ الإعلان")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Dialog ── */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ ...card, maxWidth: 380, margin: 0, animation: "fadeIn .2s ease" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              حذف الإعلان؟
            </div>
            <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              سيتم حذف "<strong>{adToDelete?.title}</strong>" نهائياً.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnStyle("ghost")}>إلغاء</button>
              <button onClick={() => deleteAd(confirmDelete)} style={btnStyle("danger")}>حذف</button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  );
}
