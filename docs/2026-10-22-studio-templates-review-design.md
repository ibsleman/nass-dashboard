# تصميم المرحلة 6 (أ): مراجعة ونشر قوالب الاستوديو من الداش بورد

التاريخ: 2026-10-22 · مستودع `ibsleman/nass-dashboard` (فرع `main`) · مصادق من المستخدم.
المرجع: `Nass/docs/superpowers/plans/2026-10-14-nass-infrastructure-plan.md` (6.1 + 6.2).

## الهدف
المشرف يراجع مسودات المصممين وينشرها ويرجع لنسخة سابقة من الداش بورد بلا فتح الاستوديو.

## القرارات
- صفحة واحدة «قوالب الاستوديو» (`__studio__` في `Sidebar`) بتبويبات: مسودات / منشور / مؤرشف.
- بطاقة لكل قالب: المصغّرة (`thumbnail_url` أو مصغّرة آخر نسخة)، الاسم، القسم، مجاني/مدفوع، عدد النسخ، تاريخ آخر نسخة.
- نافذة المراجعة: مصغّرة كبيرة + صور فحص الأسماء (`stress_test_urls`) للنسخة المختارة + قائمة النسخ (الأحدث أولاً، النسخة الحية معلّمة).
- النموذج: `name_ar`، `category_id` (مناسبات الرئيسية الـ11 — نفس قائمة `Sidebar.CATEGORIES`)، `occasion`، `is_premium`، `sort_order`، `publish_from`، `publish_until`.
- الأفعال: **نشر هذه النسخة** (`status='published'`, `current_version=<المختارة>`, `thumbnail_url` من `thumb.jpg` بجانب حزمة النسخة) · **أرشفة** (`status='archived'`) · **إرجاع لمسودة** (`status='draft'`). الحفظ يكتب الحقول الوصفية مع الفعل.
- الجدولة الموسمية في هذه الجولة (حقلا التاريخ، اختياريان).
- الوصول عبر جلسة المشرف الحالية وسياسات `admin_write_*` القائمة. لا تغيير على الخادم.
- الشكل: نفس أسلوب الصفحات الحالية (Tailwind، RTL، Cairo، brand).

## الوحدات
- `src/lib/studioTemplates.js`: قراءة/كتابة + دوال نقية: `thumbnailFor(template, version)`, `latestVersion(template)`, `publishPatch(form, version)`, `validatePublish(template, version, form)`.
- `src/pages/StudioTemplatesPage.jsx`: القائمة + النافذة.
- `src/lib/studioTemplates.test.js` (vitest).

## خارج النطاق
حذف القوالب، تعديل الطبقات، الخطوط والعناصر، الإحصائيات.
