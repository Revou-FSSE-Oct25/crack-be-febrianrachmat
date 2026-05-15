import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AllowUnverifiedEmail } from '../auth/decorators/allow-unverified-email.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import {
  avatarDiskStorage,
  avatarFileFilter,
  avatarUploadLimits,
} from './avatar-upload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AllowUnverifiedEmail()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@Req() req: Request) {
    return this.usersService.getMyProfile(req.user as AuthUser);
  }

  @Get('me/activity-summary')
  @ApiOperation({
    summary: 'Activity counts for profile dashboard (role-aware)',
  })
  getMyActivitySummary(@Req() req: Request) {
    return this.usersService.getMyActivitySummary(req.user as AuthUser);
  }

  @Get('me/avatar')
  @ApiOperation({
    summary: 'Stream current user profile photo (auth required)',
  })
  streamMyAvatar(@Req() req: Request, @Res() res: Response) {
    return this.usersService.streamMyAvatar(req.user as AuthUser, res);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile photo (JPEG/PNG/WebP, max 2MB)' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: avatarDiskStorage(),
      fileFilter: avatarFileFilter,
      limits: avatarUploadLimits,
    }),
  )
  uploadAvatar(
    @Req() req: Request,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (!avatar) {
      throw new BadRequestException('File foto profil wajib diunggah.');
    }
    const uploadedPublicPath = `/uploads/avatars/${avatar.filename}`;
    return this.usersService.uploadAvatar(
      req.user as AuthUser,
      uploadedPublicPath,
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMyProfile(@Req() req: Request, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(req.user as AuthUser, dto);
  }

  @Post('me/deactivate')
  @ApiOperation({
    summary: 'Deactivate own account (patient or physiotherapist)',
  })
  deactivateAccount(@Req() req: Request, @Body() dto: DeactivateAccountDto) {
    return this.usersService.deactivateAccount(req.user as AuthUser, dto);
  }

  @Patch('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user as AuthUser, dto);
  }
}
