import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const CATEGORY_LABELS = {
  ramadan: "رمضان",
  eidAlFitr: "عيد الفطر",
  eidAlAdha: "عيد الأضحى",
  engagement: "خطوبة",
  marriage: "زواج",
  newborn: "مولود",
  graduation: "تخرج",
  birthday: "عيد ميلاد",
  invitations: "دعوات",
  promotion: "ترقية وتكريم",
  condolences: "تعزية",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });
    if (data) setCategories(data);
  }

  function moveUp(index) {
    if (index === 0) return;
    const updated = [...categories];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setCategories(updated.map((c, i) => ({ ...c, display_order: i + 1 })));
  }

  function moveDown(index) {
    if (index === categories.length - 1) return;
    const updated = [...categories];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setCategories(updated.map((c, i) => ({ ...c, display_order: i + 1 })));
  }

  function toggleActive(index) {
    const updated = [...categories];
    updated[index] = { ...updated[index], is_active: !updated[index].is_active };
    setCategories(updated);
  }

  async function saveChanges() {
    setSaving(true);
    setMessage("");
    for (const cat of categories) {
      await supabase
        .from("categories")
        .update({ display_order: cat.display_order, is_active: cat.is_active })
        .eq("id", cat.id);
    }
    setSaving(false);
    setMessage("تم الحفظ ✓");
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>ترتيب الأقسام</h2>
        <button
          onClick={saveChanges}
          disabled={saving}
          style={{
            background: saving ? "#ccc" : "#4F46E5",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 20px",
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontSize: "14px",
          }}
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      {message && (
        <div style={{ background: "#0d2e1f", color: "#34d399", padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", textAlign: "center" }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {categories.map((cat, index) => (
          <div
            key={cat.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: cat.is_active ? "#1e2130" : "#161822",
              border: "1px solid #2e3148",
              borderRadius: "10px",
              padding: "12px 16px",
              opacity: cat.is_active ? 1 : 0.5,
            }}
          >
            <span style={{ color: "#6b7280", fontWeight: "600", width: "24px", textAlign: "center" }}>
              {index + 1}
            </span>

            <span style={{ flex: 1, fontWeight: "600", fontSize: "15px", color: "#e2e8f0" }}>
              {CATEGORY_LABELS[cat.key] || cat.name_ar}
            </span>

            <button
              onClick={() => toggleActive(index)}
              style={{
                background: cat.is_active ? "#0d2e1f" : "#2d1515",
                color: cat.is_active ? "#34d399" : "#f87171",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "inherit",
              }}
            >
              {cat.is_active ? "ظاهر" : "مخفي"}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                style={{
                  background: "#2e3148",
                  border: "1px solid #3d4166",
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  color: "#9ca3af",
                  cursor: index === 0 ? "not-allowed" : "pointer",
                  opacity: index === 0 ? 0.3 : 1,
                  fontSize: "12px",
                }}
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === categories.length - 1}
                style={{
                  background: "#2e3148",
                  border: "1px solid #3d4166",
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  color: "#9ca3af",
                  cursor: index === categories.length - 1 ? "not-allowed" : "pointer",
                  opacity: index === categories.length - 1 ? 0.3 : 1,
                  fontSize: "12px",
                }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
