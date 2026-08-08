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

  // Small delay to let the form modal settle
  setTimeout(() => {
    if (typeof window.initSendOTP === 'function') {
      window.initSendOTP(configuration)

      // Force higher z-index for MSG91 popup
      setTimeout(() => {
        const msg91Elements = document.querySelectorAll('[class*="msg91"], [id*="msg91"], [class*="otp"], iframe')
        msg91Elements.forEach(el => {
          el.style.zIndex = '99999'
        })
      }, 800)
    } else {
      onFailure('MSG91 not loaded')
    }
  }, 300)
}
