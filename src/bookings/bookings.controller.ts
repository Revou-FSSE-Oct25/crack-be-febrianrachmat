import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

@ApiTags('Consultations & Bookings & Transactions')
@ApiBearerAuth('access-token')
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Consultation endpoints
  @Roles(UserRole.PATIENT)
  @Post('consultations')
  @ApiOperation({ summary: 'Create consultation request (patient)' })
  createConsultation(@Req() req: Request, @Body() dto: CreateConsultationDto) {
    return this.bookingsService.createConsultation(req.user as AuthUser, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('consultations/me')
  @ApiOperation({ summary: 'List consultations by current actor' })
  listMyConsultations(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.bookingsService.listMyConsultations(
      req.user as AuthUser,
      query,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Patch('consultations/:consultationId/status')
  @ApiOperation({ summary: 'Update consultation status' })
  updateConsultationStatus(
    @Req() req: Request,
    @Param('consultationId') consultationId: string,
    @Body() dto: UpdateConsultationStatusDto,
  ) {
    return this.bookingsService.updateConsultationStatus(
      req.user as AuthUser,
      consultationId,
      dto,
    );
  }

  // Booking endpoints
  @Roles(UserRole.PATIENT)
  @Post('bookings')
  @ApiOperation({ summary: 'Create booking (patient)' })
  createBooking(@Req() req: Request, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(req.user as AuthUser, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('bookings/me')
  @ApiOperation({ summary: 'List bookings by current actor' })
  listMyBookings(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.bookingsService.listMyBookings(req.user as AuthUser, query);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Patch('bookings/:bookingId/status')
  @ApiOperation({ summary: 'Update booking status' })
  updateBookingStatus(
    @Req() req: Request,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateBookingStatus(
      req.user as AuthUser,
      bookingId,
      dto,
    );
  }

  // Dummy transaction endpoints
  @Roles(UserRole.PATIENT)
  @Post('transactions')
  @ApiOperation({ summary: 'Create pending transaction (patient)' })
  createTransaction(@Req() req: Request, @Body() dto: CreateTransactionDto) {
    return this.bookingsService.createTransaction(req.user as AuthUser, dto);
  }

  @Roles(UserRole.PATIENT)
  @Patch('transactions/:transactionId/pay')
  @ApiOperation({ summary: 'Mark transaction as paid (dummy payment)' })
  markPaid(@Req() req: Request, @Param('transactionId') transactionId: string) {
    return this.bookingsService.markTransactionPaid(
      req.user as AuthUser,
      transactionId,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/transactions/:transactionId/refund')
  @ApiOperation({ summary: 'Refund paid transaction (admin dummy refund)' })
  refund(
    @Param('transactionId') transactionId: string,
    @Body() dto: RefundTransactionDto,
  ) {
    return this.bookingsService.refundTransactionByAdmin(transactionId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT)
  @Get('transactions')
  @ApiOperation({ summary: 'List transactions by current actor' })
  listTransactions(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.bookingsService.listTransactions(req.user as AuthUser, query);
  }
}
