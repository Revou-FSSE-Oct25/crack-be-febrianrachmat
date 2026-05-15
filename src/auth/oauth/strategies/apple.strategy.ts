import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy } from 'passport-apple';
import { Request } from 'express';
import { resolveOAuthCallbackUrl } from '../oauth-config';
import { fromAppleProfile } from '../oauth-profile.mapper';
import { OAuthService } from '../oauth.service';

function normalizeApplePrivateKey(): string {
  const raw = process.env.APPLE_PRIVATE_KEY?.trim() ?? '';
  return raw.replace(/\\n/g, '\n');
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private readonly oauthService: OAuthService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID!,
      teamID: process.env.APPLE_TEAM_ID!,
      keyID: process.env.APPLE_KEY_ID!,
      privateKeyString: normalizeApplePrivateKey(),
      callbackURL: resolveOAuthCallbackUrl('apple'),
      scope: ['email', 'name'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    idToken: string,
    profile: {
      id: string;
      email?: string;
      name?: { firstName?: string; lastName?: string };
    },
  ) {
    void idToken;
    return this.oauthService.signInFromOAuthProfile(
      OAuthProvider.APPLE,
      fromAppleProfile(profile),
      req.query.state as string | undefined,
    );
  }
}
