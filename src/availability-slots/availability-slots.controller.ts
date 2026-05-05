import {
  Body,
  Controller,
  Delete,
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
import { AvailabilitySlotsService } from './availability-slots.service';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { ListAvailabilitySlotsQueryDto } from './dto/list-availability-slots-query.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';

@ApiTags('Availability slots')
@ApiBearerAuth('access-token')
@Controller()
export class AvailabilitySlotsController {
  constructor(
    private readonly availabilitySlotsService: AvailabilitySlotsService,
  ) {}

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Post('physiotherapists/me/availability-slots')
  @ApiOperation({ summary: 'Create availability slot for current therapist' })
  createMine(
    @Req() req: Request,
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return this.availabilitySlotsService.createMine(req.user as AuthUser, dto);
  }

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists/me/availability-slots')
  @ApiOperation({
    summary: 'List own availability slots (includes booked/unavailable)',
  })
  listMine(
    @Req() req: Request,
    @Query() query: ListAvailabilitySlotsQueryDto,
  ) {
    return this.availabilitySlotsService.listMine(
      req.user as AuthUser,
      query,
    );
  }

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Patch('physiotherapists/me/availability-slots/:slotId')
  @ApiOperation({ summary: 'Update own availability slot' })
  updateMine(
    @Req() req: Request,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateAvailabilitySlotDto,
  ) {
    return this.availabilitySlotsService.updateMine(
      req.user as AuthUser,
      slotId,
      dto,
    );
  }

  @Roles(UserRole.PHYSIOTHERAPIST)
  @Delete('physiotherapists/me/availability-slots/:slotId')
  @ApiOperation({ summary: 'Delete own availability slot' })
  removeMine(
    @Req() req: Request,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    return this.availabilitySlotsService.removeMine(
      req.user as AuthUser,
      slotId,
    );
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN, UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists/:profileId/availability-slots')
  @ApiOperation({
    summary:
      'List upcoming available slots for an approved physiotherapist (booking)',
  })
  listForProfile(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query() query: ListAvailabilitySlotsQueryDto,
  ) {
    return this.availabilitySlotsService.listForTherapistProfile(
      profileId,
      query,
    );
  }
}
