import { BadRequestException, NotFoundException } from '@nestjs/common';

export type BusinessErrorCode =
  | 'SLOT_UNAVAILABLE'
  | 'BOOKING_LOCKED'
  | 'INVALID_TIME_WINDOW'
  | 'RESOURCE_NOT_FOUND'
  | 'CHAT_LOCKED'
  | 'REVIEW_DUPLICATE'
  | 'REVIEW_LOCKED'
  | 'TRANSACTION_STATE_INVALID'
  | 'PAYMENT_PROOF_REQUIRED'
  | 'INVALID_FILTER'
  | 'CATEGORY_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'VERIFICATION_INVALID'
  | 'CATEGORY_DUPLICATE'
  | 'CATEGORY_IN_USE'
  | 'PATIENT_PROFILE_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND'
  | 'TARGET_USER_NOT_FOUND'
  | 'REGISTRATION_ROLE_FORBIDDEN'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'OAUTH_CONFIG_MISSING'
  | 'USER_NOT_FOUND'
  | 'AVATAR_NOT_FOUND'
  | 'AVATAR_PATH_INVALID'
  | 'ACCOUNT_STATE_INVALID'
  | 'PASSWORD_CHANGE_INVALID'
  | 'PASSWORD_UNAVAILABLE';

type ErrorPayload = {
  message: string;
  errorCode: BusinessErrorCode;
  details?: Record<string, unknown>;
};

export function badRequestBusinessError(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
): BadRequestException {
  const payload: ErrorPayload = { message, errorCode, ...(details && { details }) };
  return new BadRequestException(payload);
}

export function notFoundBusinessError(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NotFoundException {
  const payload: ErrorPayload = { message, errorCode, ...(details && { details }) };
  return new NotFoundException(payload);
}
