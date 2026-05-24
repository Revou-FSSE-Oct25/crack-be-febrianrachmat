import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Throttle } from '@nestjs/throttler';

import { Request } from 'express';

import { AuthUser } from '../common/types/auth-user.type';

import { Public } from './decorators/public.decorator';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';

import { RegisterDto } from './dto/register.dto';



@ApiTags('Auth')

@Controller('auth')

export class AuthController {

  constructor(private readonly authService: AuthService) {}



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



  @Get('me')

  @ApiBearerAuth('access-token')

  @ApiOperation({ summary: 'Get current authenticated JWT payload' })

  getCurrentUser(@Req() req: Request) {

    return req.user as AuthUser;

  }

}


