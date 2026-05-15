import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth('access-token')
@Controller()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Roles(UserRole.PATIENT)
  @Get('patients/me')
  @ApiOperation({ summary: 'Get current patient profile (medical & contact)' })
  getMyProfile(@Req() req: Request) {
    return this.patientsService.getMyProfile(req.user as AuthUser);
  }

  @Roles(UserRole.PATIENT)
  @Patch('patients/me')
  @ApiOperation({ summary: 'Update current patient profile' })
  updateMyProfile(@Req() req: Request, @Body() dto: UpdatePatientProfileDto) {
    return this.patientsService.updateMyProfile(req.user as AuthUser, dto);
  }
}
