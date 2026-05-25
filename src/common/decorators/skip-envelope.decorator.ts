import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/** Bypass global `{ success, data }` wrapper (SSE, raw streams). */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
