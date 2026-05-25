import { AuditAction, AuditEntityType, UserRole } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prismaMock = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new AuditService(prismaMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' });
    prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it('record persists audit row with actor', async () => {
    await service.record({
      action: AuditAction.TRANSACTION_MARK_PAID,
      entityType: AuditEntityType.TRANSACTION,
      entityId: 'tx-1',
      actor: { sub: 'admin-1', role: UserRole.ADMIN },
      metadata: { patientId: 'p-1' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.TRANSACTION_MARK_PAID,
        entityType: AuditEntityType.TRANSACTION,
        entityId: 'tx-1',
        actorUserId: 'admin-1',
        actorRole: UserRole.ADMIN,
      }),
    });
  });

  it('record swallows prisma errors', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({
        action: AuditAction.TRANSACTION_REFUND,
        entityType: AuditEntityType.TRANSACTION,
        entityId: 'tx-2',
      }),
    ).resolves.toBeUndefined();
  });

  it('listForAdmin returns paginated items', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
    prismaMock.auditLog.count.mockResolvedValue(1);

    const result = await service.listForAdmin({ page: 1, limit: 10 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
