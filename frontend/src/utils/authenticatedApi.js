import { auth } from '../firebase';
import { apiUrl } from './backendUrl';
import { schoolAccessStatus } from './schoolAccess';

export async function schoolIdToken() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (schoolAccessStatus(user) !== 'ready') {
    throw new Error('Please sign in and verify your SPCBA school email.');
  }
  return user.getIdToken();
}

export async function authenticatedFetch(input, options = {}) {
  const token = await schoolIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(apiUrl(input), { ...options, headers });
}

export async function schoolSocketProtocols() {
  return ['iterview', `auth.${await schoolIdToken()}`];
}
