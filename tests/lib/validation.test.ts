import { describe, it, expect } from "vitest";
import { isValidEmail, isNonEmpty, MAX_ANSWER_LENGTH } from "@/lib/validation";

describe("isValidEmail", () => {
  it("accepts a standard email", () => {
    expect(isValidEmail("mario.rossi@example.com")).toBe(true);
  });
  it("rejects a string without @", () => {
    expect(isValidEmail("mario.rossi-example.com")).toBe(false);
  });
  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isNonEmpty", () => {
  it("rejects empty string", () => {
    expect(isNonEmpty("")).toBe(false);
  });
  it("rejects whitespace-only string", () => {
    expect(isNonEmpty("   ")).toBe(false);
  });
  it("accepts a string with content, including vague answers", () => {
    expect(isNonEmpty("boh")).toBe(true);
  });
});

describe("MAX_ANSWER_LENGTH", () => {
  it("is 150", () => {
    expect(MAX_ANSWER_LENGTH).toBe(150);
  });
});
