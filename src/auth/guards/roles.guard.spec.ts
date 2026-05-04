import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('allows access when no @Roles metadata', () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflectorMock as never);
    const ctxMock = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: { role: UserRole.ADMIN } }),
      }),
    };

    expect(guard.canActivate(ctxMock as never)).toBe(true);
  });

  it('throws forbidden when user role is not allowed', () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflectorMock as never);
    const ctxMock = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest
          .fn()
          .mockReturnValue({ user: { role: UserRole.PATIENT } }),
      }),
    };

    expect(() => guard.canActivate(ctxMock as never)).toThrow(ForbiddenException);
  });
});
