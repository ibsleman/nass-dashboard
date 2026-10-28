// صفحات التواصل والدخل والتحليلات كُتبت بألوان ليلية ثابتة داخل الكود؛ حتى تُعاد بناؤها
// (المرحلتان 4 و5) تُعرض في «غرفة» ليلية بهوية المعرض بدل أن تظهر داكنة وسط صفحة نهارية بلا قصد.
export default function LegacyRoom({ children }) {
  return <div className="dark min-h-full bg-bg text-ink">{children}</div>
}
