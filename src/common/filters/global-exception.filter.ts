import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { ERROR_MESSAGE_KEYS } from '../errors/error-message-keys';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : undefined;
    const errorCode = this.extractErrorCode(exceptionResponse);

    const fallbackMessage =
      exception instanceof HttpException
        ? this.extractMessage(exceptionResponse)
        : 'Internal server error';

    const message = this.translateMessage(exceptionResponse, fallbackMessage);

    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: {
        code: status,
        ...(errorCode && { errorCode }),
        message,
        details,
      },
    });
  }

  /**
   * Resolves the response message against the request language. Two paths:
   *  1. Explicit: the thrown error carries an i18n `messageKey` (+ optional
   *     `messageArgs`), e.g. dynamic/templated messages.
   *  2. Implicit: a static in-code message mapped in `ERROR_MESSAGE_KEYS`.
   * The original in-code text is always the `defaultValue`, so the `en`
   * response stays identical when no translation entry exists.
   */
  private translateMessage(
    exceptionResponse: unknown,
    fallbackMessage: string,
  ): string {
    const explicitKey = this.extractMessageKey(exceptionResponse);
    const messageKey = explicitKey ?? ERROR_MESSAGE_KEYS[fallbackMessage];
    if (!messageKey) {
      return fallbackMessage;
    }

    const i18n = I18nContext.current();
    if (!i18n) {
      return fallbackMessage;
    }

    const messageArgs = this.extractMessageArgs(exceptionResponse);
    const translated = i18n.translate(messageKey, {
      defaultValue: fallbackMessage,
      ...(messageArgs ? { args: messageArgs } : {}),
    });

    return typeof translated === 'string' ? translated : fallbackMessage;
  }

  private extractMessageKey(exceptionResponse: unknown): string | undefined {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'messageKey' in exceptionResponse
    ) {
      const value = (exceptionResponse as { messageKey?: unknown }).messageKey;
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
    return undefined;
  }

  private extractMessageArgs(
    exceptionResponse: unknown,
  ): Record<string, unknown> | undefined {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'messageArgs' in exceptionResponse
    ) {
      const value = (exceptionResponse as { messageArgs?: unknown }).messageArgs;
      if (typeof value === 'object' && value !== null) {
        return value as Record<string, unknown>;
      }
    }
    return undefined;
  }

  private extractMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = (exceptionResponse as { message: unknown }).message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    return 'Request failed';
  }

  private extractErrorCode(exceptionResponse: unknown): string | undefined {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'errorCode' in exceptionResponse
    ) {
      const value = (exceptionResponse as { errorCode?: unknown }).errorCode;
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
    return undefined;
  }
}
