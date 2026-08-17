function escapeHtml(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method not allowed'
      })
    }
  }

  try {
    const {
      name,
      email,
      phone,
      subject,
      message
    } = JSON.parse(event.body || '{}')

    const cleanName = String(name || '').trim()
    const cleanEmail = String(email || '').trim()
    const cleanPhone = String(phone || '').trim()
    const cleanSubject = String(subject || '').trim()
    const cleanMessage = String(message || '').trim()

    if (
      !cleanName ||
      !cleanEmail ||
      !cleanPhone ||
      !cleanSubject ||
      !cleanMessage
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'All fields are required'
        })
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Please provide a valid email address'
        })
      }
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Please provide a valid 10-digit Indian phone number'
        })
      }
    }

    if (cleanName.length > 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Name is too long'
        })
      }
    }

    if (cleanSubject.length > 150) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Subject is too long'
        })
      }
    }

    if (cleanMessage.length > 3000) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Message is too long'
        })
      }
    }

    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium'
    })

    const response = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          from: 'YZI Works <onboarding@resend.dev>',

          to: ['admin@youngzoneindia.com'],

          reply_to: cleanEmail,

          subject: `Contact Form: ${cleanSubject}`,

          html: `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">

              <p style="font-size: 16px; margin-top: 0;">
                Hii Team,
              </p>

              <p style="color: #A1A1AA; margin: 15px 0 25px;">
                New contact form submission received on YZI Works.
              </p>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">

                <tr>
                  <td style="padding: 10px 0; color: #A1A1AA; width: 150px; vertical-align: top;">
                    Name
                  </td>
                  <td style="padding: 10px 0; color: #ffffff;">
                    ${escapeHtml(cleanName)}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #A1A1AA; vertical-align: top;">
                    Email
                  </td>
                  <td style="padding: 10px 0;">
                    <a
                      href="mailto:${escapeHtml(cleanEmail)}"
                      style="color: #FF7A45; text-decoration: none;"
                    >
                      ${escapeHtml(cleanEmail)}
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #A1A1AA; vertical-align: top;">
                    Phone / WhatsApp
                  </td>
                  <td style="padding: 10px 0; color: #ffffff;">
                    <a
                      href="tel:+91${escapeHtml(cleanPhone)}"
                      style="color: #ffffff; text-decoration: none;"
                    >
                      +91 ${escapeHtml(cleanPhone)}
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #A1A1AA; vertical-align: top;">
                    Subject
                  </td>
                  <td style="padding: 10px 0; color: #ffffff;">
                    ${escapeHtml(cleanSubject)}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #A1A1AA; vertical-align: top;">
                    Submitted
                  </td>
                  <td style="padding: 10px 0; color: #ffffff;">
                    ${escapeHtml(submittedAt)} IST
                  </td>
                </tr>

              </table>

              <div style="margin-top: 25px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">

                <p style="margin: 0 0 10px; color: #A1A1AA; font-size: 13px;">
                  Message
                </p>

                <p style="margin: 0; color: #ffffff; line-height: 1.7; white-space: pre-wrap;">
                  ${escapeHtml(cleanMessage)}
                </p>

              </div>

              <div style="margin-top: 25px; padding: 15px 18px; background: #11111D; border-radius: 10px;">

                <p style="margin: 0; color: #71717A; font-size: 12px; line-height: 1.6;">
                  Reply-To:
                  <span style="color: #A1A1AA;">
                    ${escapeHtml(cleanEmail)}
                  </span>
                </p>

              </div>

              <p style="margin-top: 30px;">

                Thank you<br/>

                <strong style="color: #FF5E00;">
                  SERA
                </strong>
                <br/>

                <span style="color: #A1A1AA; font-size: 13px;">
                  Young Zone India Works
                </span>

              </p>

            </div>
          `
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend Error:', data)

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send email'
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
        message: 'Message sent successfully'
      })
    }
  } catch (error) {
    console.error('Contact function error:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server error'
      })
    }
  }
}