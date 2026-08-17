function AnnouncementBar() {
  const announcement = (
    <div className="flex items-center gap-6 px-10 text-sm md:text-base font-medium">
      <span className="text-lg">🚨</span>

      <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 font-bold tracking-wide">
        DEADLINE EXTENDED!
      </span>

      <span className="text-white/30">—</span>

      <span className="text-white font-medium">
        You still have time to apply!
      </span>

      <span className="text-orange-400 font-bold">
        Applications close on:
      </span>

      <span className="text-white font-bold">
        📅 23rd August 2026
      </span>

      <span className="text-white/50">
        at
      </span>

      <span className="text-pink-400 font-bold">
        11:59 PM IST
      </span>

      <span className="text-white/30">•</span>

      <span className="text-yellow-400 font-bold">
        ⏳ HURRY — DON'T MISS OUT!
      </span>

      <span className="text-white/30">•</span>
    </div>
  )

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-black border-b border-white/10 overflow-hidden">
      <div className="relative flex items-center h-11 md:h-12">
        <div className="flex animate-marquee whitespace-nowrap">
          {announcement}
          {announcement}
          {announcement}
          {announcement}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default AnnouncementBar