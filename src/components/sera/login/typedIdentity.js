export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// { name, email } once both look right, else null. The server checks them again.
export function typedIdentityOrNull({ name, email }) {
  const cleanName = name.replace(/\s+/g, ' ').trim()
  const cleanEmail = email.trim().toLowerCase()
  return /\p{L}/u.test(cleanName) && EMAIL_PATTERN.test(cleanEmail) ? { name: cleanName, email: cleanEmail } : null
}
