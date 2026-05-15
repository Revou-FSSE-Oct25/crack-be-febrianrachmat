import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthUser } from '../common/types/auth-user.type';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register patient or physiotherapist account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login and get JWT access token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @ApiOperation({ summary: 'Confirm email address with token from email' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.emailVerification.verifyToken(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.emailVerification.resendForEmail(dto.email);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated JWT payload' })
  getCurrentUser(@Req() req: Request) {
    // The JwtStrategy attaches validated JWT payload to req.user.
    return req.user as AuthUser;
  }
}
