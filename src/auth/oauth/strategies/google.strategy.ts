import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { resolveOAuthCallbackUrl } from '../oauth-config';
import { fromGoogleProfile } from '../oauth-profile.mapper';
import { OAuthService } from '../oauth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly oauthService: OAuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: resolveOAuthCallbackUrl('google'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    return this.oauthService.signInFromOAuthProfile(
      OAuthProvider.GOOGLE,
      fromGoogleProfile(profile),
      req.query.state as string | undefined,
    );
  }
}
