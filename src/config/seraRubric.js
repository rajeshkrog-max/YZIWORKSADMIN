// Sera's scoring rubric — YZI's OWN targets for an entry-level candidate.
// Used by the browser (report page) and by the report pipeline in
// netlify/lib/seraReport/. The "expected" levels are our rubric targets, not
// data about real hires.
//
// The LLM rates each answer 1–5 per skill against these anchors; every number
// on the report is then computed in code from those ratings.

export const SERA_SKILLS = [
  {
    id: 'communication',
    label: 'Communication',
    weight: 0.25,
    expected: 60,
    anchors: {
      1: 'Hard to follow; answers do not address the question.',
      2: 'Addresses the question but rambles or leaves the point unclear.',
      3: 'Clear enough to follow; the main point is there but not structured.',
      4: 'Clear and structured; leads with the point, then supports it.',
      5: 'Crisp, well structured and easy to repeat back; adapts to follow-ups.',
    },
  },
  {
    id: 'roleKnowledge',
    label: 'Role knowledge',
    weight: 0.25,
    expected: 55,
    anchors: {
      1: 'No working knowledge of the tools or tasks for this role.',
      2: 'Names tools or tasks but cannot say how they were used.',
      3: 'Describes real tasks done with the tools, with basic accuracy.',
      4: 'Explains how and why the work was done, with specific details.',
      5: 'Explains trade-offs and alternatives; knowledge clearly beyond the basics.',
    },
  },
  {
    id: 'problemSolving',
    label: 'Problem solving',
    weight: 0.2,
    expected: 55,
    anchors: {
      1: 'Cannot describe how they would approach a problem.',
      2: 'Jumps to an answer without steps or reasons.',
      3: 'Describes a sensible first step or a simple sequence.',
      4: 'Breaks the problem into steps and explains the reasoning.',
      5: 'Considers constraints and risks, and checks their own result.',
    },
  },
  {
    id: 'composure',
    label: 'Composure',
    weight: 0.15,
    expected: 60,
    anchors: {
      1: 'Freezes or cannot continue after a follow-up or a hard question.',
      2: 'Visibly thrown; answers become much weaker under pressure.',
      3: 'Recovers after a pause; stays on topic.',
      4: 'Steady under follow-ups; takes a moment and answers well.',
      5: 'Calm and in control throughout, including on the hardest question.',
    },
  },
  {
    id: 'judgement',
    label: 'Judgement',
    weight: 0.15,
    expected: 55,
    anchors: {
      1: 'Choices described would clearly cause problems at work.',
      2: 'Reasonable intent but misses obvious priorities or people.',
      3: 'Sensible choices for simple situations.',
      4: 'Weighs priorities and people involved; explains why.',
      5: 'Mature judgement; anticipates consequences and communicates them.',
    },
  },
]

// Verdict bands on the overall 0–100 score (fixed thresholds).
export const SCORE_BANDS = [
  { id: 'needs_work', label: 'Needs work', min: 0 },
  { id: 'getting_there', label: 'Getting there', min: 50 },
  { id: 'ready', label: 'Ready', min: 70 },
]

export const RUBRIC_CONFIG = {
  skills: SERA_SKILLS,
  bands: SCORE_BANDS,
  minRatedAnswersPerRound: 2, // fewer → the round shows "Not enough to score"
  minSkillsForOverall: 3, // fewer scored skills → no overall score
  cutShortRatio: 0.6, // a round shorter than 60% of its planned time was cut short
  minUserWordsPerRound: 25, // fewer candidate words in a round → "Not enough to score"
}

// 1–5 rating → 0–100 score.
export const ratingToScore = (rating) => Math.round(((rating - 1) / 4) * 100)

export const bandFor = (score) =>
  score == null ? null : [...SCORE_BANDS].reverse().find((band) => score >= band.min)?.id ?? null
