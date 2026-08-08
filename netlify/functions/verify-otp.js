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
    const { phone, otp, formType, formData } = JSON.parse(event.body)

    if (!phone || !otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Phone and OTP are required' })
      }
    }

    // Check OTP
    const stored = otpStore.get(phone)

    if (!stored) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OTP expired or not found. Please request again.' })
      }
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(phone)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OTP has expired. Please request a new one.' })
      }
    }

    if (stored.otp !== otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid OTP' })
      }
    }

    // OTP is correct → remove it
    otpStore.delete(phone)

    // ==============================
    // 1. Send Confirmation to User
    // ==============================
    const userMessage = formType === 'builder' 
      ? `Thank you for applying to *YZI Works Early Builders Program*!\n\nWe have received your application. Our team will review it and get back to you soon.\n\n— Team Young Zone India`
      : `Thank you for applying to *YZI Works Early Partners Program*!\n\nWe have received your application. Our team will review it and get back to you soon.\n\n— Team Young Zone India`

    await fetch(
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
          type: 'text',
          text: { body: userMessage }
        })
      }
    )

    // ==============================
    // 2. Send Beautiful Email Report to Internal Team (from SERA)
    // ==============================
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
            <tr><td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td><td style="padding: 8px 0;">${formData.firstName} ${formData.lastName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Age</td><td style="padding: 8px 0;">${formData.age}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Gender</td><td style="padding: 8px 0;">${formData.gender}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Qualification</td><td style="padding: 8px 0;">${formData.qualification}${formData.otherQualification ? ' - ' + formData.otherQualification : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Field</td><td style="padding: 8px 0;">${formData.field}${formData.otherField ? ' - ' + formData.otherField : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Role</td><td style="padding: 8px 0;">${formData.role}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Email</td><td style="padding: 8px 0;">${formData.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Phone</td><td style="padding: 8px 0;">${formData.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">About</td><td style="padding: 8px 0;">${formData.about}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Source</td><td style="padding: 8px 0;">${formData.source}${formData.otherSource ? ' - ' + formData.otherSource : ''}</td></tr>
          </table>

          <p style="color: #A1A1AA; margin-top: 25px;">Please review and take necessary action.</p>

          <p style="margin-top: 30px; color: #ffffff;">
            Thank you<br/>
            <strong style="color: #FF5E00;">SERA</strong><br/>
            <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
          </p>
        </div>
      `
    } else {
      subject = `New Early Partner Application - ${formData.businessName}`
      
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">
          
          <p style="color: #ffffff; font-size: 16px;">Hii Team,</p>
          
          <p style="color: #A1A1AA; margin: 15px 0;">
            A new Early Partner application has been received on YZI Works.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td><td style="padding: 8px 0;">${formData.fullName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Role</td><td style="padding: 8px 0;">${formData.role}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Business</td><td style="padding: 8px 0;">${formData.businessName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Business Type</td><td style="padding: 8px 0;">${formData.businessType}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Industry</td><td style="padding: 8px 0;">${formData.industry}${formData.otherIndustry ? ' - ' + formData.otherIndustry : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">City</td><td style="padding: 8px 0;">${formData.city}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Years</td><td style="padding: 8px 0;">${formData.years}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Talent Need</td><td style="padding: 8px 0;">${formData.talentNeed}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Email</td><td style="padding: 8px 0;">${formData.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Phone</td><td style="padding: 8px 0;">${formData.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Source</td><td style="padding: 8px 0;">${formData.source}${formData.otherSource ? ' - ' + formData.otherSource : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Extra</td><td style="padding: 8px 0;">${formData.anythingElse || '—'}</td></tr>
          </table>

          <p style="color: #A1A1AA; margin-top: 25px;">Please review and take necessary action.</p>

          <p style="margin-top: 30px; color: #ffffff;">
            Thank you<br/>
            <strong style="color: #8B5CF6;">SERA</strong><br/>
            <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
          </p>
        </div>
      `
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'SERA <onboarding@resend.dev>',
        to: [process.env.RESEND_TO_EMAIL || process.env.TEAM_EMAIL || 'team@example.com'],
        subject,
        html: htmlContent
      })
    })

    if (!emailResponse.ok) {
      const emailError = await emailResponse.json()
      console.error('Resend Error:', emailError)
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send internal email',
          details: emailError
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
        message: 'Verified successfully' 
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