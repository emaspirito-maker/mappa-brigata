import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/lib/ai/prompt";

describe("buildPrompt", () => {
  it("embeds all three answers verbatim in the user message", () => {
    const { user } = buildPrompt({
      cuoco: "Rispondere alle mail dei clienti",
      sousChef: "Controllo la fattura prima di consegnare",
      chef: "Decido io i prezzi speciali",
    });
    expect(user).toContain("Rispondere alle mail dei clienti");
    expect(user).toContain("Controllo la fattura prima di consegnare");
    expect(user).toContain("Decido io i prezzi speciali");
  });

  it("system prompt forbids commercial mentions and quantified promises", () => {
    const { system } = buildPrompt({ cuoco: "x", sousChef: "y", chef: "z" });
    expect(system.toLowerCase()).toContain("mandarino");
    expect(system.toLowerCase()).toContain("percentuali");
  });

  it("handles vague answers without throwing", () => {
    expect(() => buildPrompt({ cuoco: "boh", sousChef: "niente", chef: "boh" })).not.toThrow();
  });
});
