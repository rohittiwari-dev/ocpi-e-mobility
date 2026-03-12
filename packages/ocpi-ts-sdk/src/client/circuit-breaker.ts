/**
 * Three-state circuit breaker for OCPI partner connections.
 *
 * CLOSED  — normal operation, all requests flow through
 * OPEN    — partner is failing, requests rejected immediately (no retry spam)
 * HALF_OPEN — cooldown elapsed, one probe request allowed to test recovery
 *
 * Emits events via a callback so OCPIClient can propagate them as EventEmitter events.
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before tripping to OPEN (default: 5) */
  failureThreshold?: number;
  /** Milliseconds to wait in OPEN before moving to HALF_OPEN (default: 30_000) */
  cooldownMs?: number;
}

export class CircuitBreaker {
  public state: CircuitState = "CLOSED";
  private failures = 0;
  private openedAt: number | null = null;
  private readonly threshold: number;
  private readonly cooldown: number;
  private onStateChange?: (state: CircuitState) => void;

  constructor(
    config?: CircuitBreakerConfig,
    onStateChange?: (state: CircuitState) => void,
  ) {
    this.threshold = config?.failureThreshold ?? 5;
    this.cooldown = config?.cooldownMs ?? 30_000;
    this.onStateChange = onStateChange;
  }

  /**
   * Returns true if a request attempt may proceed.
   * Handles OPEN → HALF_OPEN transition when cooldown has elapsed.
   */
  canAttempt(): boolean {
    if (this.state === "CLOSED") return true;

    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.cooldown) {
        this.transitionTo("HALF_OPEN");
        return true; // allow the probe request
      }
      return false;
    }

    // HALF_OPEN — allow one attempt
    return true;
  }

  /** Call this on a successful response. Resets to CLOSED. */
  recordSuccess(): void {
    this.failures = 0;
    if (this.state !== "CLOSED") {
      this.transitionTo("CLOSED");
    }
  }

  /** Call this on a failed response. Trips to OPEN after threshold is reached. */
  recordFailure(): void {
    this.failures++;
    if (this.state === "HALF_OPEN" || this.failures >= this.threshold) {
      this.openedAt = Date.now();
      this.transitionTo("OPEN");
    }
  }

  private transitionTo(next: CircuitState): void {
    this.state = next;
    this.onStateChange?.(next);
  }
}
