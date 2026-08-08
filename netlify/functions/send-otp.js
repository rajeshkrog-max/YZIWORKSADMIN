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

    const response = await fetch('https://control.msg91.com/api/v5/widget/sendOtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': process.env.MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        widget_id: process.env.MSG91_WIDGET_ID,
        identifier: `91${phone}`
      })
    })

    const data = await response.json()
    console.log('MSG91 Response:', data)

    if (data.hasError || data.type === 'error' || data.status === 'fail') {
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
        reqId: data.request_id || data.reqId || data.message
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