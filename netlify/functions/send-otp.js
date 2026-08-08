// Temporary OTP storage
const otpStore = global.otpStore || new Map()
global.otpStore = otpStore

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { phone } = JSON.parse(event.body)

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid phone number' })
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Store OTP (valid for 10 minutes)
    otpStore.set(phone, {
      otp,
      expires: Date.now() + 10 * 60 * 1000
    })

    // Send OTP using your approved template
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${phone}`,
          type: 'template',
          template: {
            name: 'youngzoneindia',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: otp
                  }
                ]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  {
                    type: 'text',
                    text: otp
                  }
                ]
              }
            ]
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('WhatsApp Error:', data)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to send OTP', 
          details: data 
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
        message: 'OTP sent successfully' 
      })
    }

  } catch (error) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    }
  }
}