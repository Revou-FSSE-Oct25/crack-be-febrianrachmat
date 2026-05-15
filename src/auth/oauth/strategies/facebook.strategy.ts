import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, Profile } from 'passport-facebook';
import { Request } from 'express';
import { resolveOAuthCallbackUrl } from '../oauth-config';
import { fromFacebookProfile } from '../oauth-profile.mapper';
import { OAuthService } from '../oauth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly oauthService: OAuthService) {
    super({
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: resolveOAuthCallbackUrl('facebook'),
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'displayName', 'name'],
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
      OAuthProvider.FACEBOOK,
      fromFacebookProfile(profile),
      req.query.state as string | undefined,
    );
  }
}
