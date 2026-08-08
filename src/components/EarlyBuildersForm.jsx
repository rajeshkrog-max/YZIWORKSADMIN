import { useState } from 'react'
import { loadMsg91Script, openMsg91OTP } from '../utils/msg91'

function EarlyBuildersForm({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    qualification: '',
    otherQualification: '',
    field: '',
    otherField: '',
    role: '',
    otherRole: '',
    email: '',
    phone: '',
    about: '',
    source: '',
    otherSource: '',
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

    if (!formData.firstName.trim()) newErrors.firstName = 'Required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Required'
    if (!formData.age) newErrors.age = 'Required'
    if (!formData.gender) newErrors.gender = 'Required'
    if (!formData.qualification) newErrors.qualification = 'Required'
    if (!formData.field) newErrors.field = 'Required'
    if (formData.field === 'Other' && !formData.otherField.trim()) newErrors.otherField = 'Required'
    if (!formData.role.trim() && !formData.otherRole.trim()) newErrors.role = 'Required'
    if (!formData.email) newErrors.email = 'Required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (!formData.phone) newErrors.phone = 'Required'
    else if (!/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Enter valid 10-digit Indian number'
    if (!formData.about.trim()) newErrors.about = 'Required'
    if (!formData.source) newErrors.source = 'Required'
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
          console.log('MSG91 success:', data)

          try {
            const response = await fetch('/.netlify/functions/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                formType: 'builder',
                formData: formData
              })
            })

            const result = await response.json()

            if (result.success) {
              setIsVerified(true)
              setShowOtpModal(true)
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
          formType: 'builder',
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
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Join Early Builders</h2>
            <p className="text-yzi-muted text-sm mb-8">
              Fill the form carefully. Our team will review every application.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">First Name</label>
                  <input name="firstName" value={formData.firstName} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Last Name</label>
                  <input name="lastName" value={formData.lastName} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
                </div>
              </div>

              {/* Age + Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Age</label>
                  <input type="number" name="age" value={formData.age} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                  {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                </div>
              </div>

              {/* Qualification */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Qualification</label>
                <select name="qualification" value={formData.qualification} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange">
                  <option value="">Select</option>
                  <option value="10th">10th</option>
                  <option value="12th">12th</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Post Graduate">Post Graduate</option>
                  <option value="Other">Other</option>
                </select>
                {errors.qualification && <p className="text-red-400 text-xs mt-1">{errors.qualification}</p>}
              </div>

              {formData.qualification === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Please specify your qualification</label>
                  <input
                    name="otherQualification"
                    value={formData.otherQualification}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange"
                  />
                </div>
              )}

              {/* Field / Industry */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Field / Industry</label>
                <select name="field" value={formData.field} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange">
                  <option value="">Select your field</option>
                  {industries.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {errors.field && <p className="text-red-400 text-xs mt-1">{errors.field}</p>}
              </div>

              {/* Show text box if Other is selected in Field */}
              {formData.field === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Please specify your field</label>
                  <input name="otherField" value={formData.otherField} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.otherField && <p className="text-red-400 text-xs mt-1">{errors.otherField}</p>}
                </div>
              )}

              {/* Role */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Current Role</label>
                <input name="role" value={formData.role} onChange={handleChange}
                  placeholder="e.g. Student, Freelancer, Intern..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role}</p>}
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">Phone (WhatsApp)</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    placeholder="10-digit number" maxLength="10"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange" />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* About */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">Tell us about yourself (short)</label>
                <textarea name="about" value={formData.about} onChange={handleChange} rows="3"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange resize-none" />
                {errors.about && <p className="text-red-400 text-xs mt-1">{errors.about}</p>}
              </div>

              {/* Source */}
              <div>
                <label className="text-sm text-yzi-muted mb-1 block">How did you hear about us?</label>
                <select name="source" value={formData.source} onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange">
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
                  <input
                    name="otherSource"
                    value={formData.otherSource}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-orange"
                  />
                </div>
              )}

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
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold hover:scale-[1.02] transition-transform mt-5"
              >
                Submit Application
              </button>
            </form>
          </div>

          {/* Right Side */}
          <div className="hidden lg:block relative bg-gradient-to-br from-yzi-orange/20 via-yzi-pink/10 to-yzi-purple/20">
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-4">Build Your<br />Work Identity</h3>
                <p className="text-yzi-muted">
                  Join the first generation of Early Builders and shape the future of work.
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

                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength="6"
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-4 focus:outline-none focus:border-yzi-orange"
                />

                <button
                  onClick={handleVerifyOtp}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold mb-3"
                >
                  Verify OTP
                </button>

                <button
                  onClick={() => setShowOtpModal(false)}
                  className="w-full py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/5 transition mb-4"
                >
                  Cancel / Go Back
                </button>

                <p className="text-sm text-yzi-muted">
                  {canResend ? (
                    <button onClick={startTimer} className="text-yzi-cyan underline">
                      Resend OTP
                    </button>
                  ) : (
                    `Resend OTP in ${timer}s`
                  )}
                </p>
              </>
            ) : (
              <div className="py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">
                  ✓
                </div>
                <h3 className="text-xl font-bold mb-2">You are Verified!</h3>
                <p className="text-yzi-muted mb-6">
                  Thank you. Our team will contact you soon.
                </p>
                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink font-semibold"
                >
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

export default EarlyBuildersForm