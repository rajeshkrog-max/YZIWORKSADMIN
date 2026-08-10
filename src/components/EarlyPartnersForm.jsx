import { useState, useRef } from 'react'
import { loadMsg91Script, openMsg91OTP } from '../utils/msg91'
import { uploadFilesToR2 } from '../utils/r2Upload'
import partnerImage from '../assets/partner.png'

const PRIVACY_NOTICE_VERSION = 'v1'

const PRIVACY_CONSENT_TEXT =
  'I agree to the collection and processing of my personal data by Young Zone India for the YZI Works platform as detailed in the Privacy Notice above [DPDPA 2023].'

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
    consent: false,
    consentTimestamp: ''
  })

  const [errors, setErrors] = useState({})
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [timer, setTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const [reqId, setReqId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const fileInputRef = useRef(null)
  const [isProcessingSubmission, setIsProcessingSubmission] = useState(false)

  const [privacyNoticeRead, setPrivacyNoticeRead] = useState(false)
  const privacyNoticeRef = useRef(null)

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

  const MAX_FILES = 5
  const MAX_TOTAL_SIZE = 20 * 1024 * 1024

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])

    const totalSize = files.reduce(
      (total, file) => total + file.size,
      0
    )

    if (files.length > MAX_FILES) {
      setErrors(prev => ({
        ...prev,
        attachments: `You can upload a maximum of ${MAX_FILES} files`
      }))
      e.target.value = ''
      return
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      setErrors(prev => ({
        ...prev,
        attachments: 'Total file size must be 20 MB or smaller'
      }))
      e.target.value = ''
      return
    }

    setSelectedFiles(files)
    setErrors(prev => ({ ...prev, attachments: '' }))
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    setErrors(prev => ({ ...prev, attachments: '' }))
  }

  const handlePrivacyScroll = () => {
    const element = privacyNoticeRef.current

    if (!element) return

    const hasReachedBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 8

    if (hasReachedBottom) {
      setPrivacyNoticeRead(true)
    }
  }

  const handleConsentChange = (e) => {
    const checked = e.target.checked

    setFormData(prev => ({
      ...prev,
      consent: checked,
      consentTimestamp: checked ? new Date().toISOString() : ''
    }))

    setErrors(prev => ({ ...prev, consent: '' }))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.fullName.trim()) newErrors.fullName = 'Required'
    if (!formData.role.trim()) newErrors.role = 'Required'
    if (!formData.businessName.trim()) newErrors.businessName = 'Required'
    if (!formData.businessType) newErrors.businessType = 'Required'
    if (!formData.industry) newErrors.industry = 'Required'

    if (
      formData.industry === 'Other' &&
      !formData.otherIndustry.trim()
    ) {
      newErrors.otherIndustry = 'Required'
    }

    if (!formData.city.trim()) newErrors.city = 'Required'
    if (!formData.years) newErrors.years = 'Required'
    if (!formData.talentNeed.trim()) newErrors.talentNeed = 'Required'

    if (!formData.email) {
      newErrors.email = 'Required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email'
    }

    if (!formData.phone) {
      newErrors.phone = 'Required'
    } else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Enter valid 10-digit Indian number'
    }

    if (!formData.source) newErrors.source = 'Required'

    if (
      formData.source === 'Other' &&
      !formData.otherSource.trim()
    ) {
      newErrors.otherSource = 'Required'
    }

    if (!privacyNoticeRead) {
      newErrors.consent =
        'Please read the Privacy Notice completely before giving consent'
    } else if (!formData.consent) {
      newErrors.consent = 'You must agree to the Privacy Notice'
    }

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
          setReqId(data.reqId || '')
          setIsProcessingSubmission(true)

          try {
            let attachments = []

            if (selectedFiles.length > 0) {
              attachments = await uploadFilesToR2(
                selectedFiles,
                'partner'
              )
            }

            const response = await fetch('/.netlify/functions/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                formType: 'partner',
                formData: {
                  ...formData,
                  consentText: PRIVACY_CONSENT_TEXT,
                  consentVersion: PRIVACY_NOTICE_VERSION
                },
                attachments
              })
            })

            const result = await response.json()

            if (result.success) {
              setIsVerified(true)
              setShowOtpModal(true)
            } else {
              alert(
                result.error ||
                'Verification succeeded but failed to save application'
              )
            }
          } catch (err) {
            console.error('Application submission error:', err)

            alert(
              err.message ||
              'Something went wrong after OTP verification'
            )
          } finally {
            setIsProcessingSubmission(false)
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
          formData: {
            ...formData,
            consentText: PRIVACY_CONSENT_TEXT,
            consentVersion: PRIVACY_NOTICE_VERSION
          }
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

          <div className="p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Become Early Partner
            </h2>

            <p className="text-yzi-muted text-sm mb-8">
              For local businesses, startups, MSMEs and organizations looking
              for verified talent.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Full Name
                  </label>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.fullName && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Your Role in Organization
                  </label>
                  <input
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    placeholder="e.g. Owner, Manager, HR..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.role && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.role}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  Business / Organization Name
                </label>
                <input
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                />
                {errors.businessName && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.businessName}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  Business Type
                </label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                >
                  <option value="">Select</option>
                  <option value="Local Business / Shop">
                    Local Business / Shop
                  </option>
                  <option value="Service Provider">Service Provider</option>
                  <option value="Startup">Startup</option>
                  <option value="MSME">MSME</option>
                  <option value="Company">Company</option>
                  <option value="Other">Other</option>
                </select>
                {errors.businessType && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.businessType}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  Industry
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                >
                  <option value="">Select Industry</option>
                  {industries.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {errors.industry && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.industry}
                  </p>
                )}
              </div>

              {formData.industry === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Please specify industry
                  </label>
                  <input
                    name="otherIndustry"
                    value={formData.otherIndustry}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.otherIndustry && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.otherIndustry}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    City
                  </label>
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.city && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.city}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Years in Business
                  </label>
                  <select
                    name="years"
                    value={formData.years}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  >
                    <option value="">Select</option>
                    <option value="Less than 1 year">
                      Less than 1 year
                    </option>
                    <option value="1-3 years">1-3 years</option>
                    <option value="3-5 years">3-5 years</option>
                    <option value="5+ years">5+ years</option>
                  </select>
                  {errors.years && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.years}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  What do you need talent for?
                </label>
                <textarea
                  name="talentNeed"
                  value={formData.talentNeed}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Tell us briefly what kind of people you are looking for..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple resize-none"
                />
                {errors.talentNeed && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.talentNeed}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit number"
                    maxLength="10"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.phone && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  How did you hear about us?
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                >
                  <option value="">Select</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Friend">Friend / Referral</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Other">Other</option>
                </select>
                {errors.source && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.source}
                  </p>
                )}
              </div>

              {formData.source === 'Other' && (
                <div>
                  <label className="text-sm text-yzi-muted mb-1 block">
                    Please specify
                  </label>
                  <input
                    name="otherSource"
                    value={formData.otherSource}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple"
                  />
                  {errors.otherSource && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.otherSource}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-yzi-muted mb-1 block">
                  Anything else you want to tell us? (Optional)
                </label>
                <textarea
                  name="anythingElse"
                  value={formData.anythingElse}
                  onChange={handleChange}
                  rows="2"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yzi-purple resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <label className="text-sm text-yzi-muted">
                    Upload Documents
                  </label>

                  <span className="text-[10px] text-gray-500">
                    Optional • Max 5 files • 20 MB total
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 mb-3">
                  Useful documents: company profile, registration documents,
                  portfolio, requirements, etc. You may upload any relevant file type.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-medium
                    file:bg-white/10 file:text-white
                    hover:file:bg-white/20
                    cursor-pointer"
                />

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">
                            {file.name}
                          </p>

                          <p className="text-[10px] text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-xs text-red-400 hover:text-red-300 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <p className="text-[10px] text-gray-500">
                      {selectedFiles.length}/5 files •{' '}
                      {formatFileSize(
                        selectedFiles.reduce(
                          (total, file) => total + file.size,
                          0
                        )
                      )}{' '}
                      / 20 MB
                    </p>
                  </div>
                )}

                {errors.attachments && (
                  <p className="text-red-400 text-xs mt-2">
                    {errors.attachments}
                  </p>
                )}
              </div>

              <div className="mt-6">
                <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-medium text-white/80">
                      Data Privacy Notice
                    </p>
                  </div>

                  <div
                    ref={privacyNoticeRef}
                    onScroll={handlePrivacyScroll}
                    className="h-[190px] overflow-y-auto px-4 py-4 text-[11px] md:text-xs text-gray-400 leading-relaxed scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                  >
                    <p className="mb-3">
                      Young Zone India collects your name, email address, and
                      phone number solely to process your application for the
                      YZI Works platform [DPDPA 2023].
                    </p>

                    <p className="mb-3">
                      Your data will not be shared with third parties without
                      your explicit permission.
                    </p>

                    <p className="mb-3">
                      You have the right to withdraw your consent or request
                      data erasure at any time by emailing our Data Protection
                      Officer at{' '}
                      <a
                        href="mailto:admin@youngzoneindia.com"
                        className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
                      >
                        admin@youngzoneindia.com
                      </a>{' '}
                      [DPDPA 2023].
                    </p>

                    <p>
                      For detailed information, please read our{' '}
                      <a
                        href="https://www.youngzoneindia.com/privacy-policy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
                      >
                        Privacy Policy
                      </a>
                      .
                    </p>
                  </div>

                  <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02]">
                    {privacyNoticeRead ? (
                      <p className="text-[11px] text-green-400/80">
                        ✓ Privacy Notice reviewed
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-500">
                        Please scroll through the notice to continue.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={`flex items-start gap-3 mt-4 ${
                    !privacyNoticeRead ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    id="dpdp-consent-partner"
                    checked={formData.consent}
                    disabled={!privacyNoticeRead}
                    onChange={handleConsentChange}
                    className="mt-1 w-4 h-4 accent-orange-500 disabled:cursor-not-allowed"
                  />

                  <label
                    htmlFor="dpdp-consent-partner"
                    className={`text-xs leading-relaxed ${
                      privacyNoticeRead
                        ? 'text-yzi-muted cursor-pointer'
                        : 'text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {PRIVACY_CONSENT_TEXT}
                  </label>
                </div>

                <p className="mt-2 ml-7 text-[10px] text-gray-500">
                  * Required
                </p>

                {errors.consent && (
                  <p className="text-red-400 text-xs mt-2">
                    {errors.consent}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessingSubmission}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold hover:scale-[1.02] transition-transform mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessingSubmission ? 'Processing...' : 'Submit Application'}
              </button>
            </form>
          </div>

          <div
            className="hidden lg:block relative overflow-hidden"
            style={{
              backgroundImage: `url(${partnerImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Dark readability overlay */}
            <div className="absolute inset-0 bg-black/45" />

            {/* Existing text remains above the image */}
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <div className="relative z-10 text-center">
                <h3 className="text-3xl font-bold mb-4">
                  Build Better
                  <br />
                  Workplaces
                </h3>

                <p className="text-yzi-muted">
                  Join as an Early Partner and get access to verified, skilled
                  talent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90">
          <div className="bg-yzi-card border border-white/10 rounded-2xl p-8 w-full max-w-md mx-4 text-center">

            {!isVerified ? (
              <>
                <h3 className="text-xl font-bold mb-2">
                  Verify WhatsApp Number
                </h3>

                <p className="text-yzi-muted text-sm mb-6">
                  OTP will be sent to your registered WhatsApp number
                </p>

                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-lg font-medium">
                    +91 {formData.phone}
                  </span>
                  <button className="text-yzi-cyan text-sm underline">
                    Edit
                  </button>
                </div>

                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength="6"
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-4 focus:outline-none focus:border-yzi-purple"
                />

                <button
                  onClick={handleVerifyOtp}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold mb-3"
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
                    <button
                      onClick={startTimer}
                      className="text-yzi-cyan underline"
                    >
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

                <h3 className="text-xl font-bold mb-2">
                  You are Verified!
                </h3>

                <p className="text-yzi-muted mb-6">
                  Thank you. Our team will contact you soon.
                </p>

                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-yzi-purple to-yzi-blue font-semibold"
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

export default EarlyPartnersForm