import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { BookingsService } from './bookings.service';
import { CalendarBookingsQueryDto } from './dto/calendar-bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';
import {
  paymentProofDiskStorage,
  paymentProofFileFilter,
  paymentProofUploadLimits,
} from './payment-proof-upload';

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
  @Get('bookings/calendar')
  @ApiOperation({
    summary: 'List bookings in date range for calendar view (current actor)',
  })
  listMyBookingsCalendar(
    @Req() req: Request,
    @Query() query: CalendarBookingsQueryDto,
  ) {
    return this.bookingsService.listMyBookingsCalendar(
      req.user as AuthUser,
      query,
    );
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
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: paymentProofDiskStorage(),
      limits: paymentProofUploadLimits,
      fileFilter: paymentProofFileFilter,
    }),
  )
  @ApiOperation({
    summary:
      'Create pending transaction (patient); lampirkan bukti lewat upload `proof` (gambar) atau `paymentProofUrl` (https)',
  })
  createTransaction(
    @Req() req: Request,
    @Body() dto: CreateTransactionDto,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    let uploadedPublicPath: string | undefined;
    if (proof) {
      uploadedPublicPath = `/uploads/payment-proofs/${proof.filename}`;
    }
    return this.bookingsService.createTransaction(
      req.user as AuthUser,
      dto,
      uploadedPublicPath,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/transactions/:transactionId/pay')
  @ApiOperation({
    summary: 'Confirm pending transaction as paid (admin / system dummy)',
  })
  markPaidByAdmin(@Req() req: Request, @Param('transactionId') transactionId: string) {
    return this.bookingsService.markTransactionPaidByAdmin(
      transactionId,
      req.user as AuthUser,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/transactions/:transactionId/refund')
  @ApiOperation({ summary: 'Refund paid transaction (admin dummy refund)' })
  refund(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Body() dto: RefundTransactionDto,
  ) {
    return this.bookingsService.refundTransactionByAdmin(
      transactionId,
      dto,
      req.user as AuthUser,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT)
  @Get('transactions')
  @ApiOperation({ summary: 'List transactions by current actor' })
  listTransactions(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.bookingsService.listTransactions(req.user as AuthUser, query);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT)
  @Get('transactions/:transactionId/payment-proof')
  @ApiOperation({
    summary:
      'View payment proof (patient owner or admin). Uploaded files require auth; https URLs redirect.',
  })
  streamPaymentProof(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Res() res: Response,
  ) {
    return this.bookingsService.streamPaymentProof(
      req.user as AuthUser,
      transactionId,
      res,
    );
  }
}
