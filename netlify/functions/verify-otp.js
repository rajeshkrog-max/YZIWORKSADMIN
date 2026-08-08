export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { phone, otp, reqId, formType, formData } = JSON.parse(event.body)

    if (!phone || !otp || !reqId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Phone, OTP and reqId are required' })
      }
    }

    // 1. Verify OTP with MSG91
    const verifyResponse = await fetch('https://api.msg91.com/api/v5/widget/verifyOtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': process.env.MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        widgetId: process.env.MSG91_WIDGET_ID,
        reqId: reqId,
        otp: otp
      })
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok || verifyData.type === 'error') {
      console.error('MSG91 Verify Error:', verifyData)
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: verifyData.message || 'Invalid OTP' 
        })
      }
    }

    // 2. Send Email Report via Resend (to internal team)
    let subject = ''
    let htmlContent = ''

    if (formType === 'builder') {
      subject = `New Early Builder Application - ${formData.firstName} ${formData.lastName}`
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">
          <p style="color: #ffffff; font-size: 16px;">Hii Team,</p>
          <p style="color: #A1A1AA; margin: 15px 0;">A new Early Builder application has been received on YZI Works.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td><td>${formData.firstName} ${formData.lastName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Age</td><td>${formData.age}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Gender</td><td>${formData.gender}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Qualification</td><td>${formData.qualification}${formData.otherQualification ? ' - ' + formData.otherQualification : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Field</td><td>${formData.field}${formData.otherField ? ' - ' + formData.otherField : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Role</td><td>${formData.role}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Email</td><td>${formData.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Phone</td><td>${formData.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">About</td><td>${formData.about}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Source</td><td>${formData.source}${formData.otherSource ? ' - ' + formData.otherSource : ''}</td></tr>
          </table>
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
          <p style="color: #A1A1AA; margin: 15px 0;">A new Early Partner application has been received on YZI Works.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Name</td><td>${formData.fullName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Role</td><td>${formData.role}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Business</td><td>${formData.businessName}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Business Type</td><td>${formData.businessType}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Industry</td><td>${formData.industry}${formData.otherIndustry ? ' - ' + formData.otherIndustry : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">City</td><td>${formData.city}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Years</td><td>${formData.years}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Talent Need</td><td>${formData.talentNeed}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Email</td><td>${formData.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Phone</td><td>${formData.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Source</td><td>${formData.source}${formData.otherSource ? ' - ' + formData.otherSource : ''}</td></tr>
            <tr><td style="padding: 8px 0; color: #A1A1AA;">Extra</td><td>${formData.anythingElse || '—'}</td></tr>
          </table>
          <p style="margin-top: 30px; color: #ffffff;">
            Thank you<br/>
            <strong style="color: #8B5CF6;">SERA</strong><br/>
            <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
          </p>
        </div>
      `
    }

    // Send email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'YZI Works <onboarding@resend.dev>',
        to: ['admin@youngzoneindia.com'],
        subject: subject,
        html: htmlContent
      })
    })

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