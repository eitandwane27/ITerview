import { sendEmailVerification } from 'firebase/auth';

const COOLDOWN_MS = 60_000;
const sentAt = new Map();
const pending = new Set();

export function verificationWaitSeconds(uid) {
  let timestamp = sentAt.get(uid) || 0;
  try {
    timestamp = Math.max(timestamp, Number(sessionStorage.getItem(`verification:${uid}`)) || 0);
  } catch {
    /* Storage may be disabled. */
  }
  return Math.max(0, Math.ceil((timestamp + COOLDOWN_MS - Date.now()) / 1000));
}

export async function sendSchoolVerification(user) {
  const uid = user.uid;
  if (pending.has(uid) || verificationWaitSeconds(uid)) return false;
  pending.add(uid);
  try {
    await sendEmailVerification(user);
    const timestamp = Date.now();
    sentAt.set(uid, timestamp);
    try {
      sessionStorage.setItem(`verification:${uid}`, String(timestamp));
    } catch {
      /* Memory still enforces the cooldown. */
    }
    return true;
  } finally {
    pending.delete(uid);
  }
}
