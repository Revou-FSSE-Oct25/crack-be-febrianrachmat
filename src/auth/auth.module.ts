import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getJwtSecret } from '../common/security/jwt-config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AppleOAuthEnabledGuard,
  AppleOAuthStartGuard,
  FacebookOAuthEnabledGuard,
  FacebookOAuthStartGuard,
  GithubOAuthEnabledGuard,
  GithubOAuthStartGuard,
  GoogleOAuthEnabledGuard,
  GoogleOAuthStartGuard,
} from './oauth/guards/oauth-start.guard';
import { OAuthController } from './oauth/oauth.controller';
import { buildOAuthStrategyProviders } from './oauth/oauth.providers';
import { EmailVerificationService } from './email-verification.service';
import { OAuthService } from './oauth/oauth.service';
import { OAuthStateService } from './oauth/oauth-state.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MailModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    JwtStrategy,
    OAuthService,
    OAuthStateService,
    GoogleOAuthEnabledGuard,
    GoogleOAuthStartGuard,
    GithubOAuthEnabledGuard,
    GithubOAuthStartGuard,
    FacebookOAuthEnabledGuard,
    FacebookOAuthStartGuard,
    AppleOAuthEnabledGuard,
    AppleOAuthStartGuard,
    ...buildOAuthStrategyProviders(),
  ],
  exports: [AuthService],
})
export class AuthModule {}
