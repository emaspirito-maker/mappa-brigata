import { describe, it, expect } from "vitest";
import { checkPin, PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";

describe("checkPin", () => {
  it("accepts a matching PIN", () => {
    expect(checkPin("1234", "1234")).toBe(true);
  });
  it("rejects a non-matching PIN", () => {
    expect(checkPin("0000", "1234")).toBe(false);
  });
  it("trims surrounding whitespace from user input", () => {
    expect(checkPin(" 1234 ", "1234")).toBe(true);
  });
});

describe("PRESENTER_COOKIE_NAME", () => {
  it("is a stable name", () => {
    expect(PRESENTER_COOKIE_NAME).toBe("brigata_presenter");
  });
});
