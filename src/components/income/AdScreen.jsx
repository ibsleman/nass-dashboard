// الإعلان كما يعرضه التطبيق (CustomAdView): الوسائط تملأ الشاشة، حلقة العدّ في الأعلى،
// وزرّا الفعل في الأسفل — الذهبي للتواصل والزجاجي للمشاهدة. الزر بلا رابط لا يظهر (كالتطبيق).
// الشاشة داكنة دائماً لأن الإعلان فوق وسائط.

const isVideo = (ad) => Boolean(ad.video_url)

export function AdMedia({ ad, className = '' }) {
  if (isVideo(ad)) {
    return <video src={ad.video_url} className={`h-full w-full object-cover ${className}`} muted playsInline autoPlay loop preload="metadata" />
  }
  if (ad.image_url) return <img src={ad.image_url} alt="" className={`h-full w-full object-cover ${className}`} draggable={false} />
  return <div className={`grid h-full w-full place-items-center text-[13px] text-white/40 ${className}`}>صورة أو فيديو</div>
}

export default function AdScreen({ ad, mini = false }) {
  const secs = Number(ad.countdown_secs) || 0
  const showView = Boolean(ad.watch_button_url?.trim())
  const showContact = Boolean(ad.contact_button_url?.trim())
  return (
    <div className="relative h-full w-full bg-black text-white">
      <AdMedia ad={ad} />
      <span
        aria-hidden
        className={`absolute left-[8%] grid place-items-center rounded-full border-white/80 font-semibold ${mini ? 'top-[24px] h-[22px] w-[22px] border-2 text-[9px]' : 'top-[50px] h-[38px] w-[38px] border-[3px] text-[13px]'}`}
      >
        {secs || '×'}
      </span>
      {(showView || showContact) && (
        <div className={`absolute inset-x-[6%] flex ${mini ? 'bottom-[16px] gap-1.5' : 'bottom-[30px] gap-3'}`}>
          {showView && (
            <span className={`grid flex-1 place-items-center truncate rounded-field bg-white/20 font-semibold backdrop-blur ${mini ? 'h-[24px] rounded-[8px] px-1 text-[9px]' : 'h-[50px] px-3 text-[15px]'}`}>
              {ad.view_label?.trim() || 'مشاهدة'}
            </span>
          )}
          {showContact && (
            <span className={`grid flex-1 place-items-center truncate rounded-field bg-[#E9C46A] font-semibold text-[#0E0D0B] ${mini ? 'h-[24px] rounded-[8px] px-1 text-[9px]' : 'h-[50px] px-3 text-[15px]'}`}>
              {ad.contact_label?.trim() || 'تواصل معنا'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
