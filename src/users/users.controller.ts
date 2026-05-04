import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser } from '../common/types/auth-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@Req() req: Request) {
    return this.usersService.getMyProfile(req.user as AuthUser);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMyProfile(@Req() req: Request, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(req.user as AuthUser, dto);
  }

  @Patch('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user as AuthUser, dto);
  }
}
