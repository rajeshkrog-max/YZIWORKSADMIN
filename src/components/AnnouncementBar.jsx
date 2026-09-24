function AnnouncementBar() {
  const announcement = (
    <div className="flex items-center gap-6 px-10 text-sm md:text-base font-medium">
      <span className="text-lg">💼</span>

      <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 light:from-orange-600 light:via-pink-600 light:to-purple-600 font-bold tracking-wide">
        WORK & EARN ON YOUR TERMS
      </span>

      <span className="text-fg/30">—</span>

      <span className="text-fg/80 font-medium">
        No hidden charges
      </span>

      <span className="text-fg/30">•</span>

      <span className="text-lg">🚀</span>

      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 light:from-cyan-600 light:via-blue-600 light:to-purple-600 font-bold tracking-wide">
        GET YOUR WORK DONE WITH RELIABLE PEOPLE
      </span>

      <span className="text-fg/30">—</span>

      <span className="text-fg/80 font-medium">
        No platform fees *
      </span>

      <span className="text-fg/30">•</span>

      <span className="text-lg">🤝</span>

      <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-orange-500 to-yellow-400 light:from-pink-600 light:via-orange-600 light:to-yellow-600 font-bold tracking-wide">
        GET MORE CLIENTS & GROW YOUR BUSINESS
      </span>

      <span className="text-fg/30">—</span>

      <span className="text-fg/80 font-medium">
        No hidden charges
      </span>

      <span className="text-fg/30">•</span>

      <span className="text-fg/40 text-xs md:text-sm font-normal">
        Subject to applicable terms, conditions and future changes to the platform's pricing/fee structure.
      </span>

      <span className="text-fg/30">•</span>
    </div>
  )

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-pure border-b border-fg/10 overflow-hidden">
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