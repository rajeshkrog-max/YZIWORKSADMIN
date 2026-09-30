// Sample résumé for the unit tests and the DEV mock. Invented person.
// SAMPLE_RESUME = what sera-extract-resume returns for it (text + highlight + field).

export const SAMPLE_RESUME_TEXT = `Priya Sharma
Pune, Maharashtra · priya.sample@example.com

EDUCATION
B.Com (Computer Applications), Savitri College of Commerce, Pune — 2025, 7.8 CGPA

EXPERIENCE
Data Analyst Intern — Meridale Home Stores (retail chain, 14 stores), Pune · Jan 2025 – Jun 2025
- Cleaned the monthly sales data in Excel: removed duplicates, fixed date formats, merged two regional sheets.
- Built a Power BI dashboard showing sales by region; used by the regional manager every Monday.
- Found that two regions used different product codes; built a mapping table so totals matched.
- Wrote a one-page weekly summary for store managers.

PROJECTS
Expense tracker (college) — Excel + basic SQL on a sample dataset of 2,000 transactions.

SKILLS
Excel (pivot tables, VLOOKUP, data cleaning), Power BI, basic SQL, Google Sheets, clear written reports

LANGUAGES
English, Hindi, Marathi`

export const SAMPLE_RESUME = {
  objectKey: 'sera-interviews/mock/Priya_Sharma_Resume.pdf',
  highlight: 'I saw you built a Power BI sales dashboard at Meridale Home Stores that your manager used every Monday.',
  field: 'data analysis',
}
