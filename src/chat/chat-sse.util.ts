/** Default poll interval for chat SSE (ms). */
export const DEFAULT_CHAT_SSE_POLL_MS = 2500;

const MIN_CHAT_SSE_POLL_MS = 1000;
const MAX_CHAT_SSE_POLL_MS = 15_000;

export function parseChatSsePollMs(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_CHAT_SSE_POLL_MS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    return DEFAULT_CHAT_SSE_POLL_MS;
  }
  return Math.min(MAX_CHAT_SSE_POLL_MS, Math.max(MIN_CHAT_SSE_POLL_MS, n));
}

export function parseSinceCursor(since?: string): Date {
  if (!since) {
    return new Date(0);
  }
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) {
    return new Date(0);
  }
  return d;
}
