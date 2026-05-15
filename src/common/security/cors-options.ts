/**
 * `CORS_ORIGINS` — daftar origin yang diizinkan, dipisah koma (tanpa spasi wajib).
 * Fallback: `FRONTEND_URL` (satu origin) jika `CORS_ORIGINS` kosong.
 * Kosong di non-prod = izinkan semua origin (dev).
 */
export function resolveCorsOriginsRaw(): string {
  const explicit = process.env.CORS_ORIGINS?.trim();
  if (explicit) return explicit;
  return process.env.FRONTEND_URL?.trim() ?? '';
}

/**
 * Build NestJS CORS options from environment.
 */
export function buildCorsOptions() {
  const raw = resolveCorsOriginsRaw();
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
