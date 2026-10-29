// DEV ONLY — sample data for /meet-sera?preview=… (loaded on demand by
// MeetSera, never in the production bundle).
import { createSession } from '../shared/seraSession.js'
import { SAMPLE_RESUME } from '../../netlify/lib/fixtures/seraResume.js'
import { SAMPLE_OFFERS } from '../../netlify/lib/fixtures/seraOffers.js'
import { buildMockReport } from './seraMockReport.js'

// variant: 'error' → no report, 'gaps' → a skill without evidence + a cut-short round.
export function previewSession({ route = 'student', variant = null } = {}) {
  return {
    ...createSession({ route, firstName: 'Priya', email: 'priya@example.com', phone: '9876543210' }),
    resume: SAMPLE_RESUME,
    offers: SAMPLE_OFFERS,
    report: variant === 'error' ? null : buildMockReport({ route, firstName: 'Priya', variant: variant === 'gaps' ? 'gaps' : null }),
  }
}
