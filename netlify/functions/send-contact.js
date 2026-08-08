// Simple in-memory rate limiting
const rateLimitStore = global.rateLimitStore || new Map()
global.rateLimitStore = rateLimitStore

const MAX_REQUESTS = 3          // max 3 messages
const WINDOW_MS = 10 * 60 * 1000 // in 10 minutes

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Get visitor IP
    const ip = event.headers['x-nf-client-connection-ip'] || 
               event.headers['x-forwarded-for'] || 
               event.headers['client-ip'] || 
               'unknown'

    const now = Date.now()
    const userData = rateLimitStore.get(ip) || { count: 0, firstRequest: now }

    // Reset if window has passed
    if (now - userData.firstRequest > WINDOW_MS) {
      userData.count = 0
      userData.firstRequest = now
    }

    // Check limit
    if (userData.count >= MAX_REQUESTS) {
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          error: 'Too many requests. Please try again after some time.' 
        })
      }
    }

    // Increase count
    userData.count += 1
    rateLimitStore.set(ip, userData)

    // ===== Normal form processing =====
    const { email, message } = JSON.parse(event.body)

    if (!email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and message are required' })
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email address' })
      }
    }

    if (message.length > 300) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is too long' })
      }
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">
        
        <p style="color: #ffffff; font-size: 16px;">Hii Team,</p>
        
        <p style="color: #A1A1AA; margin: 15px 0;">
          A new contact message has been received from the website.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #A1A1AA; width: 100px;">Email</td>
            <td style="padding: 8px 0;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #A1A1AA; vertical-align: top;">Message</td>
            <td style="padding: 8px 0;">${message.replace(/\n/g, '<br/>')}</td>
          </tr>
        </table>

        <p style="margin-top: 30px; color: #ffffff;">
          Thank you<br/>
          <strong style="color: #FF5E00;">SERA</strong><br/>
          <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
        </p>
      </div>
    `

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'YZI Works <onboarding@resend.dev>',
        to: ['admin@youngzoneindia.com'],
        subject: `New Contact Message - ${email}`,
        html: htmlContent
      })
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Resend Error:', emailData)
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