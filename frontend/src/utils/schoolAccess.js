export const SCHOOL_EMAIL_DOMAIN = 'spcba.edu.ph';
export const ADMIN_AUTH_EMAIL = 'admin@iterview.invalid';

export function isSchoolEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@spcba\.edu\.ph$/i.test(email.trim());
}

export function schoolAccessStatus(user) {
  if (!user) return 'signed-out';
  if (!isSchoolEmail(user.email)) return 'wrong-school';
  if (!user.emailVerified) return 'verify';
  return 'ready';
}
