import { OAuthProvider, UserRole } from '@prisma/client';

export type OAuthProviderId = 'google' | 'apple' | 'github' | 'facebook';

export const OAUTH_PROVIDER_IDS: OAuthProviderId[] = [
  'google',
  'apple',
  'github',
  'facebook',
];

export const OAUTH_PROVIDER_TO_PRISMA: Record<OAuthProviderId, OAuthProvider> =
  {
    google: OAuthProvider.GOOGLE,
    apple: OAuthProvider.APPLE,
    github: OAuthProvider.GITHUB,
    facebook: OAuthProvider.FACEBOOK,
  };

export type OAuthStatePayload = {
  role?: UserRole;
  next?: string;
};

export type NormalizedOAuthProfile = {
  providerAccountId: string;
  email: string | null;
  fullName: string;
};

export type OAuthAuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};
