import { describe, expect, it, vi } from "vitest";
import type { OcpiLogger } from "../logger/index.js";
import {
  defaultConsoleLogger,
  resolveLogger,
  silentLogger,
} from "../logger/index.js";

describe("Logger", () => {
  describe("defaultConsoleLogger", () => {
    it("calls console.debug for trace", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      defaultConsoleLogger.trace("test trace", { foo: 1 });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("calls console.debug for debug", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      defaultConsoleLogger.debug("test debug");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("calls console.info for info", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      defaultConsoleLogger.info("test info");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("calls console.warn for warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      defaultConsoleLogger.warn("test warn");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("calls console.error for error", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      defaultConsoleLogger.error("test error", { detail: "x" });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("silentLogger", () => {
    it("does not throw on any method", () => {
      expect(() => silentLogger.trace("x")).not.toThrow();
      expect(() => silentLogger.debug("x")).not.toThrow();
      expect(() => silentLogger.info("x")).not.toThrow();
      expect(() => silentLogger.warn("x")).not.toThrow();
      expect(() => silentLogger.error("x")).not.toThrow();
    });
  });

  describe("resolveLogger", () => {
    it("returns silentLogger when enabled=false", () => {
      const logger = resolveLogger({ enabled: false }, {});
      expect(logger).toBe(silentLogger);
    });

    it("returns defaultConsoleLogger when no config", () => {
      const logger = resolveLogger(undefined, {});
      // default logger has the same methods
      expect(typeof logger.info).toBe("function");
    });

    it("uses custom logger when provided", () => {
      const custom: OcpiLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const logger = resolveLogger({ logger: custom }, {});
      logger.info("hello");
      expect(custom.info).toHaveBeenCalled();
      expect((custom.info as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
        "hello",
      );
    });

    it("uses child() when logger supports it", () => {
      const childLogger: OcpiLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const parent: OcpiLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnValue(childLogger),
      };
      const logger = resolveLogger({ logger: parent }, { partner: "CPO1" });
      expect(parent.child).toHaveBeenCalledWith({ partner: "CPO1" });
      expect(logger).toBe(childLogger);
    });
  });
});
