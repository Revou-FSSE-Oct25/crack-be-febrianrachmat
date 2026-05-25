import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';
import { PaginationMeta } from '../types/api-response.types';

/**
 * Detects service-layer pagination objects and moves list fields into `data`
 * plus pagination fields into `meta` for a stable frontend contract.
 */
type PaginatedPayload = {
  items: unknown;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function isPaginatedPayload(value: unknown): value is PaginatedPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    'items' in v &&
    'page' in v &&
    'limit' in v &&
    'total' in v &&
    'totalPages' in v &&
    typeof v.page === 'number' &&
    typeof v.limit === 'number' &&
    typeof v.total === 'number' &&
    typeof v.totalPages === 'number'
  );
}

function isAlreadyWrapped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as { success: unknown }).success === true &&
    'data' in value
  );
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipEnvelope) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (isAlreadyWrapped(data)) {
          return data;
        }

        if (data === null || data === undefined) {
          return { success: true as const, data: null };
        }

        if (isPaginatedPayload(data)) {
          const meta: PaginationMeta = {
            page: data.page,
            limit: data.limit,
            total: data.total,
            totalPages: data.totalPages,
          };
          return {
            success: true as const,
            data: data.items,
            meta,
          };
        }

        return { success: true as const, data };
      }),
    );
  }
}
