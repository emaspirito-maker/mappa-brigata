import { describe, it, expect } from "vitest";
import { SESSION_COOKIE_NAME, generateSessionId, isValidSessionId } from "@/lib/session";

describe("session helpers", () => {
  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("brigata_session");
  });

  it("generates a non-empty unique id each call", () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("validates a generated id as valid", () => {
    expect(isValidSessionId(generateSessionId())).toBe(true);
  });

  it("rejects undefined and empty string", () => {
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });
});
