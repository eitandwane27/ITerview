export const SCHOOL_EMAIL_DOMAIN = 'spcba.edu.ph';
export const ADMIN_AUTH_EMAIL = 'admin@iterview.invalid';
export const REQUIRE_SCHOOL_EMAIL_VERIFICATION = !(
  import.meta.env?.DEV && import.meta.env.VITE_SKIP_EMAIL_VERIFICATION === 'true'
);

export function isSchoolEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@spcba\.edu\.ph$/i.test(email.trim());
}

export function schoolAccessStatus(user) {
  if (!user) return 'signed-out';
  if (!isSchoolEmail(user.email)) return 'wrong-school';
  if (REQUIRE_SCHOOL_EMAIL_VERIFICATION && !user.emailVerified) return 'verify';
  return 'ready';
}
