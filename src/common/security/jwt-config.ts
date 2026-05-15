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

export function assertProductionCorsOrigins(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    throw new Error(
      'CORS_ORIGINS is required when NODE_ENV=production (comma-separated frontend URLs).',
    );
  }
}
