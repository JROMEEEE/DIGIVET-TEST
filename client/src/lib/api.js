// In dev, Vite proxies /api → localhost:5001
// In production (Render), calls go directly to the backend service URL
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : '';

export function apiFetch(path, options) {
  return fetch(`${BASE}${path}`, options);
}
