import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

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
  | 'PASSWORD_UNAVAILABLE'
  | 'INVALID_CREDENTIALS'
  | 'SOCIAL_LOGIN_ONLY'
  | 'ACCOUNT_INACTIVE'
  | 'CONSULTATION_STATE_INVALID'
  | 'BOOKING_STATE_INVALID';

/**
 * Optional i18n hint. When present, the global exception filter resolves
 * `messageKey` against the request language and uses the result as the response
 * message; `message` remains the (English) fallback when no translation exists.
 */
export type ErrorI18n = {
  messageKey?: string;
  messageArgs?: Record<string, unknown>;
};

type ErrorPayload = {
  message: string;
  errorCode: BusinessErrorCode;
  details?: Record<string, unknown>;
  messageKey?: string;
  messageArgs?: Record<string, unknown>;
};

function buildPayload(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
  i18n?: ErrorI18n,
): ErrorPayload {
  return {
    message,
    errorCode,
    ...(details && { details }),
    ...(i18n?.messageKey && { messageKey: i18n.messageKey }),
    ...(i18n?.messageArgs && { messageArgs: i18n.messageArgs }),
  };
}

export function badRequestBusinessError(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
  i18n?: ErrorI18n,
): BadRequestException {
  return new BadRequestException(buildPayload(errorCode, message, details, i18n));
}

export function notFoundBusinessError(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
  i18n?: ErrorI18n,
): NotFoundException {
  return new NotFoundException(buildPayload(errorCode, message, details, i18n));
}

export function unauthorizedBusinessError(
  errorCode: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
  i18n?: ErrorI18n,
): UnauthorizedException {
  return new UnauthorizedException(buildPayload(errorCode, message, details, i18n));
}
