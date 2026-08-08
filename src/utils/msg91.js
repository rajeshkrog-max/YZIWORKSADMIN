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
    widgetId: import.meta.env.VITE_MSG91_WIDGET_ID,
    tokenAuth: import.meta.env.VITE_MSG91_TOKEN_AUTH,
    identifier: `91${phone}`,
    exposeMethods: false,          // IMPORTANT: false = show MSG91 popup
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