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

    // MSG91 Send OTP via Widget API
    const response = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': process.env.MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        widgetId: process.env.MSG91_WIDGET_ID,
        identifier: `91${phone}`
      })
    })

    const data = await response.json()

    if (!response.ok || data.type === 'error') {
      console.error('MSG91 Error:', data)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: data.message || 'Failed to send OTP',
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
        message: 'OTP sent successfully',
        reqId: data.message // this is required for verification
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