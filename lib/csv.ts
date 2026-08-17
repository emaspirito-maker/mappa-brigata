import type { Submission } from "./db/schema";

const COLUMNS: { key: keyof Submission; header: string }[] = [
  { key: "id", header: "id" },
  { key: "createdAt", header: "timestamp" },
  { key: "nome", header: "nome" },
  { key: "cognome", header: "cognome" },
  { key: "email", header: "email" },
  { key: "azienda", header: "azienda" },
  { key: "rispostaCuocoDiLinea", header: "risposta_cuoco_di_linea" },
  { key: "rispostaSousChef", header: "risposta_sous_chef" },
  { key: "rispostaChef", header: "risposta_chef" },
  { key: "pillolaGenerata", header: "pillola_generata" },
  { key: "status", header: "status" },
];

function csvField(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function submissionsToCsv(rows: Submission[]): string {
  const header = COLUMNS.map((c) => c.header).join(",");
  const lines = rows.map((row) => COLUMNS.map((c) => csvField(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
