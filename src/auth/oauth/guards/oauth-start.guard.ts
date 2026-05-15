import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { isOAuthProviderEnabled } from '../oauth-config';
import { OAuthStateService } from '../oauth-state.service';
import { OAuthProviderId } from '../oauth.types';

function parseRole(value: unknown): UserRole | undefined {
  if (value === UserRole.PATIENT || value === UserRole.PHYSIOTHERAPIST) {
    return value;
  }
  return undefined;
}

@Injectable()
export class GoogleOAuthEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isOAuthProviderEnabled('google')) {
      throw new NotFoundException('OAuth provider "google" is not configured.');
    }
    return true;
  }
}

@Injectable()
export class GoogleOAuthStartGuard extends AuthGuard('google') {
  constructor(private readonly oauthStateService: OAuthStateService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: this.buildState(context) };
  }

  private buildState(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest<{
      query: { role?: string; next?: string };
    }>();
    return this.oauthStateService.encode({
      role: parseRole(req.query.role),
      next:
        typeof req.query.next === 'string' ? req.query.next : undefined,
    });
  }
}

@Injectable()
export class GithubOAuthEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isOAuthProviderEnabled('github')) {
      throw new NotFoundException('OAuth provider "github" is not configured.');
    }
    return true;
  }
}

@Injectable()
export class GithubOAuthStartGuard extends AuthGuard('github') {
  constructor(private readonly oauthStateService: OAuthStateService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: this.buildState(context) };
  }

  private buildState(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest<{
      query: { role?: string; next?: string };
    }>();
    return this.oauthStateService.encode({
      role: parseRole(req.query.role),
      next:
        typeof req.query.next === 'string' ? req.query.next : undefined,
    });
  }
}

@Injectable()
export class FacebookOAuthEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isOAuthProviderEnabled('facebook')) {
      throw new NotFoundException(
        'OAuth provider "facebook" is not configured.',
      );
    }
    return true;
  }
}

@Injectable()
export class FacebookOAuthStartGuard extends AuthGuard('facebook') {
  constructor(private readonly oauthStateService: OAuthStateService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: this.buildState(context) };
  }

  private buildState(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest<{
      query: { role?: string; next?: string };
    }>();
    return this.oauthStateService.encode({
      role: parseRole(req.query.role),
      next:
        typeof req.query.next === 'string' ? req.query.next : undefined,
    });
  }
}

@Injectable()
export class AppleOAuthEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isOAuthProviderEnabled('apple')) {
      throw new NotFoundException('OAuth provider "apple" is not configured.');
    }
    return true;
  }
}

@Injectable()
export class AppleOAuthStartGuard extends AuthGuard('apple') {
  constructor(private readonly oauthStateService: OAuthStateService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: this.buildState(context) };
  }

  private buildState(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest<{
      query: { role?: string; next?: string };
    }>();
    return this.oauthStateService.encode({
      role: parseRole(req.query.role),
      next:
        typeof req.query.next === 'string' ? req.query.next : undefined,
    });
  }
}

// Kept for tests / typing only
export type { OAuthProviderId };
