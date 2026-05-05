import { of } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();

  it('wraps plain objects in success envelope', (done) => {
    const next = { handle: () => of({ id: '1' }) };
    const context = {} as never;

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
    const context = {} as never;

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
    const context = {} as never;

    interceptor.intercept(context, next).subscribe((out) => {
      expect(out).toBe(payload);
      done();
    });
  });
});
