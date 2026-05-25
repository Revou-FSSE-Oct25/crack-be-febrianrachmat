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

  it('exportTransactionsCsv builds CSV with header row', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        bookingId: null,
        consultationId: 'c1',
        patientId: 'p1',
        amount: { toString: () => '99000' },
        paymentMethod: 'BANK_TRANSFER',
        status: TransactionStatus.PAID,
        paymentProofUrl: 'https://example.com/proof.png',
        createdAt: new Date('2099-01-01T10:00:00Z'),
        paidAt: new Date('2099-01-02T10:00:00Z'),
        patient: {
          user: { fullName: 'Pasien A', email: 'a@test.local' },
        },
        booking: null,
        consultation: {
          id: 'c1',
          complaint: 'Nyeri punggung',
          status: 'COMPLETED',
        },
      },
    ]);

    const result = await service.exportTransactionsCsv({
      status: TransactionStatus.PAID,
    });

    expect(result.rowCount).toBe(1);
    expect(result.filename).toContain('transactions-export-paid');
    expect(result.csv).toContain('id,status,amount');
    expect(result.csv).toContain('tx-1');
    expect(result.csv).toContain('Pasien A');
  });

  it('exportBookingsCsv builds CSV with therapist column', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'CONFIRMED',
        appointmentType: 'HOME_VISIT',
        appointmentDate: new Date('2099-03-01T08:00:00Z'),
        visitFeeSnapshot: { toString: () => '200000' },
        homeVisitAddress: 'Jl. Demo 1',
        clinicAddress: null,
        notes: null,
        createdAt: new Date('2099-02-01T08:00:00Z'),
        patientId: 'p1',
        physiotherapistId: 'pt1',
        patient: {
          user: { fullName: 'Pasien B', email: 'b@test.local' },
        },
        physiotherapist: {
          user: { fullName: 'Fisio Demo' },
        },
      },
    ]);

    const result = await service.exportBookingsCsv({});

    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('physiotherapistName');
    expect(result.csv).toContain('Fisio Demo');
    expect(result.csv).toContain('HOME_VISIT');
  });
});
