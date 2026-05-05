/** Pagination metadata shared across list endpoints after interceptor normalization. */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Standard wrapped shape returned by TransformResponseInterceptor for successful HTTP calls. */
export type StandardSuccessResponse<T> =
  | {
      success: true;
      data: T;
      meta?: PaginationMeta;
    }
  | {
      success: true;
      data: null;
      meta?: undefined;
    };
