import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import FloatingThemeToggle from '../theme/FloatingThemeToggle'

const UPDATED = '26 October 2026'
const CONTACT_EMAIL = 'works@youngzoneindia.com'

// The Terms and the Refund Policy that the Meet Sera pay screen links to. They describe
// what the backend actually does (one interview per email, one free restart, report retry).
const PAGES = {
  terms: {
    title: 'Terms of Use',
    sections: [
      {
        heading: 'Who we are',
        body: [
          'yziworks.com is run by YZI Productions Private Limited (Young Zone India). These terms cover the website and Meet Ai Sera, our AI mock interview at /meet-sera. By using them you agree to these terms.',
        ],
      },
      {
        heading: 'What Meet Ai Sera is',
        body: [
          'Meet Ai Sera is a practice interview with AI voice interviewers. You upload one PDF résumé, pick one of three offers built from it, and take a screening, HR and final round. At the end you get an on-screen report and a PDF.',
          'It is practice and feedback only. It is not a job offer, an assessment for any employer, or a guarantee of any result. The report is written by AI from what you said and can contain mistakes.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You sign in with Google, or with your WhatsApp number and an email you type in. Each email gets one interview. Use an email you own and details that are true. A paid interview or a student seat is for the person who signed in and cannot be transferred.',
        ],
      },
      {
        heading: 'Price and payment',
        body: [
          'A New User interview costs ₹249 (inclusive of taxes, if any), paid once through Razorpay before the interview starts. Student interviews use a code from your campus and are not charged. We never see or store your card or UPI details.',
        ],
      },
      {
        heading: 'Your data',
        body: [
          'We keep your name, email, phone number, résumé, the transcript of your interview and your report so we can run the interview and show you the report. Your résumé and answers are processed by our service providers (OpenAI for analysis, Vapi for the voice call, Cloudflare for storage, Razorpay for payment). We do not sell your data. To have your data deleted, write to us at the address below.',
        ],
      },
      {
        heading: 'Fair use',
        body: [
          "Don't try to get around the one-interview-per-email rule, the payment or the seat limits, upload someone else's résumé, or interfere with the service. We may refuse or end an interview that breaks these terms.",
        ],
      },
      {
        heading: 'Liability',
        body: [
          'We work to keep the service available but cannot promise it will never fail. If an interview fails because of us, our Refund Policy applies. Beyond that, to the extent the law allows, our liability is limited to the amount you paid for the interview.',
        ],
      },
      {
        heading: 'Changes and law',
        body: [
          'We may update these terms; the date at the top shows the latest version. These terms are governed by the laws of India.',
        ],
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    sections: [
      {
        heading: 'If something goes wrong on our side',
        body: [
          'Paid twice, or paid and the interview never started: we refund the extra or unused payment in full. If you paid but the page did not confirm it, sign in again with the same email: the payment is found and you are not asked to pay again.',
          'The call dropped before the offers appeared: you get one free restart, without paying again. If the restart also fails because of us, we refund in full.',
          'The interview finished but no report was produced (we retry once automatically): we refund in full, or we offer you a new interview, whichever you prefer.',
        ],
      },
      {
        heading: 'When we do not refund',
        body: [
          'Once an interview has taken place and the report has been produced, the fee is not refundable, including when you ended the call early yourself or did not answer the questions. A student interview is not paid, so there is nothing to refund.',
        ],
      },
      {
        heading: 'How to ask for a refund',
        body: [
          `Write to ${CONTACT_EMAIL}, or use Contact Us at the bottom of this page, within 7 days of the payment. Include the email you signed in with and the Razorpay payment ID if you have it. We reply within 3 working days.`,
          'Approved refunds go back to the original payment method through Razorpay. Banks usually take 5 to 7 working days to show the money in your account.',
        ],
      },
    ],
  },
}

function Policies({ page }) {
  const { title, sections } = PAGES[page]
  return (
    <div className="min-h-screen bg-surface text-fg">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-20">
        <Link to="/" className="text-sm text-fg/60 hover:text-fg">← yziworks.com</Link>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-fg/50">Last updated {UPDATED}</p>
        <p className="mt-1 text-sm text-fg/50">
          See also{' '}
          {page === 'terms' ? (
            <Link to="/refund-policy" className="underline underline-offset-2 hover:text-fg">Refund Policy</Link>
          ) : (
            <Link to="/terms" className="underline underline-offset-2 hover:text-fg">Terms of Use</Link>
          )}
        </p>
        {sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.body.map((text) => (
              <p key={text} className="mt-3 text-[15px] leading-relaxed text-fg/75">{text}</p>
            ))}
          </section>
        ))}
        <p className="mt-10 text-[15px] text-fg/75">
          Questions: <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-fg">{CONTACT_EMAIL}</a>
        </p>
      </main>
      <Footer />
      <FloatingThemeToggle />
    </div>
  )
}

export default Policies
