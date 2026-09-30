// Sample 3-round interview for the unit tests and the DEV mock. Invented person
// (the résumé in ./seraResume.js) and the invented offer she chose (./seraOffers.js).
// Transcript turns: { role, text, start, end, round }; start/end are seconds
// from the start of that round's call.
import { SAMPLE_OFFERS } from './seraOffers.js'

// The chosen offer (Tidewell, Business Analyst).
export const SAMPLE_OFFER = SAMPLE_OFFERS[1]

const turn = (round, role, start, end, text) => ({ round, role, start, end, text })

export const SAMPLE_TRANSCRIPT = [
  // Screening (5 min)
  turn('screening', 'agent', 0, 12, "Hi, I'm Sera. This is a short practice conversation, not a test. How was your day today? Tell me in 20 to 30 seconds."),
  turn('screening', 'user', 14, 38, 'It was good actually, I finished a sales dashboard for my internship and um then I helped my brother with his college forms.'),
  turn('screening', 'agent', 40, 48, "Nice, that's a full day. From your recent work, what did you actually do? Explain simply."),
  turn('screening', 'user', 50, 102, 'At my internship I cleaned the monthly sales data in Excel, removed duplicates and fixed the dates, and then I built a Power BI dashboard so the manager could see sales by region every Monday.'),
  turn('screening', 'agent', 104, 112, "That's a solid range of work. What was the hardest part, and how did you handle it?"),
  turn('screening', 'user', 114, 160, 'The hardest part was that two regions used different product codes, so the totals did not match. I made a mapping table with my manager and after that the numbers matched.'),
  turn('screening', 'agent', 162, 172, "Good, that's exactly the kind of detail I wanted. If you got a small task in your field tomorrow, what would you start with first?"),
  turn('screening', 'user', 174, 214, 'Basically I would first ask what decision the report is for, then I would check the data source, and matlab only after that I would start building.'),
  turn('screening', 'agent', 216, 226, 'Last question. What role are you targeting next, what salary band, and by when?'),
  turn('screening', 'user', 228, 262, 'I am targeting a junior data analyst role, around four to six LPA, in the next three months.'),
  turn('screening', 'agent', 264, 280, "Thank you. You explained your dashboard really clearly. I'll now prepare your next round."),
  // HR round (3 min)
  turn('hr', 'agent', 0, 14, 'Welcome to the HR round for Tidewell Retail Technologies. Tell me about a time you had to explain numbers to someone who is not technical.'),
  turn('hr', 'user', 16, 66, 'In my internship the store managers did not understand the dashboard, so I made a one page summary with three numbers and I explained it in the Monday call in simple words.'),
  turn('hr', 'agent', 68, 78, 'How do you handle a deadline you know you will miss?'),
  turn('hr', 'user', 80, 112, 'Um I would tell my manager early, uh, explain what is done and what is left, and ask which part is most important.'),
  turn('hr', 'agent', 114, 120, 'Why do you want this role at Tidewell?'),
  turn('hr', 'user', 122, 150, 'I like working with people and data together, and this role has both.'),
  // Final round (2 min)
  turn('final', 'agent', 0, 12, 'Final round. Your manager wants a report by Friday but the data is wrong. What do you do?'),
  turn('final', 'user', 14, 60, 'I would first check how much of the data is wrong, then tell the manager on the same day with two options, a partial report on Friday or a full report on Monday.'),
  turn('final', 'agent', 62, 70, 'What would you do in your first week?'),
  turn('final', 'user', 72, 100, 'I would learn the current process, uh, meet the people who use the reports, and write down where time is lost.'),
  turn('final', 'agent', 102, 115, "Thank you, that's the end of the final round."),
]

// The same interview as Retell delivers it: one transcript per round's call.
export const SAMPLE_TRANSCRIPTS = Object.fromEntries(
  ['screening', 'hr', 'final'].map((round) => [
    round,
    SAMPLE_TRANSCRIPT.filter((t) => t.round === round).map(({ role, text, start, end }) => ({ role, text, start, end })),
  ]),
)

// What the summary LLM returns after screening and after HR (2 neutral lines each).
export const SAMPLE_SUMMARIES = {
  screening:
    'The candidate described cleaning monthly sales data in Excel and building a Power BI dashboard at the internship, and fixing mismatched product codes with a mapping table.\nThey are targeting a junior data analyst role at around 4 to 6 LPA within three months.',
  hr: 'The candidate described turning the dashboard into a one-page summary for store managers and said they would warn the manager early about a missed deadline.\nThey said they want the role because it combines people and data.',
}

const r = (communication, roleKnowledge, problemSolving, composure, judgement) => ({
  communication,
  roleKnowledge,
  problemSolving,
  composure,
  judgement,
})

// What the LLM returns for SAMPLE_TRANSCRIPT (see REPORT_LLM_SCHEMA): 1–5
// ratings per answer and word-for-word quotes. It never picks final numbers.
export const SAMPLE_LLM_OUTPUT = {
  answers: [
    { round: 'screening', timestamp: 14, ratings: r(3, null, null, 3, null) },
    { round: 'screening', timestamp: 50, ratings: r(4, 4, 3, null, null) },
    { round: 'screening', timestamp: 114, ratings: r(4, 3, 4, 4, 3) },
    { round: 'screening', timestamp: 174, ratings: r(3, 3, 4, null, 4) },
    { round: 'screening', timestamp: 228, ratings: r(4, null, null, null, 3) },
    { round: 'hr', timestamp: 16, ratings: r(4, null, null, 3, 4) },
    { round: 'hr', timestamp: 80, ratings: r(3, null, null, 3, 4) },
    { round: 'hr', timestamp: 122, ratings: r(2, null, null, null, 3) },
    { round: 'final', timestamp: 14, ratings: r(4, null, 4, null, 4) },
    { round: 'final', timestamp: 72, ratings: r(3, 3, null, null, 3) },
  ],
  skillQuotes: {
    communication: { text: 'I made a one page summary with three numbers and I explained it in the Monday call in simple words', timestamp: 16, round: 'hr' },
    roleKnowledge: { text: 'I cleaned the monthly sales data in Excel, removed duplicates and fixed the dates', timestamp: 50, round: 'screening' },
    problemSolving: { text: 'I made a mapping table with my manager and after that the numbers matched', timestamp: 114, round: 'screening' },
    composure: { text: 'I would tell my manager early', timestamp: 80, round: 'hr' },
    judgement: { text: 'tell the manager on the same day with two options', timestamp: 14, round: 'final' },
  },
  summary:
    'You gave concrete answers about real internship work and handled the bad-data deadline sensibly. Your answers were clear on the skill questions but got general when asked why you want this role. The main gap is showing your results with numbers.',
  roundNotes: {
    screening: 'Specific about the dashboard work, with a clear example of fixing mismatched data.',
    hr: 'Strong at explaining numbers simply; the motivation answer stayed general.',
    final: 'A sensible, two-option plan for wrong data before a deadline.',
  },
  strengths: [
    { text: 'You explained a real data problem — mismatched product codes — and exactly how you fixed it.', round: 'screening', timestamp: 114 },
    { text: 'You turned a technical dashboard into a one-page summary for non-technical managers.', round: 'hr', timestamp: 16 },
    { text: 'With wrong data before a deadline, you offered two concrete options instead of only raising the problem.', round: 'final', timestamp: 14 },
  ],
  growth: [
    { text: "Your answer on why you want this role stayed general. Name one specific thing about the company's work.", round: 'hr', timestamp: 122 },
    { text: 'Fillers like "basically" and "matlab" showed up while you were thinking. A short pause works better.', round: 'screening', timestamp: 174 },
    { text: 'Add a number to your results: how much time did the dashboard save each week?', round: 'screening', timestamp: 50 },
  ],
  rewrite: {
    question: 'Why do you want this role at Tidewell?',
    youSaid: 'I like working with people and data together, and this role has both.',
    stronger:
      'In my internship the part I enjoyed most was turning the sales dashboard into a one-page summary the store managers actually used. This role is that every day — working with the numbers and then with the people who act on them.',
    round: 'hr',
    timestamp: 122,
  },
  offerFit: [
    { requirement: 'Stakeholder updates', shown: true, quote: { text: 'I explained it in the Monday call in simple words', round: 'hr', timestamp: 16 } },
    { requirement: 'Excel', shown: true, quote: { text: 'I cleaned the monthly sales data in Excel', round: 'screening', timestamp: 50 } },
    { requirement: 'Process mapping', shown: false, quote: null },
  ],
  plan: [
    { horizon: '30d', title: 'Put numbers on your work', text: 'For the dashboard and the mapping fix, write one line each with a before/after number you can say out loud.', skills: ['Impact metrics', 'Excel'] },
    { horizon: '1-3m', title: 'Learn process mapping basics', text: 'Map one real process end to end — who does what, where time is lost — and practise explaining it in two minutes.', skills: ['Process mapping', 'Stakeholder updates'] },
    { horizon: '6-12m', title: 'Own a weekly report end to end', text: 'Take one report from data source to the decision it supports, and track what changed because of it.', skills: ['SQL', 'Business communication'] },
  ],
}
