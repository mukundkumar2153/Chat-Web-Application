// Simple client-side app lock using localStorage PIN storage

const PIN_KEY = 'wavechat_applock_pin'
const SESSION_KEY = 'wavechat_unlocked'

/**
 * Check if app lock is enabled (PIN has been set)
 */
export function isAppLockEnabled() {
  return !!localStorage.getItem(PIN_KEY)
}

/**
 * Check if user already unlocked in this browser session
 */
export function isUnlockedThisSession() {
  return !!sessionStorage.getItem(SESSION_KEY)
}

/**
 * Set session as unlocked (persists until tab/browser closes)
 */
export function markUnlockedThisSession() {
  sessionStorage.setItem(SESSION_KEY, '1')
}

/**
 * Save a new PIN
 */
export function setPin(pin) {
  localStorage.setItem(PIN_KEY, pin)
  markUnlockedThisSession()
}

/**
 * Verify entered PIN against stored PIN
 */
export function verifyPin(pin) {
  const stored = localStorage.getItem(PIN_KEY)
  if (stored === pin) {
    markUnlockedThisSession()
    return true
  }
  return false
}

/**
 * Remove PIN (disable app lock)
 */
export function removePin() {
  localStorage.removeItem(PIN_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

/**
 * Get current PIN (for settings display - masked)
 */
export function getPinMasked() {
  const pin = localStorage.getItem(PIN_KEY)
  return pin ? '••••' : null
}