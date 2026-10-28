// ترتيب الأقسام (داخل الإعدادات) ما زال مكتوباً بألوان ليلية ثابتة داخل الكود؛ حتى يُعاد بناؤه
// يُعرض في «غرفة» ليلية بهوية المعرض بدل أن يظهر داكناً وسط صفحة نهارية بلا قصد.
export default function LegacyRoom({ children }) {
  return <div className="dark min-h-full bg-bg text-ink">{children}</div>
}
