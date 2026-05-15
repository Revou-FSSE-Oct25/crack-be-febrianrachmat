import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { OAuthAuthUser } from './oauth.types';
import { OAuthService } from './oauth.service';
import { OAuthStateService } from './oauth-state.service';
import { AuthGuard } from '@nestjs/passport';
import {
  AppleOAuthEnabledGuard,
  AppleOAuthStartGuard,
  FacebookOAuthEnabledGuard,
  FacebookOAuthStartGuard,
  GithubOAuthEnabledGuard,
  GithubOAuthStartGuard,
  GoogleOAuthEnabledGuard,
  GoogleOAuthStartGuard,
} from './guards/oauth-start.guard';

@ApiTags('Auth')
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly oauthStateService: OAuthStateService,
  ) {}

  @Public()
  @Get('oauth/providers')
  @ApiOperation({ summary: 'List configured OAuth providers' })
  listProviders() {
    return { providers: this.oauthService.getEnabledProviders() };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('google')
  @UseGuards(GoogleOAuthEnabledGuard, GoogleOAuthStartGuard)
  @ApiOperation({ summary: 'Start Google OAuth' })
  googleStart() {
    return;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('github')
  @UseGuards(GithubOAuthEnabledGuard, GithubOAuthStartGuard)
  @ApiOperation({ summary: 'Start GitHub OAuth' })
  githubStart() {
    return;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('facebook')
  @UseGuards(FacebookOAuthEnabledGuard, FacebookOAuthStartGuard)
  @ApiOperation({ summary: 'Start Facebook OAuth' })
  facebookStart() {
    return;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  facebookCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('apple')
  @UseGuards(AppleOAuthEnabledGuard, AppleOAuthStartGuard)
  @ApiOperation({ summary: 'Start Apple OAuth' })
  appleStart() {
    return;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Apple OAuth callback' })
  appleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  private async finishOAuth(req: Request, res: Response) {
    const state = this.oauthStateService.decode(
      req.query.state as string | undefined,
    );
    const next = state.next;

    try {
      const user = req.user as OAuthAuthUser;
      const accessToken = await this.oauthService.issueAccessToken(user);
      const redirectUrl = this.oauthService.buildFrontendCallbackUrl({
        accessToken,
        next,
      });
      return res.redirect(redirectUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'OAuth sign-in failed.';
      const redirectUrl = this.oauthService.buildFrontendCallbackUrl({
        error: message,
        next,
      });
      return res.redirect(redirectUrl);
    }
  }
}
