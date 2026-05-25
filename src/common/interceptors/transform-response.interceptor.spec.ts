import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { TransformResponseInterceptor } from './transform-response.interceptor';

describe('TransformResponseInterceptor', () => {
  const reflector = new Reflector();
  const interceptor = new TransformResponseInterceptor(reflector);

  const contextWithSkip = (skip: boolean) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  beforeEach(() => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
  });

  it('bypasses envelope when SkipEnvelope metadata is set', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const payload = { id: '1' };
    const next = { handle: () => of(payload) };

    interceptor.intercept(contextWithSkip(true), next).subscribe((out) => {
      expect(out).toEqual(payload);
      done();
    });
  });

  it('wraps plain objects in success envelope', (done) => {
    const next = { handle: () => of({ id: '1' }) };
    const context = contextWithSkip(false);

    interceptor.intercept(context, next).subscribe((out) => {
      expect(out).toEqual({ success: true, data: { id: '1' } });
      done();
    });
  });

  it('normalizes paginated service results', (done) => {
    const next = {
      handle: () =>
        of({
          items: [{ a: 1 }],
          page: 2,
          limit: 5,
          total: 11,
          totalPages: 3,
        }),
    };
    const context = contextWithSkip(false);

    interceptor.intercept(context, next).subscribe((out) => {
      expect(out).toEqual({
        success: true,
        data: [{ a: 1 }],
        meta: { page: 2, limit: 5, total: 11, totalPages: 3 },
      });
      done();
    });
  });

  it('does not double-wrap already wrapped responses', (done) => {
    const payload = { success: true as const, data: { x: 1 } };
    const next = { handle: () => of(payload) };
    const context = contextWithSkip(false);

    interceptor.intercept(context, next).subscribe((out) => {
      expect(out).toBe(payload);
      done();
    });
  });
});
