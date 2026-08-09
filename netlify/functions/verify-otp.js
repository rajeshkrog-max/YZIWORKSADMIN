const PRIVACY_NOTICE_VERSION = 'v1'

const PRIVACY_CONSENT_TEXT =
  'I agree to the collection and processing of my personal data by Young Zone India for the YZI Works platform as detailed in the Privacy Notice above [DPDPA 2023].'

function escapeHtml(value) {
  if (value === null || value === undefined) return ''

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatConsentTimestamp(timestamp) {
  if (!timestamp) return 'Not provided'

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return 'Invalid timestamp'
  }

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium'
  }) + ' IST'
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { formType, formData } = JSON.parse(event.body)

    if (!formData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Form data is required' })
      }
    }

    if (
      formData.consent !== true ||
      formData.consentVersion !== PRIVACY_NOTICE_VERSION
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Valid privacy consent is required'
        })
      }
    }

    const consentTimestamp = formData.consentTimestamp

    if (!consentTimestamp) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Consent timestamp is required'
        })
      }
    }

    const parsedConsentTimestamp = new Date(consentTimestamp)

    if (Number.isNaN(parsedConsentTimestamp.getTime())) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid consent timestamp'
        })
      }
    }

    const consentReceivedAt = new Date().toISOString()
    const consentVersion = PRIVACY_NOTICE_VERSION
    const consentText = PRIVACY_CONSENT_TEXT

    let subject = ''
    let htmlContent = ''

    if (formType === 'builder') {
      subject = `New Early Builder Application - ${formData.firstName} ${formData.lastName}`

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">

          <p style="color: #ffffff; font-size: 16px;">Hii Team,</p>

          <p style="color: #A1A1AA; margin: 15px 0;">
            A new Early Builder application has been received on YZI Works.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td>
              <td>${escapeHtml(formData.firstName)} ${escapeHtml(formData.lastName)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Age</td>
              <td>${escapeHtml(formData.age)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Gender</td>
              <td>${escapeHtml(formData.gender)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Qualification</td>
              <td>
                ${escapeHtml(formData.qualification)}
                ${formData.otherQualification ? ' - ' + escapeHtml(formData.otherQualification) : ''}
              </td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Field</td>
              <td>
                ${escapeHtml(formData.field)}
                ${formData.otherField ? ' - ' + escapeHtml(formData.otherField) : ''}
              </td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Role</td>
              <td>${escapeHtml(formData.role)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Email</td>
              <td>${escapeHtml(formData.email)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Phone</td>
              <td>${escapeHtml(formData.phone)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">About</td>
              <td>${escapeHtml(formData.about)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Source</td>
              <td>
                ${escapeHtml(formData.source)}
                ${formData.otherSource ? ' - ' + escapeHtml(formData.otherSource) : ''}
              </td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">
            <p style="margin: 0 0 14px; color: #ffffff; font-size: 15px; font-weight: bold;">
              Privacy & Consent Record
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              Consent status:
              <span style="color: #4ADE80;">Granted</span>
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              Privacy Notice version:
              <span style="color: #ffffff;">${escapeHtml(consentVersion)}</span>
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              User consent timestamp:
              <span style="color: #ffffff;">${escapeHtml(formatConsentTimestamp(consentTimestamp))}</span>
            </p>

            <p style="margin: 6px 0 16px; color: #A1A1AA; font-size: 13px;">
              Server receipt timestamp:
              <span style="color: #ffffff;">${escapeHtml(formatConsentTimestamp(consentReceivedAt))}</span>
            </p>

            <p style="margin: 0; color: #71717A; font-size: 12px; line-height: 1.6;">
              ${escapeHtml(consentText)}
            </p>

            <p style="margin: 14px 0 0; color: #71717A; font-size: 12px;">
              Privacy Policy:
              <a href="https://www.youngzoneindia.com/privacy-policy/" style="color: #A1A1AA;">
                https://www.youngzoneindia.com/privacy-policy/
              </a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #ffffff;">
            Thank you<br/>
            <strong style="color: #FF5E00;">SERA</strong><br/>
            <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
          </p>
        </div>
      `
    } else if (formType === 'partner') {
      subject = `New Early Partner Application - ${formData.businessName}`

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">

          <p style="color: #ffffff; font-size: 16px;">Hii Team,</p>

          <p style="color: #A1A1AA; margin: 15px 0;">
            A new Early Partner application has been received on YZI Works.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td>
              <td>${escapeHtml(formData.fullName)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Role</td>
              <td>${escapeHtml(formData.role)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Business</td>
              <td>${escapeHtml(formData.businessName)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Business Type</td>
              <td>${escapeHtml(formData.businessType)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Industry</td>
              <td>
                ${escapeHtml(formData.industry)}
                ${formData.otherIndustry ? ' - ' + escapeHtml(formData.otherIndustry) : ''}
              </td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">City</td>
              <td>${escapeHtml(formData.city)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Years</td>
              <td>${escapeHtml(formData.years)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Talent Need</td>
              <td>${escapeHtml(formData.talentNeed)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Email</td>
              <td>${escapeHtml(formData.email)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Phone</td>
              <td>${escapeHtml(formData.phone)}</td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Source</td>
              <td>
                ${escapeHtml(formData.source)}
                ${formData.otherSource ? ' - ' + escapeHtml(formData.otherSource) : ''}
              </td>
            </tr>

            <tr>
              <td style="padding: 8px 0; color: #A1A1AA;">Extra</td>
              <td>${escapeHtml(formData.anythingElse || '—')}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">
            <p style="margin: 0 0 14px; color: #ffffff; font-size: 15px; font-weight: bold;">
              Privacy & Consent Record
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              Consent status:
              <span style="color: #4ADE80;">Granted</span>
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              Privacy Notice version:
              <span style="color: #ffffff;">${escapeHtml(consentVersion)}</span>
            </p>

            <p style="margin: 6px 0; color: #A1A1AA; font-size: 13px;">
              User consent timestamp:
              <span style="color: #ffffff;">${escapeHtml(formatConsentTimestamp(consentTimestamp))}</span>
            </p>

            <p style="margin: 6px 0 16px; color: #A1A1AA; font-size: 13px;">
              Server receipt timestamp:
              <span style="color: #ffffff;">${escapeHtml(formatConsentTimestamp(consentReceivedAt))}</span>
            </p>

            <p style="margin: 0; color: #71717A; font-size: 12px; line-height: 1.6;">
              ${escapeHtml(consentText)}
            </p>

            <p style="margin: 14px 0 0; color: #71717A; font-size: 12px;">
              Privacy Policy:
              <a href="https://www.youngzoneindia.com/privacy-policy/" style="color: #A1A1AA;">
                https://www.youngzoneindia.com/privacy-policy/
              </a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #ffffff;">
            Thank you<br/>
            <strong style="color: #8B5CF6;">SERA</strong><br/>
            <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
          </p>
        </div>
      `
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid form type'
        })
      }
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'YZI Works <onboarding@resend.dev>',
        to: ['admin@youngzoneindia.com'],
        subject,
        html: htmlContent
      })
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Resend Error:', emailData)

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send email report'
        })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Application saved successfully'
      })
    }
  } catch (error) {
    console.error(error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server error'
      })
    }
  }
}