import { MONTHS } from '../../lib/reach'

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// إطار آيفون للمعاينة: الشاشة داكنة دائماً كأي شاشة قفل، مهما كان مظهر اللوحة.
// العرض ثابت (300) لأن بطاقة الإشعار تنتقل منه إلى السجل بنفس عرضها.
// isolate: مؤشر الشاشة السفلي لا يُرسم فوق بطاقة تطير خارج الهاتف.
export const PHONE_W = 300

export function PhoneFrame({ children, className = '', screenClassName = 'bg-[#16130f]' }) {
  return (
    <div className={`relative isolate mx-auto w-[300px] rounded-[50px] bg-[#0b0a09] p-[9px] shadow-card ring-1 ring-black/40 dark:ring-white/[0.12] ${className}`}>
      <div className={`relative h-[560px] overflow-hidden rounded-[42px] sm:h-[600px] ${screenClassName}`}>
        <div aria-hidden className="absolute left-1/2 top-[11px] z-10 h-[30px] w-[98px] -translate-x-1/2 rounded-full bg-black" />
        {children}
        <div aria-hidden className="absolute bottom-[8px] left-1/2 z-10 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-white/70 mix-blend-difference" />
      </div>
    </div>
  )
}

/** شاشة القفل: التاريخ ثم الساعة الكبيرة، والإشعارات فوق زرّي المصباح والكاميرا */
export function LockScreen({ now, children }) {
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <PhoneFrame screenClassName="bg-[#16130f] [background-image:radial-gradient(130%_60%_at_50%_0%,rgb(233_196_106/0.14),transparent_62%)]">
      <div className="pt-[62px] text-center text-white">
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-[18px] w-[18px] fill-white/85">
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
        </svg>
        <p className="mt-2 text-[16px] font-semibold text-white/85">{WEEKDAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}</p>
        <p dir="ltr" className="num text-[78px] font-bold leading-[1.02] tracking-[-0.02em]">{time}</p>
      </div>
      <div className="absolute inset-x-[12px] bottom-[96px]">{children}</div>
      <div aria-hidden className="absolute inset-x-[34px] bottom-[34px] flex justify-between">
        {[0, 1].map((i) => <span key={i} className="h-[46px] w-[46px] rounded-full bg-white/[0.12] backdrop-blur" />)}
      </div>
    </PhoneFrame>
  )
}
