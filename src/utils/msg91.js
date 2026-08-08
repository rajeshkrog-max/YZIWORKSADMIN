export function loadMsg91Script() {
  return new Promise((resolve, reject) => {
    if (window.initSendOTP) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://verify.msg91.com/otp-provider.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load MSG91 script'))
    document.head.appendChild(script)
  })
}

export function openMsg91OTP({ phone, onSuccess, onFailure }) {
  const configuration = {
    widgetId: "3668686c6a66323430333930",
    tokenAuth: "506200T8B2QLCZGd6a77711fP1",
    identifier: `91${phone}`,
    exposeMethods: true,
    success: (data) => {
      console.log('MSG91 success:', data)
      onSuccess(data)
    },
    failure: (error) => {
      console.log('MSG91 failure:', error)
      onFailure(error)
    }
  }

  if (typeof window.initSendOTP === 'function') {
    window.initSendOTP(configuration)
  } else {
    console.error('MSG91 not loaded')
    onFailure('MSG91 not loaded')
  }
}
