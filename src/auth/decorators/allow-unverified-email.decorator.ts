import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL_KEY = 'allowUnverifiedEmail';

/** Allow JWT access before email is verified (e.g. GET /users/me). */
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL_KEY, true);
