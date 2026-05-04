import { UserRole } from '@prisma/client';

export type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};
