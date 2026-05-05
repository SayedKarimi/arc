const API_BASE = "https://lifeos-iota-wine.vercel.app";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
