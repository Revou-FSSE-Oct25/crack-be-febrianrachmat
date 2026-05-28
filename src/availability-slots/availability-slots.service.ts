import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, TherapistVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { ListAvailabilitySlotsQueryDto } from './dto/list-availability-slots-query.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';

@Injectable()
export class AvailabilitySlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMine(authUser: AuthUser, dto: CreateAvailabilitySlotDto) {
    const profile = await this.resolveTherapistProfileOrThrow(authUser);
    const { start, end, slotDateRecord } = this.parseSlotWindow(dto);

    await this.assertNoOverlap(profile.id, start, end, undefined);

    return this.prisma.availabilitySlot.create({
      data: {
        physiotherapistId: profile.id,
        slotDate: slotDateRecord,
        startTime: start,
        endTime: end,
        isAvailable: true,
      },
    });
  }

  async listMine(authUser: AuthUser, query: ListAvailabilitySlotsQueryDto) {
    const profile = await this.resolveTherapistProfileOrThrow(authUser);
    const where = this.buildDateRangeWhere(profile.id, query);

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.availabilitySlot.findMany({
        where,
        orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
        skip,
        take,
      }),
      this.prisma.availabilitySlot.count({ where }),
    ]);

    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      items,
    };
  }

  async updateMine(
    authUser: AuthUser,
    slotId: string,
    dto: UpdateAvailabilitySlotDto,
  ) {
    const profile = await this.resolveTherapistProfileOrThrow(authUser);
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.physiotherapistId !== profile.id) {
      throw new NotFoundException('Availability slot not found.');
    }

    const blocking = await this.slotHasBlockingBooking(slotId);

    const nextSlotDate =
      dto.slotDate ?? slot.slotDate.toISOString().slice(0, 10);
    const nextStart = dto.startTime
      ? new Date(dto.startTime)
      : slot.startTime;
    const nextEnd = dto.endTime ? new Date(dto.endTime) : slot.endTime;

    if (
      dto.slotDate !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined
    ) {
      if (blocking) {
        throw new BadRequestException(
          'Cannot change slot window while an active booking uses this slot.',
        );
      }
      const normalized = this.parseSlotWindow({
        slotDate: nextSlotDate,
        startTime: nextStart.toISOString(),
        endTime: nextEnd.toISOString(),
      });
      await this.assertNoOverlap(
        profile.id,
        normalized.start,
        normalized.end,
        slotId,
      );

      return this.prisma.availabilitySlot.update({
        where: { id: slotId },
        data: {
          slotDate: normalized.slotDateRecord,
          startTime: normalized.start,
          endTime: normalized.end,
          ...(dto.isAvailable !== undefined && {
            isAvailable: dto.isAvailable,
          }),
        },
      });
    }

    if (dto.isAvailable !== undefined) {
      if (dto.isAvailable === true && blocking) {
        throw new BadRequestException(
          'Cannot mark slot available while an active booking uses it.',
        );
      }
      return this.prisma.availabilitySlot.update({
        where: { id: slotId },
        data: { isAvailable: dto.isAvailable },
      });
    }

    return slot;
  }

  async removeMine(authUser: AuthUser, slotId: string) {
    const profile = await this.resolveTherapistProfileOrThrow(authUser);
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: {
        _count: {
          select: {
            bookings: {
              where: { status: { not: BookingStatus.CANCELLED } },
            },
          },
        },
      },
    });

    if (!slot || slot.physiotherapistId !== profile.id) {
      throw new NotFoundException('Availability slot not found.');
    }

    if (slot._count.bookings > 0) {
      throw new BadRequestException(
        'Cannot delete slot with an active (non-cancelled) booking.',
      );
    }

    await this.prisma.availabilitySlot.delete({ where: { id: slotId } });
    return { message: 'Availability slot deleted.' };
  }

  async listForTherapistProfile(
    profileId: string,
    query: ListAvailabilitySlotsQueryDto,
  ) {
    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: profileId },
    });

    if (!therapist) {
      throw new NotFoundException('Physiotherapist not found.');
    }

    if (therapist.verificationStatus !== TherapistVerificationStatus.APPROVED) {
      throw new BadRequestException('Physiotherapist is not approved yet.');
    }

    const now = new Date();
    const where = {
      physiotherapistId: profileId,
      isAvailable: true,
      startTime: { gte: now },
      ...this.buildSlotDateSpanWhere(query),
    };

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.availabilitySlot.findMany({
        where,
        orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
        skip,
        take,
      }),
      this.prisma.availabilitySlot.count({ where }),
    ]);

    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      items,
    };
  }

  private buildDateRangeWhere(
    physiotherapistId: string,
    query: ListAvailabilitySlotsQueryDto,
  ) {
    const span = this.buildSlotDateSpanWhere(query);
    return {
      physiotherapistId,
      ...span,
    };
  }

  private buildSlotDateSpanWhere(query: ListAvailabilitySlotsQueryDto) {
    const filter: { slotDate?: { gte?: Date; lte?: Date } } = {};
    if (query.from) {
      filter.slotDate = {
        ...filter.slotDate,
        gte: new Date(`${query.from.slice(0, 10)}T00:00:00.000Z`),
      };
    }
    if (query.to) {
      filter.slotDate = {
        ...filter.slotDate,
        lte: new Date(`${query.to.slice(0, 10)}T00:00:00.000Z`),
      };
    }
    return filter;
  }

  private async resolveTherapistProfileOrThrow(authUser: AuthUser) {
    const profile = await this.prisma.physiotherapistProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!profile) {
      throw new NotFoundException('Physiotherapist profile not found.');
    }
    return profile;
  }

  private parseSlotWindow(dto: {
    slotDate: string;
    startTime: string;
    endTime: string;
  }) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date/time values.');
    }
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime.');
    }
    if (start.getTime() < Date.now()) {
      throw new BadRequestException(
        'startTime must be in the future for publishable availability.',
      );
    }

    const slotDay = dto.slotDate.slice(0, 10);
    const startDay = start.toISOString().slice(0, 10);
    const endDay = end.toISOString().slice(0, 10);
    if (slotDay !== startDay || slotDay !== endDay) {
      throw new BadRequestException(
        'slotDate must match the UTC calendar day of startTime and endTime.',
      );
    }

    const slotDateRecord = new Date(`${slotDay}T00:00:00.000Z`);
    return { start, end, slotDateRecord };
  }

  private async assertNoOverlap(
    physiotherapistId: string,
    start: Date,
    end: Date,
    excludeSlotId?: string,
  ) {
    const overlap = await this.prisma.availabilitySlot.findFirst({
      where: {
        physiotherapistId,
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (overlap) {
      throw new BadRequestException(
        'Slot overlaps an existing availability window for this therapist.',
      );
    }
  }

  private async slotHasBlockingBooking(slotId: string): Promise<boolean> {
    const count = await this.prisma.booking.count({
      where: {
        slotId,
        status: { not: BookingStatus.CANCELLED },
      },
    });
    return count > 0;
  }
}
