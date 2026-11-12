export const productionBackendUrl = import.meta.env?.PROD
  ? (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '')
  : '';

export function apiUrl(input) {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return `${productionBackendUrl}${input}`;
  }
  return input;
}
