import { describe, expect, it } from "vitest";
import { decide, LIMITS, SITE_KEY, windowOf, type Counter } from "./rate-limit";

const ME = "user_me";
const DAY = 86400;
// 2026-10-06T12:00:30Z: 30 s into a minute, 12 h into the UTC day.
const NOW = Date.UTC(2026, 9, 6, 12, 0, 30) / 1000;

const counter = (key: string, periodS: number, hits: number, windowStart = windowOf(periodS, NOW)): Counter => ({
  key,
  periodS,
  windowStart,
  hits,
});

describe("decide", () => {
  it("allows a first request", () => {
    expect(decide("generate", ME, [], NOW)).toEqual({ ok: true });
  });

  it("blocks at the per-minute burst limit until the minute ends", () => {
    const d = decide("generate", ME, [counter(ME, 60, LIMITS.generate[0].max)], NOW);
    expect(d).toMatchObject({ ok: false, retryAfter: 30 });
    if (!d.ok) expect(d.error).toBe("Too many new Games in a row. Try again in 30 seconds.");
  });

  it("ignores counts from an earlier window", () => {
    const stale = counter(ME, 60, 99, windowOf(60, NOW) - 60);
    expect(decide("generate", ME, [stale], NOW)).toEqual({ ok: true });
  });

  it("blocks at the daily cap until midnight UTC", () => {
    const d = decide("sonar", ME, [counter(ME, DAY, 150)], NOW);
    expect(d).toMatchObject({ ok: false, retryAfter: 12 * 3600 - 30 });
    if (!d.ok) expect(d.error).toBe("You've reached today's limit of 150 messages to Sonar. Try again in 12 hours.");
  });

  it("applies the site-wide cap to everyone", () => {
    const d = decide("generate", ME, [counter(SITE_KEY, DAY, 1000)], NOW);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error).toMatch(/^Syllabyss has reached today's limit/);
  });

  it("reports the longest wait when several limits are hit", () => {
    const d = decide("upload", ME, [counter(ME, 60, 10), counter(ME, DAY, 100)], NOW);
    expect(d).toMatchObject({ ok: false, retryAfter: 12 * 3600 - 30 });
  });

  it("doesn't count another Player's counters", () => {
    expect(decide("generate", ME, [counter("user_other", 60, 99)], NOW)).toEqual({ ok: true });
  });
});
