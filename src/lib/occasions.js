// المناسبات الـ11 بترتيب الرئيسية في التطبيق (Category.swift) — بلا إيموجي: صورة قالب حقيقي تمثّل كل مناسبة
export const OCCASIONS = [
  { key: 'ramadan', label: 'رمضان' },
  { key: 'eidAlFitr', label: 'عيد الفطر' },
  { key: 'eidAlAdha', label: 'عيد الأضحى' },
  { key: 'engagement', label: 'خطوبة' },
  { key: 'marriage', label: 'زواج' },
  { key: 'newborn', label: 'مولود' },
  { key: 'graduation', label: 'تخرج' },
  { key: 'birthday', label: 'عيد ميلاد' },
  { key: 'invitations', label: 'دعوات' },
  { key: 'promotion', label: 'ترقية وتكريم' },
  { key: 'condolences', label: 'تعزية' },
]

export const OCCASION_KEYS = OCCASIONS.map((o) => o.key)
export const OCCASION_LABEL = Object.fromEntries(OCCASIONS.map((o) => [o.key, o.label]))
