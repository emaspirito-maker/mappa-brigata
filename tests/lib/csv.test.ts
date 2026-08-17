import { describe, it, expect } from "vitest";
import { submissionsToCsv } from "@/lib/csv";
import type { Submission } from "@/lib/db/schema";

function makeRow(overrides: Partial<Submission>): Submission {
  return {
    id: "id-1",
    createdAt: new Date("2026-08-21T10:00:00Z"),
    updatedAt: new Date("2026-08-21T10:00:00Z"),
    sessionId: "sess-1",
    nome: "Mario",
    cognome: "Rossi",
    email: "mario@example.com",
    azienda: "Rossi Store",
    rispostaCuocoDiLinea: "Rispondere alle mail",
    rispostaSousChef: "Controllo, la fattura",
    rispostaChef: "Decido io",
    pillolaGenerata: "Una riflessione.",
    status: "done",
    attemptCount: 0,
    ...overrides,
  };
}

describe("submissionsToCsv", () => {
  it("includes a header row and does not include sessionId", () => {
    const csv = submissionsToCsv([makeRow({})]);
    const header = csv.split("\n")[0];
    expect(header).toContain("nome");
    expect(header).not.toContain("sessionId");
  });

  it("quotes fields containing commas", () => {
    const csv = submissionsToCsv([makeRow({})]);
    expect(csv).toContain('"Controllo, la fattura"');
  });

  it("renders one data row per submission", () => {
    const csv = submissionsToCsv([makeRow({ id: "id-1" }), makeRow({ id: "id-2" })]);
    expect(csv.trim().split("\n")).toHaveLength(3); // header + 2 rows
  });
});
