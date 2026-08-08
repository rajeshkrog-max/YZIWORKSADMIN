import { useState } from 'react'
import { loadMsg91Script, openMsg91OTP } from '../utils/msg91'

function EarlyPartnersForm({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    businessName: '',
    businessType: '',
    industry: '',
    otherIndustry: '',
    city: '',
    years: '',
    talentNeed: '',
    email: '',
    phone: '',
    source: '',
    otherSource: '',
    anythingElse: '',
    consent: false
  })

  const [errors, setErrors] = useState({})
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [timer, setTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const [reqId, setReqId] = useState('')

  const industries = [
    'Software & IT',
    'Film & Media',
    'Event Management',
    'Hospitality & Hotel Management',
    'Healthcare',
    'Education',
    'Marketing & Advertising',
    'E-commerce',
    'Finance & Banking',
    'Design & Creative',
    'Manufacturing',
    'Retail',
    'Real Estate',
    'Logistics',
    'Other'
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.fullName.trim()) newErrors.fullName = 'Required'
    if (!formData.role.trim()) newErrors.role = 'Required'
    if (!formData.businessName.trim()) newErrors.businessName = 'Required'
    if (!formData.businessType) newErrors.businessType = 'Required'
    if (!formData.industry) newErrors.industry = 'Required'
    if (formData.industry === 'Other' && !formData.otherIndustry.trim()) newErrors.otherIndustry = 'Required'
    if (!formData.city.trim()) newErrors.city = 'Required'
    if (!formData.years) newErrors.years = 'Required'
    if (!formData.talentNeed.trim()) newErrors.talentNeed = 'Required'
    if (!formData.email) newErrors.email = 'Required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (!formData.phone) newErrors.phone = 'Required'
    else if (!/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Enter valid 10-digit Indian number'
    if (!formData.source) newErrors.source = 'Required'
    if (formData.source === 'Other' && !formData.otherSource.trim()) newErrors.otherSource = 'Required'
    if (!formData.consent) newErrors.consent = 'You must agree to the DPDP consent'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      await loadMsg91Script()

      openMsg91OTP({
        phone: formData.phone,
        onSuccess: async (data) => {
          console.log('OTP Verified:', data)

          try {
            const response = await fetch('/.netlify/functions/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: formData.phone,
                otp: 'verified',
                reqId: data?.message || 'msg91',
                formType: 'partner',
                formData: formData
              })
            })

            const result = await response.json()

            if (result.success) {
              setIsVerified(true)
            } else {
              alert('Verification succeeded but failed to save application')
            }
          } catch (err) {
            console.error(err)
            alert('Something went wrong after OTP verification')
          }
        },
        onFailure: (error) => {
          console.error(error)
          alert('OTP verification failed')
        }
      })
    } catch (error) {
      console.error(error)
      alert('Failed to load OTP service')
    }
  }

  const startTimer = () => {
    setTimer(30)
    setCanResend(false)
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setCanResend(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      alert('Please enter 6-digit OTP')
      return
    }

    try {
      const response = await fetch('/.netlify/functions/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          otp: otp,
          reqId: reqId,
          formType: 'partner',
          formData: formData
        })
      })

      const data = await response.json()

      if (data.success) {
        setIsVerified(true)
      } else {
        alert(data.error || 'Invalid OTP')
      }
    } catch (error) {
      console.error(error)
      alert('Verification failed')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-yzi-card rounded-3xl overflow-hidden border border-white/10 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Form Side */}
          <div className="p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Become Early Partner</h2>
            <p className="text-yzi-muted text-sm mb-8">
              For local businesses, startups, MSMEs and organizations looking for verified talent.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full Name + Role */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Full Name</label>
                  <input name="fullName" value={formData.fullName} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Your Role in Organization</label>
                  <input name="role" value={formData.role} onChange={handleChange}
                    placeholder="e.g. Owner, Manager, HR..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role}</p>}
                </div>
              </div>

              {/* Business Name */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Business / Organization Name</label>
                <input name="businessName" value={formData.businessName} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                {errors.businessName && <p className="text-red-400 text-xs mt-1">{errors.businessName}</p>}
              </div>

              {/* Business Type */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Business Type</label>
                <select name="businessType" value={formData.businessType} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple">
                  <option value="">Select</option>
                  <option value="Local Business / Shop">Local Business / Shop</option>
                  <option value="Service Provider">Service Provider</option>
                  <option value="Startup">Startup</option>
                  <option value="MSME">MSME</option>
                  <option value="Company">Company</option>
                  <option value="Other">Other</option>
                </select>
                {errors.businessType && <p className="text-red-400 text-xs mt-1">{errors.businessType}</p>}
              </div>

              {/* Industry */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Industry</label>
                <select name="industry" value={formData.industry} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple">
                  <option value="">Select Industry</option>
                  {industries.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {errors.industry && <p className="text-red-400 text-xs mt-1">{errors.industry}</p>}
              </div>

              {formData.industry === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Please specify industry</label>
                  <input name="otherIndustry" value={formData.otherIndustry} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.otherIndustry && <p className="text-red-400 text-xs mt-1">{errors.otherIndustry}</p>}
                </div>
              )}

              {/* City + Years */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">City</label>
                  <input name="city" value={formData.city} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Years in Business</label>
                  <select name="years" value={formData.years} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple">
                    <option value="">Select</option>
                    <option value="Less than 1 year">Less than 1 year</option>
                    <option value="1-3 years">1-3 years</option>
                    <option value="3-5 years">3-5 years</option>
                    <option value="5+ years">5+ years</option>
                  </select>
                  {errors.years && <p className="text-red-400 text-xs mt-1">{errors.years}</p>}
                </div>
              </div>

              {/* Talent Need */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">What do you need talent for?</label>
                <textarea name="talentNeed" value={formData.talentNeed} onChange={handleChange} rows="3"
                  placeholder="Tell us briefly what kind of people you are looking for..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple resize-none" />
                {errors.talentNeed && <p className="text-red-400 text-xs mt-1">{errors.talentNeed}</p>}
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Phone (WhatsApp)</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    placeholder="10-digit number" maxLength="10"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">How did you hear about us?</label>
                <select name="source" value={formData.source} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple">
                  <option value="">Select</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Friend">Friend / Referral</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Other">Other</option>
                </select>
                {errors.source && <p className="text-red-400 text-xs mt-1">{errors.source}</p>}
              </div>

              {formData.source === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Please specify</label>
                  <input name="otherSource" value={formData.otherSource} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple" />
                  {errors.otherSource && <p className="text-red-400 text-xs mt-1">{errors.otherSource}</p>}
                </div>
              )}

              {/* Anything else */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Anything else you want to tell us? (Optional)</label>
                <textarea name="anythingElse" value={formData.anythingElse} onChange={handleChange} rows="2"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple resize-none" />
              </div>

              {/* DPDP Consent */}
              <div className="flex items-start gap-3 mt-4">
                <input
                  type="checkbox"
                  id="dpdp-consent-builder"
                  checked={formData.consent}
                  onChange={(e) => setFormData(prev => ({ ...prev, consent: e.target.checked }))}
                  className="mt-1 w-4 h-4 accent-orange-500"
                />
                <label htmlFor="dpdp-consent-builder" className="text-xs text-yzi-muted leading-relaxed">
                  I agree to the collection and processing of my personal data by Young Zone India for the purpose of the YZI Works program, in accordance with the Digital Personal Data Protection Act, 2023.
                </label>
              </div>
              {errors.consent && <p className="text-red-400 text-xs mt-1">{errors.consent}</p>}

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold hover:scale-[1.02] transition-transform mt-5"
              >
                Submit Application
              </button>
            </form>
          </div>

          {/* Right Side */}
          <div className="hidden lg:block relative bg-gradient-to-br from-yzi-purple/20 via-yzi-blue/10 to-yzi-cyan/10">
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-4">Build Better<br />Workplaces</h3>
                <p className="text-yzi-muted">
                  Join as an Early Partner and get access to verified, skilled talent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90">
          <div className="bg-yzi-card border border-white/10 rounded-2xl p-8 w-full max-w-md mx-4 text-center">
            {!isVerified ? (
              <>
                <h3 className="text-xl font-bold mb-2">Verify WhatsApp Number</h3>
                <p className="text-yzi-muted text-sm mb-6">
                  OTP will be sent to your registered WhatsApp number
                </p>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-lg font-medium">+91 {formData.phone}</span>
                  <button className="text-yzi-cyan text-sm underline">Edit</button>
                </div>
                <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength="6"
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-4 focus:outline-none focus:border-yzi-purple" />
                <button onClick={handleVerifyOtp}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold mb-3">
                  Verify OTP
                </button>
                <button onClick={() => setShowOtpModal(false)}
                  className="w-full py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/5 transition mb-4">
                  Cancel / Go Back
                </button>
                <p className="text-sm text-yzi-muted">
                  {canResend ? (
                    <button onClick={startTimer} className="text-yzi-cyan underline">Resend OTP</button>
                  ) : (
                    `Resend OTP in ${timer}s`
                  )}
                </p>
              </>
            ) : (
              <div className="py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                <h3 className="text-xl font-bold mb-2">You are Verified!</h3>
                <p className="text-yzi-muted mb-6">Thank you. Our team will contact you soon.</p>
                <button onClick={onClose}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EarlyPartnersForm