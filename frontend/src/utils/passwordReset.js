import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

const COOLDOWN_MS = 60_000;
const requestedAt = new Map();
const pending = new Set();
const normalizeEmail = (email) => email.trim().toLowerCase();

// This is a UX cooldown. Firebase must still enforce abuse protection itself.
export function passwordResetWaitSeconds(email) {
  const key = normalizeEmail(email);
  let timestamp = requestedAt.get(key) || 0;
  try {
    timestamp = Math.max(timestamp, Number(sessionStorage.getItem(`password-reset:${key}`)) || 0);
  } catch {
    /* Keep the cooldown working when browser storage is unavailable. */
  }
  return Math.max(0, Math.ceil((timestamp + COOLDOWN_MS - Date.now()) / 1000));
}

export async function requestPasswordReset(email) {
  const key = normalizeEmail(email);
  if (pending.has(key) || passwordResetWaitSeconds(key)) return false;
  pending.add(key);
  try {
    try {
      await sendPasswordResetEmail(auth, key);
    } catch (error) {
      // Preserve account privacy even on projects without enumeration protection.
      if (!['auth/user-not-found', 'auth/user-disabled'].includes(error.code)) throw error;
    }
    const timestamp = Date.now();
    requestedAt.set(key, timestamp);
    try {
      sessionStorage.setItem(`password-reset:${key}`, String(timestamp));
    } catch {
      /* The in-memory cooldown still applies. */
    }
    return true;
  } finally {
    pending.delete(key);
  }
}
