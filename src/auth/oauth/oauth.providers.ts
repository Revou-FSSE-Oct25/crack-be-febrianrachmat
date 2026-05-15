import { Provider } from '@nestjs/common';
import { isOAuthProviderEnabled } from './oauth-config';
import { AppleStrategy } from './strategies/apple.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

export function buildOAuthStrategyProviders(): Provider[] {
  const strategies: Provider[] = [];
  if (isOAuthProviderEnabled('google')) {
    strategies.push(GoogleStrategy);
  }
  if (isOAuthProviderEnabled('github')) {
    strategies.push(GithubStrategy);
  }
  if (isOAuthProviderEnabled('facebook')) {
    strategies.push(FacebookStrategy);
  }
  if (isOAuthProviderEnabled('apple')) {
    strategies.push(AppleStrategy);
  }
  return strategies;
}
