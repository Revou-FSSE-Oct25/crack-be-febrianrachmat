import { OAuthProviderId } from './oauth.types';

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function resolveApiPublicUrl(): string {
  const explicit = trimEnv('API_PUBLIC_URL');
  if (explicit) return explicit.replace(/\/$/, '');

  const railwayDomain = trimEnv('RAILWAY_PUBLIC_DOMAIN');
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/\/$/, '')}`;
  }

  const port = trimEnv('PORT') || '3000';
  return `http://localhost:${port}`;
}

export function resolveOAuthCallbackUrl(provider: OAuthProviderId): string {
  const envKey = `${provider.toUpperCase()}_CALLBACK_URL`;
  const explicit = trimEnv(envKey);
  if (explicit) return explicit;

  return `${resolveApiPublicUrl()}/auth/${provider}/callback`;
}

export function isOAuthProviderEnabled(provider: OAuthProviderId): boolean {
  switch (provider) {
    case 'google':
      return Boolean(
        trimEnv('GOOGLE_CLIENT_ID') && trimEnv('GOOGLE_CLIENT_SECRET'),
      );
    case 'github':
      return Boolean(
        trimEnv('GITHUB_CLIENT_ID') && trimEnv('GITHUB_CLIENT_SECRET'),
      );
    case 'facebook':
      return Boolean(
        trimEnv('FACEBOOK_APP_ID') && trimEnv('FACEBOOK_APP_SECRET'),
      );
    case 'apple':
      return Boolean(
        trimEnv('APPLE_CLIENT_ID') &&
          trimEnv('APPLE_TEAM_ID') &&
          trimEnv('APPLE_KEY_ID') &&
          trimEnv('APPLE_PRIVATE_KEY'),
      );
    default:
      return false;
  }
}

export function listEnabledOAuthProviders(): OAuthProviderId[] {
  return (['google', 'apple', 'github', 'facebook'] as OAuthProviderId[]).filter(
    isOAuthProviderEnabled,
  );
}
