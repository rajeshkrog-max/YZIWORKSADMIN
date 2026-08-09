export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { name, subject, message } = JSON.parse(event.body)

    if (!name || !subject || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'All fields are required' })
      }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'YZI Works <onboarding@resend.dev>',
        to: ['admin@youngzoneindia.com'],
        subject: `Contact Form: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">
            <p style="font-size: 16px;">Hii Team,</p>
            <p style="color: #A1A1AA; margin: 15px 0;">New contact form submission received.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; color: #A1A1AA; width: 120px;">Name</td>
                <td>${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #A1A1AA;">Subject</td>
                <td>${subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #A1A1AA; vertical-align: top;">Message</td>
                <td style="white-space: pre-wrap;">${message}</td>
              </tr>
            </table>

            <p style="margin-top: 30px;">
              Thank you<br/>
              <strong style="color: #FF5E00;">SERA</strong><br/>
              <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
            </p>
          </div>
        `
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend Error:', data)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send email' })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true })
    }

  } catch (error) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    }
  }
}