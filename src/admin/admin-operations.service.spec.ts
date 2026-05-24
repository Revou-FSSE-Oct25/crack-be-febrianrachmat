import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOperationsService } from './admin-operations.service';

describe('AdminOperationsService', () => {
  let service: AdminOperationsService;
  const prisma = {
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    physiotherapistProfile: { count: jest.fn() },
    booking: { count: jest.fn(), findMany: jest.fn() },
    consultation: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOperationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AdminOperationsService);
  });

  it('getQueue returns counts and mapped recent transactions', async () => {
    prisma.transaction.count.mockResolvedValue(3);
    prisma.physiotherapistProfile.count.mockResolvedValue(1);
    prisma.booking.count.mockResolvedValue(2);
    prisma.consultation.count.mockResolvedValue(1);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        bookingId: 'b1',
        consultationId: null,
        patientId: 'p1',
        amount: { toString: () => '150000' },
        paymentMethod: 'QRIS',
        status: TransactionStatus.PENDING,
        paymentProofUrl: '/uploads/payment-proofs/x.png',
        createdAt: new Date('2099-01-01T10:00:00Z'),
        paidAt: null,
        patient: {
          user: { fullName: 'Pasien A', email: 'a@test.local' },
        },
        booking: {
          id: 'b1',
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: new Date('2099-01-02T10:00:00Z'),
          status: 'CONFIRMED',
        },
        consultation: null,
      },
    ]);

    const result = await service.getQueue();

    expect(result.counts.pendingTransactions).toBe(3);
    expect(result.recentPendingTransactions).toHaveLength(1);
    expect(result.recentPendingTransactions[0].patient.fullName).toBe('Pasien A');
    expect(result.recentPendingTransactions[0].referenceType).toBe('BOOKING');
    expect(result.recentPendingTransactions[0].hasPaymentProof).toBe(true);
  });
});
