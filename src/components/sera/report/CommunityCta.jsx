import { COMMUNITY_NAME, COMMUNITY_URL } from '../../../config/community'
import { PANEL } from './reportStyles'

// Links to the YZI Works Community WhatsApp channel in a new tab, so the
// report stays open behind it.
function CommunityCta() {
  return (
    <section className={`${PANEL} flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8`}>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-fg">Want help getting there?</h2>
        <p className="mt-1.5 text-sm text-fg/65 leading-relaxed">
          The {COMMUNITY_NAME} connects you with real work and people who can help you build these skills.
        </p>
      </div>
      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 h-12 px-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:brightness-110 transition"
      >
        Join the {COMMUNITY_NAME}
      </a>
    </section>
  )
}

export default CommunityCta
