export class RateLimitTracker {
  private _remaining: number | null = null;
  private _limit: number | null = null;

  /**
   * Updates the internal trackers based on standard OCPI headers.
   */
  public updateFromResponse(headers: Headers) {
    const limit = headers.get("X-Limit");
    const remaining = headers.get("X-Limit-Remaining");

    if (limit) this._limit = Number.parseInt(limit, 10);
    if (remaining) this._remaining = Number.parseInt(remaining, 10);
  }

  public get remaining(): number | null {
    return this._remaining;
  }

  public get limit(): number | null {
    return this._limit;
  }

  /**
   * Useful for proactively throttling requests before hitting 429.
   * By default, checks if remaining < 5
   */
  public isSeverelyDepleted(threshold = 5): boolean {
    return this._remaining !== null && this._remaining < threshold;
  }
}
