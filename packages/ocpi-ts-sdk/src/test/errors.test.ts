import { describe, expect, it } from "vitest";
import {
  OcpiCircuitOpenError,
  OcpiDiscoveryError,
  OcpiError,
  OcpiHttpError,
  OcpiRateLimitError,
  OcpiValidationError,
} from "../client/errors.js";

describe("OcpiError hierarchy", () => {
  describe("OcpiError", () => {
    it("stores statusCode and statusMessage", () => {
      const err = new OcpiError(2001, "Client error");
      expect(err.statusCode).toBe(2001);
      expect(err.statusMessage).toBe("Client error");
      expect(err.name).toBe("OcpiError");
      expect(err.message).toBe("OCPI 2001: Client error");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("OcpiHttpError", () => {
    it("stores httpStatus and extends OcpiError", () => {
      const err = new OcpiHttpError(404, "Not Found");
      expect(err.httpStatus).toBe(404);
      expect(err.name).toBe("OcpiHttpError");
      expect(err).toBeInstanceOf(OcpiError);
    });
  });

  describe("OcpiCircuitOpenError", () => {
    it("formats message with partyId", () => {
      const err = new OcpiCircuitOpenError("CPO1");
      expect(err.message).toContain("CPO1");
      expect(err.name).toBe("OcpiCircuitOpenError");
      expect(err).toBeInstanceOf(OcpiError);
    });
  });

  describe("OcpiRateLimitError", () => {
    it("stores retryAfterMs", () => {
      const err = new OcpiRateLimitError(5000);
      expect(err.retryAfterMs).toBe(5000);
      expect(err.statusCode).toBe(429);
      expect(err.name).toBe("OcpiRateLimitError");
      expect(err).toBeInstanceOf(OcpiError);
    });
  });

  describe("OcpiDiscoveryError", () => {
    it("wraps the discovery failure message", () => {
      const err = new OcpiDiscoveryError("Connection refused");
      expect(err.message).toContain("Connection refused");
      expect(err.name).toBe("OcpiDiscoveryError");
      expect(err).toBeInstanceOf(OcpiError);
    });
  });

  describe("OcpiValidationError", () => {
    it("stores Zod issues and formats message", () => {
      const fakeIssues = [
        {
          message: "Required",
          path: ["id"],
          code: "invalid_type" as const,
          expected: "string",
          received: "undefined",
        },
      ];
      const err = new OcpiValidationError(fakeIssues as never);
      expect(err.issues).toHaveLength(1);
      expect(err.message).toContain("Required");
      expect(err.name).toBe("OcpiValidationError");
      expect(err).toBeInstanceOf(OcpiError);
    });
  });
});
