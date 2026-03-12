import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../client/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("starts CLOSED and allows attempts", () => {
    const cb = new CircuitBreaker();
    expect(cb.state).toBe("CLOSED");
    expect(cb.canAttempt()).toBe(true);
  });

  it("trips to OPEN after failureThreshold consecutive failures", () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 3 }, onStateChange);

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED");

    cb.recordFailure(); // 3rd — threshold reached
    expect(cb.state).toBe("OPEN");
    expect(onStateChange).toHaveBeenCalledWith("OPEN");
  });

  it("rejects requests when OPEN (within cooldown)", () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 60_000,
    });
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
    expect(cb.canAttempt()).toBe(false);
  });

  it("transitions to HALF_OPEN after cooldown elapsed", () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker(
      { failureThreshold: 1, cooldownMs: 0 },
      onStateChange,
    );
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");

    // cooldownMs=0 so it immediately moves to HALF_OPEN on canAttempt()
    const allowed = cb.canAttempt();
    expect(allowed).toBe(true);
    expect(cb.state).toBe("HALF_OPEN");
    expect(onStateChange).toHaveBeenCalledWith("HALF_OPEN");
  });

  it("returns to CLOSED on success from HALF_OPEN", () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker(
      { failureThreshold: 1, cooldownMs: 0 },
      onStateChange,
    );
    cb.recordFailure();
    cb.canAttempt(); // moves to HALF_OPEN

    cb.recordSuccess();
    expect(cb.state).toBe("CLOSED");
    expect(onStateChange).toHaveBeenCalledWith("CLOSED");
  });

  it("goes back to OPEN on failure from HALF_OPEN", () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker(
      { failureThreshold: 1, cooldownMs: 0 },
      onStateChange,
    );
    cb.recordFailure();
    cb.canAttempt(); // moves to HALF_OPEN
    expect(cb.state).toBe("HALF_OPEN");

    cb.recordFailure(); // probe failed
    expect(cb.state).toBe("OPEN");
  });

  it("recordSuccess resets failure counter and stays CLOSED", () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    // Should still be CLOSED after success reset
    expect(cb.state).toBe("CLOSED");
    // Failures should be reset — need 5 more to open
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED");
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
  });

  it("uses default thresholds when not configured", () => {
    const cb = new CircuitBreaker();
    // Default threshold = 5
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.state).toBe("CLOSED");
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
  });
});
