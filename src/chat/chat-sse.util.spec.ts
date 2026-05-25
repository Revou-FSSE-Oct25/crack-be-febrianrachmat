import {
  DEFAULT_CHAT_SSE_POLL_MS,
  parseChatSsePollMs,
  parseSinceCursor,
} from './chat-sse.util';

describe('chat-sse.util', () => {
  it('parseChatSsePollMs uses default when unset', () => {
    expect(parseChatSsePollMs(undefined)).toBe(DEFAULT_CHAT_SSE_POLL_MS);
  });

  it('parseChatSsePollMs clamps invalid and bounds', () => {
    expect(parseChatSsePollMs('500')).toBe(1000);
    expect(parseChatSsePollMs('99999')).toBe(15_000);
    expect(parseChatSsePollMs('abc')).toBe(DEFAULT_CHAT_SSE_POLL_MS);
  });

  it('parseSinceCursor falls back to epoch for bad input', () => {
    expect(parseSinceCursor(undefined).getTime()).toBe(0);
    expect(parseSinceCursor('not-a-date').getTime()).toBe(0);
  });

  it('parseSinceCursor parses ISO strings', () => {
    const iso = '2026-05-25T10:00:00.000Z';
    expect(parseSinceCursor(iso).toISOString()).toBe(iso);
  });
});
