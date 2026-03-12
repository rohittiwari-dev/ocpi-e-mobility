/**
 * Proactive rate limiter — reads X-Limit-Remaining / X-Limit response headers
 * and can queue requests before hitting the 429 limit.
 *
 * This is more efficient than purely reactive retry-on-429 because:
 * - We don't waste a full request trip just to learn we're limited
 * - We can warn the caller early (isNearLimit())
 * - We can delay subsequent requests preemptively (waitForSlot())
 */
export class PartnerRateLimiter {
  private remaining: number | null = null;
  private limit: number | null = null;
  private resetAt: number | null = null; // epoch ms

  /**
   * Call this after every response to keep the limiter state current.
   * Reads X-Limit-Remaining, X-Limit, and Retry-After headers.
   */
  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get("X-Limit-Remaining");
    const limit = headers.get("X-Limit");
    const retryAfter = headers.get("Retry-After");

    if (remaining !== null) this.remaining = Number.parseInt(remaining, 10);
    if (limit !== null) this.limit = Number.parseInt(limit, 10);
    if (retryAfter !== null) {
      this.resetAt = Date.now() + Number.parseInt(retryAfter, 10) * 1000;
    }
  }

  /**
   * Returns true when we are within 10% of the rate limit.
   * Use this to emit 'rateLimitWarning' from OCPIClient.
   */
  isNearLimit(): boolean {
    if (this.remaining === null || this.limit === null) return false;
    return this.remaining / this.limit < 0.1;
  }

  /**
   * Returns true when the partner told us to back off (Retry-After header).
   */
  isLimited(): boolean {
    if (this.resetAt === null) return false;
    return Date.now() < this.resetAt;
  }

  /**
   * If rate-limited, waits until the reset time before resolving.
   * Call this before making a request when isLimited() is true.
   */
  async waitForSlot(): Promise<void> {
    if (!this.isLimited() || this.resetAt === null) return;
    const delay = Math.max(0, this.resetAt - Date.now());
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    this.resetAt = null;
  }

  /** Returns the current remaining request count (for stats/monitoring). */
  getRemainingCount(): number | null {
    return this.remaining;
  }
}
