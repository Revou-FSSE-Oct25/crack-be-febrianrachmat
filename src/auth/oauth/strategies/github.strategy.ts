import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy } from 'passport-github2';
import { Request } from 'express';
import { resolveOAuthCallbackUrl } from '../oauth-config';
import { fromGithubProfile } from '../oauth-profile.mapper';
import { OAuthService } from '../oauth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly oauthService: OAuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: resolveOAuthCallbackUrl('github'),
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      username?: string;
      displayName?: string;
      emails?: { value: string; primary?: boolean }[];
    },
  ) {
    return this.oauthService.signInFromOAuthProfile(
      OAuthProvider.GITHUB,
      fromGithubProfile(profile),
      req.query.state as string | undefined,
    );
  }
}
