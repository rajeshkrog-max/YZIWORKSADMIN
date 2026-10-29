// Sample offers for the unit tests and the DEV mock. Invented companies.
// SAMPLE_OFFERS_LLM_JSON = what the offers LLM returns for the sample résumé;
// SAMPLE_OFFERS = the same after generateOffers (validated, with ids).

export const SAMPLE_OFFERS_LLM_JSON = {
  offers: [
    {
      company: 'Kavira Data Labs',
      logoLetter: 'K',
      industry: 'Analytics services',
      city: 'Pune',
      workMode: 'Hybrid',
      role: 'Junior Data Analyst',
      ctcMinLpa: 4,
      ctcMaxLpa: 6,
      skills: ['Excel', 'Power BI', 'SQL'],
      whyFit: 'Your Monday sales dashboard is the kind of report their clients ask for every week.',
      finalTwist: 'The first project is routine monthly data cleaning for one client before any dashboard work.',
    },
    {
      company: 'Tidewell Retail Technologies',
      logoLetter: 'T',
      industry: 'Retail',
      city: 'Bengaluru',
      workMode: 'On-site',
      role: 'Business Analyst',
      ctcMinLpa: 5,
      ctcMaxLpa: 7.5,
      skills: ['Stakeholder updates', 'Excel', 'Process mapping'],
      whyFit: 'You wrote a one-page summary for store managers — explaining numbers to non-technical people is most of this role.',
      finalTwist: 'The role needs relocation from Pune to Bengaluru within three weeks.',
    },
    {
      company: 'Brightlane Fintech',
      logoLetter: 'B',
      industry: 'Fintech',
      city: 'Mumbai',
      workMode: 'Remote',
      role: 'Reporting Analyst',
      ctcMinLpa: 4.5,
      ctcMaxLpa: 6.5,
      skills: ['Data cleaning', 'SQL', 'Written reports'],
      whyFit: 'Your product-code mapping fix is exactly the daily reconciliation work here.',
      finalTwist: 'They can only offer the lower end of the range, 4.5 LPA, for the first six months.',
    },
  ],
}

export const SAMPLE_OFFERS = SAMPLE_OFFERS_LLM_JSON.offers.map((o, i) => ({ id: `offer-${i + 1}`, ...o }))
