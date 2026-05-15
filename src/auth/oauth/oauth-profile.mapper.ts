import { NormalizedOAuthProfile } from './oauth.types';

type GoogleProfile = {
  id: string;
  emails?: { value: string }[];
  displayName?: string;
  name?: { givenName?: string; familyName?: string };
};

type GithubProfile = {
  id: string;
  username?: string;
  displayName?: string;
  emails?: { value: string; primary?: boolean }[];
};

type FacebookProfile = {
  id: string;
  emails?: { value: string }[];
  displayName?: string;
  name?: { givenName?: string; familyName?: string };
};

type AppleProfile = {
  id: string;
  email?: string;
  name?: { firstName?: string; lastName?: string };
};

function joinName(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ').trim();
}

function pickPrimaryEmail(
  emails: { value: string; primary?: boolean }[] | undefined,
): string | null {
  if (!emails?.length) return null;
  const primary = emails.find((e) => e.primary);
  return (primary ?? emails[0])?.value?.toLowerCase() ?? null;
}

export function fromGoogleProfile(profile: GoogleProfile): NormalizedOAuthProfile {
  const email = pickPrimaryEmail(profile.emails);
  const fullName =
    profile.displayName?.trim() ||
    joinName([profile.name?.givenName, profile.name?.familyName]) ||
    email?.split('@')[0] ||
    'Google User';

  return {
    providerAccountId: profile.id,
    email,
    fullName,
  };
}

export function fromGithubProfile(profile: GithubProfile): NormalizedOAuthProfile {
  const email = pickPrimaryEmail(profile.emails);
  const fullName =
    profile.displayName?.trim() ||
    profile.username ||
    email?.split('@')[0] ||
    'GitHub User';

  return {
    providerAccountId: String(profile.id),
    email,
    fullName,
  };
}

export function fromFacebookProfile(
  profile: FacebookProfile,
): NormalizedOAuthProfile {
  const email = pickPrimaryEmail(profile.emails);
  const fullName =
    profile.displayName?.trim() ||
    joinName([profile.name?.givenName, profile.name?.familyName]) ||
    email?.split('@')[0] ||
    'Facebook User';

  return {
    providerAccountId: profile.id,
    email,
    fullName,
  };
}

export function fromAppleProfile(profile: AppleProfile): NormalizedOAuthProfile {
  const email = profile.email?.toLowerCase() ?? null;
  const fullName =
    joinName([profile.name?.firstName, profile.name?.lastName]) ||
    email?.split('@')[0] ||
    'Apple User';

  return {
    providerAccountId: profile.id,
    email,
    fullName,
  };
}
