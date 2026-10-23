const SCHOOL_EMAIL_DOMAIN = 'spcba.edu.ph';

class AccessError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isSchoolEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@spcba\.edu\.ph$/i.test(email.trim());
}

async function verifyFirebaseToken(token) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new AccessError(503, 'auth/unconfigured', 'School sign-in is not configured on the server.');
  }
  const { getApps, initializeApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const app = getApps().find((item) => item.name === 'school-auth') ||
    initializeApp({ projectId }, 'school-auth');
  // Signature, issuer, audience and expiry are checked against this project.
  return getAuth(app).verifyIdToken(token);
}

function createSchoolAuth(verifyToken = verifyFirebaseToken) {
  async function authenticate(token) {
    if (!token) throw new AccessError(401, 'auth/required', 'Please sign in with your school email.');
    let identity;
    try {
      identity = await verifyToken(token);
    } catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError(401, 'auth/invalid-token', 'Your session has expired. Please sign in again.');
    }
    if (!identity?.uid || !isSchoolEmail(identity.email)) {
      throw new AccessError(403, 'auth/school-email-required', `Please use your @${SCHOOL_EMAIL_DOMAIN} school email.`);
    }
    if (identity.email_verified !== true) {
      throw new AccessError(403, 'auth/email-unverified', 'Verify your school email before continuing.');
    }
    if (identity.firebase?.sign_in_provider !== 'password') {
      throw new AccessError(403, 'auth/password-required', 'Please sign in using your school email and password.');
    }
    return identity;
  }

  async function requireSchoolUser(req, res, next) {
    try {
      const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
      req.auth = await authenticate(token);
      next();
    } catch (error) {
      res.status(error.status || 401).json({ code: error.code, message: error.message });
    }
  }

  async function authenticateSocket(request) {
    // Browser WebSockets cannot set Authorization. Use a subprotocol so the
    // credential does not appear in URLs, query logs, or browser history.
    const protocols = (request.headers['sec-websocket-protocol'] || '').split(',').map((part) => part.trim());
    const token = protocols.find((part) => part.startsWith('auth.'))?.slice(5);
    request.auth = await authenticate(token);
    const url = new URL(request.url, 'http://localhost');
    if (url.searchParams.has('uid') && url.searchParams.get('uid') !== request.auth.uid) {
      throw new AccessError(403, 'auth/forbidden', 'You can only access your own interview.');
    }
    return request.auth;
  }

  return { authenticate, requireSchoolUser, authenticateSocket };
}

function bindUserIdentity(req, res, next) {
  const identity = req.auth;
  if (!identity) return res.status(401).json({ code: 'auth/required', message: 'Please sign in.' });
  if ((req.body?.firebaseUid && req.body.firebaseUid !== identity.uid) ||
      (req.query.uid && req.query.uid !== identity.uid)) {
    return res.status(403).json({ code: 'auth/forbidden', message: 'You can only access your own account.' });
  }
  // Express 5 exposes query through a getter. Replace it rather than mutating
  // a temporary parsed object. Keep the existing route contracts for callers.
  Object.defineProperty(req, 'query', { value: { ...req.query, uid: identity.uid }, configurable: true });
  req.body = { ...req.body, firebaseUid: identity.uid, email: identity.email };
  next();
}

module.exports = { ...createSchoolAuth(), createSchoolAuth, bindUserIdentity, isSchoolEmail, AccessError };
