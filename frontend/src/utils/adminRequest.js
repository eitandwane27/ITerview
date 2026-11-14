import { apiUrl } from './backendUrl';

export default async function adminRequest(user, path, options = {}) {
  const token = await user.getIdToken();
  const response = await fetch(apiUrl(`/api/admin${path}`), {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.message || 'Could not reach the server. Try again.');
  return data;
}
