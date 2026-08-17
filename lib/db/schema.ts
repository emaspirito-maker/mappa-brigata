import { pgTable, uuid, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  sessionId: text("session_id").notNull(),
  nome: text("nome").notNull(),
  cognome: text("cognome").notNull(),
  email: text("email").notNull(),
  azienda: text("azienda").notNull(),
  rispostaCuocoDiLinea: text("risposta_cuoco_di_linea"),
  rispostaSousChef: text("risposta_sous_chef"),
  rispostaChef: text("risposta_chef"),
  pillolaGenerata: text("pillola_generata"),
  status: submissionStatusEnum("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
});

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
