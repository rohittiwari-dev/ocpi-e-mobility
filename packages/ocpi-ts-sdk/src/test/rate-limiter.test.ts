import { describe, expect, it, vi } from "vitest";
import { PartnerRateLimiter } from "../client/rate-limiter.js";

describe("PartnerRateLimiter", () => {
  it("starts not limited", () => {
    const limiter = new PartnerRateLimiter();
    expect(limiter.isLimited()).toBe(false);
    expect(limiter.isNearLimit()).toBe(false);
    expect(limiter.getRemainingCount()).toBeNull();
  });

  it("parses X-Limit-Remaining and X-Limit headers", () => {
    const limiter = new PartnerRateLimiter();
    const headers = new Headers({
      "X-Limit-Remaining": "10",
      "X-Limit": "100",
    });
    limiter.updateFromHeaders(headers);
    expect(limiter.getRemainingCount()).toBe(10);
    expect(limiter.isNearLimit()).toBe(false); // 10/100 = 10%, not < 10%
  });

  it("detects near-limit when remaining < 10% of limit", () => {
    const limiter = new PartnerRateLimiter();
    const headers = new Headers({
      "X-Limit-Remaining": "5",
      "X-Limit": "100",
    });
    limiter.updateFromHeaders(headers);
    expect(limiter.isNearLimit()).toBe(true); // 5/100 = 5% < 10%
  });

  it("sets rate-limited state when Retry-After header is present", () => {
    const limiter = new PartnerRateLimiter();
    const headers = new Headers({ "Retry-After": "60" });
    limiter.updateFromHeaders(headers);
    expect(limiter.isLimited()).toBe(true);
  });

  it("clears rate limit after reset time", async () => {
    vi.useFakeTimers();
    const limiter = new PartnerRateLimiter();
    const headers = new Headers({ "Retry-After": "1" }); // 1 second
    limiter.updateFromHeaders(headers);
    expect(limiter.isLimited()).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(limiter.isLimited()).toBe(false);
    vi.useRealTimers();
  });

  it("waitForSlot resolves immediately when not limited", async () => {
    const limiter = new PartnerRateLimiter();
    await expect(limiter.waitForSlot()).resolves.toBeUndefined();
  });

  it("waitForSlot waits until Retry-After is elapsed", async () => {
    vi.useFakeTimers();
    const limiter = new PartnerRateLimiter();
    const headers = new Headers({ "Retry-After": "2" });
    limiter.updateFromHeaders(headers);

    const waitPromise = limiter.waitForSlot();
    vi.advanceTimersByTime(2001);
    await expect(waitPromise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("ignores missing headers gracefully", () => {
    const limiter = new PartnerRateLimiter();
    limiter.updateFromHeaders(new Headers({}));
    expect(limiter.getRemainingCount()).toBeNull();
    expect(limiter.isNearLimit()).toBe(false);
    expect(limiter.isLimited()).toBe(false);
  });
});
