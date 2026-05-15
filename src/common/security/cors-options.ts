/**
 * `CORS_ORIGINS` — daftar origin yang diizinkan, dipisah koma (tanpa spasi wajib).
 * Kosong = mode dev-friendly (Nest mengizinkan semua origin).
 * Produksi: set ke URL frontend, mis. `https://app.example.com,https://www.example.com`.
 */
export function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  if (!raw) {
    if (isProd) {
      return { origin: false, credentials: true };
    }
    return { origin: true, credentials: true };
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    return { origin: true, credentials: true };
  }
  return { origin: origins, credentials: true };
}
