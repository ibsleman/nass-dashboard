import { useState, useEffect, useRef } from "react";
import { supabase, supabaseAdmin } from "../lib/supabase";

// ── helpers ──────────────────────────────────────────────────────
const EMPTY_AD = {
  title: "",
  image_url: "",
  video_url: "",
  contact_label: "تواصل معنا",
  contact_button_url: "",
  view_label: "مشاهدة",
  watch_button_url: "",
  countdown_secs: 5,
  show_on_select: true,
  show_on_save: true,
  show_on_share: true,
  priority: 0,
  is_active: false,
  start_date: "",
  end_date: "",
};

async function uploadMedia(file, type) {
  const ext = file.name.split(".").pop();
  const path = `${type}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("ads")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from("ads").getPublicUrl(path);
  return data.publicUrl.replace('https://dlecapxnppfmpokoitek.supabase.co', 'https://cdn.ibsleman.com');
}

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
    green: { bg: "#dcfce7", text: "#15803d" },
    red: { bg: "#fee2e2", text: "#b91c1c" },
    gray: { bg: "#f3f4f6", text: "#6b7280" },
    blue: { bg: "#dbeafe", text: "#1d4ed8" },
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
        animation: "fadeIn .2s ease",
      }}
    >
      {msg}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────
export default function AdsManager() {
  const [settings, setSettings] = useState(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [conflictWarning, setConflictWarning] = useState("");
  const [imageMode, setImageMode] = useState("url"); // "url" | "upload"
  const [videoMode, setVideoMode] = useState("url");
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

  // ── fetch ───────────────────────────────────────────────────────
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

  // ── save settings (with conflict prevention) ────────────────────
  async function saveSettings(patch) {
    let finalPatch = { ...patch };
    let warned = false;

    // Conflict: enabling a custom event → disable the matching google event
    const customToGoogle = {
      custom_select_enabled: "google_select_enabled",
      custom_save_enabled: "google_save_enabled",
      custom_share_enabled: "google_share_enabled",
    };
    // Conflict: enabling a google event → disable the matching custom event
    const googleToCustom = {
      google_select_enabled: "custom_select_enabled",
      google_save_enabled: "custom_save_enabled",
      google_share_enabled: "custom_share_enabled",
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
    const { error } = await supabaseAdmin
      .from("ads_settings")
      .update(finalPatch)
      .eq("id", 1);
    if (error) showToast("خطأ في الحفظ", "error");
    else showToast("تم الحفظ");
  }

  // ── save ad (insert or update) ──────────────────────────────────
  async function saveAd() {
    if (!editingAd.title.trim()) { showToast("اكتب عنوان الإعلان", "error"); return; }
    setSaving(true);
    const payload = { ...editingAd };
    if (!payload.start_date) payload.start_date = null;
    if (!payload.end_date) payload.end_date = null;
    if (!payload.image_url) payload.image_url = null;
    if (!payload.video_url) payload.video_url = null;
    if (!payload.contact_button_url) payload.contact_button_url = null;
    if (!payload.watch_button_url) payload.watch_button_url = null;

    let error;
    if (payload.id) {
      ({ error } = await supabaseAdmin.from("custom_ads").update(payload).eq("id", payload.id));
    } else {
      delete payload.id;
      ({ error } = await supabaseAdmin.from("custom_ads").insert(payload));
    }
    setSaving(false);
    if (error) { showToast("خطأ في الحفظ: " + error.message, "error"); return; }
    showToast(payload.id ? "تم التعديل" : "تم الإضافة");
    setEditingAd(null);
    fetchAll();
  }

  async function toggleAd(ad) {
    const { error } = await supabaseAdmin
      .from("custom_ads")
      .update({ is_active: !ad.is_active })
      .eq("id", ad.id);
    if (!error) setAds(ads.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
    else showToast("خطأ", "error");
  }

  async function deleteAd(id) {
    const { error } = await supabaseAdmin.from("custom_ads").delete().eq("id", id);
    if (!error) { setAds(ads.filter(a => a.id !== id)); showToast("تم الحذف"); }
    else showToast("خطأ في الحذف", "error");
    setConfirmDelete(null);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadMedia(file, "images");
      setEditingAd(prev => ({ ...prev, image_url: url }));
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
      setEditingAd(prev => ({ ...prev, video_url: url }));
    } catch (err) {
      showToast("فشل رفع الفيديو: " + err.message, "error");
    } finally {
      setUploadingVideo(false);
    }
  }

  // ── styles ──────────────────────────────────────────────────────
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

  const label = { fontSize: 14, color: "#374151", fontWeight: 500 };
  const sublabel = { fontSize: 12, color: "#9ca3af", marginTop: 2 };

  const inp = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const btn = (variant = "primary") => ({
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background: variant === "primary" ? "#1d4ed8" : variant === "danger" ? "#ef4444" : "#f3f4f6",
    color: variant === "ghost" ? "#374151" : "#fff",
  });

  const tabBtn = (active) => ({
    padding: "5px 14px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    background: active ? "#1d4ed8" : "#f3f4f6",
    color: active ? "#fff" : "#6b7280",
    transition: "background .15s",
  });

  if (loading) return (
    <div style={{ textAlign: "center", padding: 80, color: "#9ca3af" }}>
      جارٍ التحميل…
    </div>
  );

  // ── ad form modal ───────────────────────────────────────────────
  if (editingAd) return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", direction: "rtl" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ ...card, animation: "fadeIn .2s ease" }}>
        <div style={{ ...row, marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {editingAd.id ? "تعديل إعلان" : "إعلان جديد"}
          </h2>
          <button onClick={() => setEditingAd(null)} style={{ ...btn("ghost"), padding: "6px 14px" }}>
            إلغاء
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {/* Title */}
          <div>
            <div style={label}>العنوان *</div>
            <input style={inp} value={editingAd.title}
              onChange={e => setEditingAd({ ...editingAd, title: e.target.value })}
              placeholder="عنوان الإعلان" />
          </div>

          {/* Image */}
          <div>
            <div style={{ ...row, marginBottom: 8, justifyContent: "flex-start", gap: 8 }}>
              <span style={label}>صورة الإعلان</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={tabBtn(imageMode === "url")} onClick={() => setImageMode("url")}>رابط URL</button>
                <button style={tabBtn(imageMode === "upload")} onClick={() => setImageMode("upload")}>رفع من الجهاز</button>
              </div>
            </div>
            {imageMode === "url" ? (
              <input style={inp} value={editingAd.image_url || ""}
                onChange={e => setEditingAd({ ...editingAd, image_url: e.target.value })}
                placeholder="https://…" />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />
                <button
                  style={{ ...btn("ghost"), padding: "8px 16px" }}
                  disabled={uploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImage ? "جارٍ الرفع…" : "اختر صورة"}
                </button>
                {editingAd.image_url && (
                  <span style={{ fontSize: 12, color: "#16a34a", wordBreak: "break-all" }}>
                    ✓ تم رفع الصورة
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Video */}
          <div>
            <div style={{ ...row, marginBottom: 8, justifyContent: "flex-start", gap: 8 }}>
              <span style={label}>فيديو الإعلان</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={tabBtn(videoMode === "url")} onClick={() => setVideoMode("url")}>رابط URL</button>
                <button style={tabBtn(videoMode === "upload")} onClick={() => setVideoMode("upload")}>رفع من الجهاز</button>
              </div>
            </div>
            {videoMode === "url" ? (
              <input style={inp} value={editingAd.video_url || ""}
                onChange={e => setEditingAd({ ...editingAd, video_url: e.target.value })}
                placeholder="https://…" />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={handleVideoUpload}
                />
                <button
                  style={{ ...btn("ghost"), padding: "8px 16px" }}
                  disabled={uploadingVideo}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {uploadingVideo ? "جارٍ الرفع…" : "اختر فيديو"}
                </button>
                {editingAd.video_url && (
                  <span style={{ fontSize: 12, color: "#16a34a", wordBreak: "break-all" }}>
                    ✓ تم رفع الفيديو
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Contact button */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={label}>نص زر التواصل</div>
              <input style={inp} value={editingAd.contact_label}
                onChange={e => setEditingAd({ ...editingAd, contact_label: e.target.value })} />
            </div>
            <div>
              <div style={label}>رابط زر التواصل</div>
              <input style={inp} value={editingAd.contact_button_url || ""}
                onChange={e => setEditingAd({ ...editingAd, contact_button_url: e.target.value })}
                placeholder="واتساب / إيميل / انستغرام / أي رابط" />
            </div>
          </div>

          {/* Watch button */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={label}>نص زر المشاهدة</div>
              <input style={inp} value={editingAd.view_label}
                onChange={e => setEditingAd({ ...editingAd, view_label: e.target.value })} />
            </div>
            <div>
              <div style={label}>رابط زر المشاهدة</div>
              <input style={inp} value={editingAd.watch_button_url || ""}
                onChange={e => setEditingAd({ ...editingAd, watch_button_url: e.target.value })}
                placeholder="يوتيوب / تيك توك / أي رابط" />
            </div>
          </div>

          {/* Countdown / Priority / Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={label}>عد تنازلي (ثوانٍ)</div>
              <input style={inp} type="number" min={0} max={30} value={editingAd.countdown_secs}
                onChange={e => setEditingAd({ ...editingAd, countdown_secs: +e.target.value })} />
            </div>
            <div>
              <div style={label}>الأولوية (رقم أعلى = أهم)</div>
              <input style={inp} type="number" value={editingAd.priority}
                onChange={e => setEditingAd({ ...editingAd, priority: +e.target.value })} />
            </div>
            <div>
              <div style={label}>الحالة</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <Toggle checked={editingAd.is_active}
                  onChange={v => setEditingAd({ ...editingAd, is_active: v })} />
                <span style={{ fontSize: 13, color: editingAd.is_active ? "#16a34a" : "#9ca3af" }}>
                  {editingAd.is_active ? "نشط" : "موقوف"}
                </span>
              </div>
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={label}>تاريخ البداية (اختياري)</div>
              <input style={inp} type="date" value={editingAd.start_date || ""}
                onChange={e => setEditingAd({ ...editingAd, start_date: e.target.value })} />
            </div>
            <div>
              <div style={label}>تاريخ النهاية (اختياري)</div>
              <input style={inp} type="date" value={editingAd.end_date || ""}
                onChange={e => setEditingAd({ ...editingAd, end_date: e.target.value })} />
            </div>
          </div>

          {/* Show on */}
          <div>
            <div style={{ ...label, marginBottom: 10 }}>يظهر في</div>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { key: "show_on_select", label: "عند اختيار قالب" },
                { key: "show_on_save",   label: "عند الحفظ" },
                { key: "show_on_share",  label: "عند المشاركة" },
              ].map(({ key, label: l }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={editingAd[key]}
                    onChange={e => setEditingAd({ ...editingAd, [key]: e.target.checked })} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...row, marginTop: 24, justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => setEditingAd(null)} style={btn("ghost")}>إلغاء</button>
          <button onClick={saveAd} disabled={saving || uploadingImage || uploadingVideo} style={btn("primary")}>
            {saving ? "جارٍ الحفظ…" : "حفظ الإعلان"}
          </button>
        </div>
      </div>
      <Toast {...toast} />
    </div>
  );

  // ── confirm delete modal ────────────────────────────────────────
  const adToDelete = confirmDelete ? ads.find(a => a.id === confirmDelete) : null;

  // ── main view ───────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px", direction: "rtl" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ad-row:hover{background:#f9fafb!important}
      `}</style>

      <div style={{ ...row, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>إدارة الإعلانات</h1>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
            تحكم في إعلانات جوجل والإعلانات المخصصة
          </div>
        </div>
        <button onClick={() => { setImageMode("url"); setVideoMode("url"); setEditingAd({ ...EMPTY_AD }); }} style={btn("primary")}>
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
              <div style={label}>{l}</div>
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
              <div style={label}>{l}</div>
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
          {ads.length} إعلان — مرتبة حسب الأولوية
        </div>

        {ads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#d1d5db" }}>
            لا توجد إعلانات مخصصة بعد — أضف إعلاناً جديداً
          </div>
        ) : ads.map(ad => {
          const isExpired = ad.end_date && new Date(ad.end_date) < new Date();
          const isScheduled = ad.start_date && new Date(ad.start_date) > new Date();
          return (
            <div
              key={ad.id}
              className="ad-row"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 10px",
                borderBottom: "1px solid #f3f4f6",
                borderRadius: 8,
                transition: "background .15s",
                cursor: "default",
              }}
            >
              {/* Priority badge */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#f3f4f6", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#6b7280",
                flexShrink: 0,
              }}>
                {ad.priority}
              </div>

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

              {/* Toggle */}
              <Toggle checked={ad.is_active} onChange={() => toggleAd(ad)} />

              {/* Actions */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setImageMode("url"); setVideoMode("url"); setEditingAd({ ...ad }); }}
                  style={{ ...btn("ghost"), padding: "6px 12px", fontSize: 13 }}
                >
                  تعديل
                </button>
                <button
                  onClick={() => setConfirmDelete(ad.id)}
                  style={{ ...btn("danger"), padding: "6px 12px", fontSize: 13 }}
                >
                  حذف
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
              <button onClick={() => setConfirmDelete(null)} style={btn("ghost")}>إلغاء</button>
              <button onClick={() => deleteAd(confirmDelete)} style={btn("danger")}>حذف</button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  );
}
