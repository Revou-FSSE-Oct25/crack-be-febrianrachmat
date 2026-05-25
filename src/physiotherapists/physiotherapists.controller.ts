import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import { BrowsePhysiotherapistsQueryDto } from './dto/browse-physiotherapists-query.dto';
import { UpdatePhysiotherapistProfileDto } from './dto/update-physiotherapist-profile.dto';
import { VerifyPhysiotherapistDto } from './dto/verify-physiotherapist.dto';
import { PhysiotherapistsService } from './physiotherapists.service';

@ApiTags('Physiotherapists')
@ApiBearerAuth('access-token')
@Controller()
export class PhysiotherapistsController {
  constructor(
    private readonly physiotherapistsService: PhysiotherapistsService,
  ) {}

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists/me')
  @ApiOperation({ summary: 'Get current physiotherapist profile' })
  getMyProfile(@Req() req: Request) {
    return this.physiotherapistsService.getMyProfile(req.user as AuthUser);
  }

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Patch('physiotherapists/me')
  @ApiOperation({ summary: 'Update current physiotherapist profile' })
  updateMyProfile(
    @Req() req: Request,
    @Body() dto: UpdatePhysiotherapistProfileDto,
  ) {
    return this.physiotherapistsService.updateMyProfile(
      req.user as AuthUser,
      dto,
    );
  }

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Post('physiotherapists/me/online')
  @ApiOperation({
    summary:
      'Heartbeat: mark therapist as online for the next few minutes (browse filter)',
  })
  touchOnline(@Req() req: Request) {
    return this.physiotherapistsService.touchMyOnlinePresence(
      req.user as AuthUser,
    );
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN, UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists/:profileId')
  @ApiOperation({ summary: 'Get approved physiotherapist profile by id' })
  getById(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.physiotherapistsService.getApprovedById(profileId);
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN, UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists')
  @ApiOperation({ summary: 'Browse approved physiotherapists' })
  browseApproved(@Query() query: BrowsePhysiotherapistsQueryDto) {
    return this.physiotherapistsService.browseApproved(query);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/physiotherapists/pending')
  @ApiOperation({ summary: 'List pending physiotherapist verifications (admin)' })
  listPending() {
    return this.physiotherapistsService.listPendingForAdmin();
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/physiotherapists/:profileId/verify')
  @ApiOperation({ summary: 'Verify physiotherapist profile (admin)' })
  verify(
    @Req() req: Request,
    @Param('profileId') profileId: string,
    @Body() dto: VerifyPhysiotherapistDto,
  ) {
    return this.physiotherapistsService.verifyByAdmin(
      req.user as AuthUser,
      profileId,
      dto,
    );
  }
}
