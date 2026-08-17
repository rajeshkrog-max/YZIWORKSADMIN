function ChoiceModal({ isOpen, onClose, onSelectBuilder, onSelectPartner }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-yzi-card border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-2">How do you want to join?</h2>
        <p className="text-yzi-muted text-sm mb-8">
          Select the option that best describes you
        </p>

        <div className="space-y-4">
          {/* Early Builder Option */}
          <button
            onClick={onSelectBuilder}
            className="w-full p-5 rounded-2xl border border-white/10 bg-black/40 hover:border-yzi-orange/50 hover:bg-yzi-orange/5 transition-all text-left"
          >
            <div className="font-semibold text-lg mb-1">I am a Builder</div>
            <div className="text-sm text-yzi-muted">
              Student, Freelancer, Creator, Young Professional
            </div>
          </button>

          {/* Early Partner Option */}
          <button
            onClick={onSelectPartner}
            className="w-full p-5 rounded-2xl border border-white/10 bg-black/40 hover:border-yzi-purple/50 hover:bg-yzi-purple/5 transition-all text-left"
          >
            <div className="font-semibold text-lg mb-1">I am a Partner</div>
            <div className="text-sm text-yzi-muted">
              Local Business, Startup, MSME, Company
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChoiceModal