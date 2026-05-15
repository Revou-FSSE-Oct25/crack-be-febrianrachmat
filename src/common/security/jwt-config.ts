import { ConfigService } from '@nestjs/config';

const WEAK_SECRETS = new Set([
  'dev-secret-change-me',
  'replace-with-a-strong-secret',
  'physio_booking_2026',
  'ci-test-jwt-secret-min-32-chars-long',
]);

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      throw new Error('JWT_SECRET is required when NODE_ENV=production.');
    }
    return 'dev-secret-change-me';
  }

  if (isProd && (secret.length < 32 || WEAK_SECRETS.has(secret))) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters and not a known default in production.',
    );
  }

  return secret;
}

/**
 * Logs when production is missing CORS_ORIGINS. Does not throw so Railway
 * healthchecks can pass; browser CORS stays locked down via `buildCorsOptions`.
 */
export function assertProductionCorsOrigins(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    // eslint-disable-next-line no-console
    console.warn(
      '[bootstrap] CORS_ORIGINS is unset in production. Set comma-separated frontend URLs (e.g. https://your-app.up.railway.app). Until then, browser cross-origin API calls are blocked.',
    );
  }
}
