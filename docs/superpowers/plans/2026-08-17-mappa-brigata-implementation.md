# Mappa la tua Brigata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Mappa la tua Brigata" mini-webapp — a 5-screen mobile flow that collects 3 answers per participant and returns a Claude-generated reflection, plus a PIN-protected presenter view with a live counter and CSV export.

**Architecture:** Next.js 14 App Router on Vercel. Neon Postgres (serverless HTTP driver) via Drizzle ORM. Claude API called server-side only, orchestrated through a single `generatePillola()` function reused by both the live request path and the Vercel Cron retry job. Tailwind CSS themed with Mandarino's design tokens.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Drizzle ORM, `@neondatabase/serverless`, `@anthropic-ai/sdk`, Vitest, `@electric-sql/pglite` (in-memory Postgres for tests).

## Global Constraints

- Deadline: venerdì 2026-08-21.
- Deploy target: Vercel. DB: Neon Postgres. AI: Claude API (Anthropic SDK), server-side only — API key never reaches the client.
- Domande: campo breve, limite visivo ~150 caratteri; nessun campo può restare vuoto (solo controllo non-vuoto, nessuna validazione di "qualità").
- Email: validata solo per formato (regex/standard), nessuna verifica di deliverability.
- Chiamata AI: timeout 10s, 1 retry immediato lato server sul path sincrono. Dopo 2 fallimenti consecutivi visti dal client, niente altro pulsante "Riprova" manuale — l'utente riapre il link più tardi.
- Cron di retry: ogni 1 minuto, riprova submission `status='failed' AND attemptCount < 5`, protetto da header `CRON_SECRET`.
- Poll `/elaborazione`: ogni 1-2s. Poll contatore presenter: ogni 3-5s.
- Nessun invio email in nessun punto del flow (deciso esplicitamente: niente Resend, l'utente ricarica la pagina).
- Nessuna vista pubblica/proiettata dei contenuti; il presenter vede solo contatore aggregato + export, mai il contenuto delle risposte/pillole.
- Brand token (da `brand-assets/colors_and_type.css`): `--color-ink-900:#181a1b`, `--color-ink-500:#6b7280`, `--color-black:#000000`, `--color-orange:#ff3e00` (unico accento), `--color-orange-press:#d63500`, font `Inter` 400/500/600/700, radius 2px (input) / 8px (card) / pill (elementi tondi), nessun gradiente/ombra di default, hairline `#e4e4e7`.
- Env vars richieste: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `PRESENTER_PIN`, `CRON_SECRET`.
- Testing: TDD (Vitest + PGlite in-memory Postgres) per tutta la logica in `lib/` e per le funzioni di orchestrazione. Le pagine React (markup/Server Actions che chiamano funzioni già testate) sono verificate manualmente da dev server/browser, come da sezione "Testing & verifica" del design doc — non si scrivono component test fragili per markup puro.

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.js, vitest.config.ts
vercel.json                          → cron schedule
drizzle.config.ts                    → drizzle-kit config (migrations against Neon)
.env.example
app/
  layout.tsx, globals.css
  registrazione/page.tsx             → form + Server Action
  intro/page.tsx                     → static
  domande/page.tsx                   → client component, one question at a time
  elaborazione/page.tsx              → client component, polls status
  pillola/page.tsx                   → server component, reads final text
  presenter/page.tsx                 → PIN form
  presenter/dashboard/page.tsx       → counter + export button
  api/generate-pillola/route.ts      → POST, triggers generation for a submission
  api/submission-status/route.ts     → GET, polled by /elaborazione
  api/cron/retry-pillole/route.ts    → GET, Vercel Cron target
  api/presenter/login/route.ts       → POST, PIN check
  api/presenter/stats/route.ts       → GET, polled by dashboard
  api/export/route.ts                → GET, CSV, presenter-only
lib/
  validation.ts                      → email format, non-empty checks
  session.ts                         → sessionId cookie helpers
  presenter-auth.ts                  → PIN check + presenter cookie helpers
  csv.ts                             → submissions → CSV string
  db/
    schema.ts                        → Drizzle table + enum
    client.ts                        → createDb(connectionString) for prod (Neon)
    queries.ts                       → createSubmission, saveAnswer, markProcessing,
                                        markDone, markFailed, getBySessionId, getById,
                                        getFailedForRetry, getStats, getAllForExport
  ai/
    prompt.ts                        → buildPrompt(answers) → { system, user }
    client.ts                        → callClaude(prompt, { timeoutMs }) via Anthropic SDK
    generate.ts                      → generatePillola(db, aiClient, submissionId) orchestration
tests/
  helpers/test-db.ts                 → PGlite-backed Drizzle instance for tests
  lib/validation.test.ts
  lib/session.test.ts
  lib/presenter-auth.test.ts
  lib/csv.test.ts
  lib/db/queries.test.ts
  lib/ai/prompt.test.ts
  lib/ai/generate.test.ts
scripts/
  load-test.mjs                      → fires N parallel requests at /api/generate-pillola
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/globals.css`
- Create: `public/logo-mandarino.png`, `public/logo-mandarino-inverse.png` (copy from `brand-assets/`)
- Modify: none

**Interfaces:**
- Produces: Tailwind theme tokens (`brand.ink900`, `brand.ink500`, `brand.black`, `brand.orange`, `brand.orangePress`, `brand.hairline`), usable by every later page task. Font `Inter` loaded globally.

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
```

Answer prompts if asked (accept defaults for anything not covered above).

- [ ] **Step 2: Install remaining dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless @anthropic-ai/sdk
npm install -D drizzle-kit vitest @electric-sql/pglite dotenv
```

- [ ] **Step 3: Copy brand assets into `public/`**

```bash
mkdir -p public
cp brand-assets/logo-mandarino.png public/logo-mandarino.png
cp brand-assets/logo-mandarino-inverse.png public/logo-mandarino-inverse.png
```

- [ ] **Step 4: Configure Tailwind theme with brand tokens**

Edit `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink900: "#181a1b",
          ink500: "#6b7280",
          ink100: "#f4f4f5",
          black: "#000000",
          white: "#ffffff",
          orange: "#ff3e00",
          orangePress: "#d63500",
          hairline: "#e4e4e7",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xs: "2px",
        sm: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Set global styles and font**

Edit `app/globals.css` (replace generated content):

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background: #ffffff;
  color: #181a1b;
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 7: Verify build runs**

Run: `npm run dev` then Ctrl+C once it prints "Ready" (or `npm run build`).
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.js vitest.config.ts app/ public/
git commit -m "Scaffold Next.js app with Tailwind brand tokens and Vitest"
```

---

### Task 2: Validation utilities

**Files:**
- Create: `lib/validation.ts`
- Test: `tests/lib/validation.test.ts`

**Interfaces:**
- Produces: `isValidEmail(value: string): boolean`, `isNonEmpty(value: string): boolean`, `MAX_ANSWER_LENGTH = 150` (const).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/validation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validation'`

- [ ] **Step 3: Implement**

Create `lib/validation.ts`:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_ANSWER_LENGTH = 150;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/lib/validation.test.ts
git commit -m "Add validation utilities for form fields"
```

---

### Task 3: DB schema

**Files:**
- Create: `lib/db/schema.ts`
- Create: `drizzle.config.ts`

**Interfaces:**
- Produces: `submissions` table, `submissionStatusEnum` (`'pending' | 'processing' | 'done' | 'failed'`), and TS type `Submission = typeof submissions.$inferSelect`, `NewSubmission = typeof submissions.$inferInsert`.

- [ ] **Step 1: Write the schema**

Create `lib/db/schema.ts`:

```ts
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
```

Note: the three `risposta*` columns are nullable at the DB level because the row is created at `/registrazione`, before any question is answered (incremental-write decision from the design doc). The app layer enforces non-empty before allowing progression past `/domande`.

- [ ] **Step 2: Create drizzle-kit config**

Create `drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle.config.ts
git commit -m "Add submissions table schema"
```

---

### Task 4: Test DB helper + prod DB client

**Files:**
- Create: `tests/helpers/test-db.ts`
- Create: `lib/db/client.ts`

**Interfaces:**
- Consumes: `submissions`, `submissionStatusEnum` from `lib/db/schema.ts` (Task 3).
- Produces: `createTestDb(): Promise<Db>` (tests only), `createDb(connectionString: string): Db` (prod), shared type `Db`.

- [ ] **Step 1: Implement the PGlite test DB helper**

Create `tests/helpers/test-db.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE TYPE submission_status AS ENUM ('pending', 'processing', 'done', 'failed');
    CREATE TABLE submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      session_id text NOT NULL,
      nome text NOT NULL,
      cognome text NOT NULL,
      email text NOT NULL,
      azienda text NOT NULL,
      risposta_cuoco_di_linea text,
      risposta_sous_chef text,
      risposta_chef text,
      pillola_generata text,
      status submission_status NOT NULL DEFAULT 'pending',
      attempt_count integer NOT NULL DEFAULT 0
    );
  `);

  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
```

PGlite ships without the `pgcrypto` extension enabled by default for `gen_random_uuid()`; if `client.exec` above throws `function gen_random_uuid() does not exist`, replace the `id` default with `uuid_generate_v4()` is not available either — instead generate the id in application code. Handle this in Task 5 by having `createSubmission` accept a pre-generated `crypto.randomUUID()` value rather than relying on the DB default, which also keeps prod (Neon) and test (PGlite) behavior identical.

- [ ] **Step 2: Implement the prod DB client**

Create `lib/db/client.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/test-db.ts lib/db/client.ts
git commit -m "Add PGlite test DB helper and Neon prod DB client"
```

---

### Task 5: DB query functions

**Files:**
- Create: `lib/db/queries.ts`
- Test: `tests/lib/db/queries.test.ts`

**Interfaces:**
- Consumes: `Db` type, `submissions` table (Tasks 3-4), `createTestDb()` (Task 4).
- Produces:
  - `createSubmission(db, input: { nome, cognome, email, azienda, sessionId }): Promise<Submission>`
  - `saveAnswer(db, id: string, field: "cuoco" | "sousChef" | "chef", value: string): Promise<void>`
  - `markProcessing(db, id: string): Promise<void>`
  - `markDone(db, id: string, pillola: string): Promise<void>`
  - `markFailed(db, id: string): Promise<void>` (increments `attemptCount`)
  - `getBySessionId(db, sessionId: string): Promise<Submission | undefined>`
  - `getById(db, id: string): Promise<Submission | undefined>`
  - `getFailedForRetry(db, maxAttempts: number): Promise<Submission[]>`
  - `getStats(db): Promise<{ started: number; done: number }>`
  - `getAllForExport(db): Promise<Submission[]>`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/db/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "@/tests/helpers/test-db";
import {
  createSubmission,
  saveAnswer,
  markProcessing,
  markDone,
  markFailed,
  getBySessionId,
  getById,
  getFailedForRetry,
  getStats,
  getAllForExport,
} from "@/lib/db/queries";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});

describe("createSubmission + getBySessionId", () => {
  it("creates a row retrievable by sessionId", async () => {
    const created = await createSubmission(db, {
      nome: "Mario",
      cognome: "Rossi",
      email: "mario@example.com",
      azienda: "Rossi Store",
      sessionId: "sess-1",
    });
    expect(created.status).toBe("pending");
    expect(created.attemptCount).toBe(0);

    const found = await getBySessionId(db, "sess-1");
    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe("mario@example.com");
  });
});

describe("saveAnswer", () => {
  it("writes each answer field incrementally", async () => {
    const created = await createSubmission(db, {
      nome: "Mario", cognome: "Rossi", email: "mario@example.com",
      azienda: "Rossi Store", sessionId: "sess-2",
    });
    await saveAnswer(db, created.id, "cuoco", "Rispondere alle mail");
    await saveAnswer(db, created.id, "sousChef", "Controllo la fattura");
    await saveAnswer(db, created.id, "chef", "Assumere qualcuno");

    const found = await getById(db, created.id);
    expect(found?.rispostaCuocoDiLinea).toBe("Rispondere alle mail");
    expect(found?.rispostaSousChef).toBe("Controllo la fattura");
    expect(found?.rispostaChef).toBe("Assumere qualcuno");
  });
});

describe("status transitions", () => {
  it("moves pending -> processing -> done", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-3",
    });
    await markProcessing(db, created.id);
    expect((await getById(db, created.id))?.status).toBe("processing");

    await markDone(db, created.id, "La tua pillola.");
    const done = await getById(db, created.id);
    expect(done?.status).toBe("done");
    expect(done?.pillolaGenerata).toBe("La tua pillola.");
  });

  it("increments attemptCount on failure and is retrievable for retry", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-4",
    });
    await markFailed(db, created.id);
    await markFailed(db, created.id);

    const found = await getById(db, created.id);
    expect(found?.status).toBe("failed");
    expect(found?.attemptCount).toBe(2);

    const retryable = await getFailedForRetry(db, 5);
    expect(retryable.map((s) => s.id)).toContain(created.id);
  });

  it("excludes submissions that exceeded max attempts from retry", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-5",
    });
    for (let i = 0; i < 5; i++) await markFailed(db, created.id);

    const retryable = await getFailedForRetry(db, 5);
    expect(retryable.map((s) => s.id)).not.toContain(created.id);
  });
});

describe("getStats", () => {
  it("counts started and done submissions separately", async () => {
    const s1 = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-6",
    });
    await createSubmission(db, {
      nome: "C", cognome: "D", email: "c@example.com", azienda: "Y", sessionId: "sess-7",
    });
    await markDone(db, s1.id, "pillola");

    const stats = await getStats(db);
    expect(stats.started).toBe(2);
    expect(stats.done).toBe(1);
  });
});

describe("getAllForExport", () => {
  it("returns every submission", async () => {
    await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-8",
    });
    await createSubmission(db, {
      nome: "C", cognome: "D", email: "c@example.com", azienda: "Y", sessionId: "sess-9",
    });
    const all = await getAllForExport(db);
    expect(all).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/db/queries.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/queries'`

- [ ] **Step 3: Implement**

Create `lib/db/queries.ts`:

```ts
import { eq, and, lt, count, isNotNull } from "drizzle-orm";
import { submissions, type Submission } from "./schema";
import type { Db } from "./client";

export async function createSubmission(
  db: Db,
  input: { nome: string; cognome: string; email: string; azienda: string; sessionId: string }
): Promise<Submission> {
  const [row] = await db
    .insert(submissions)
    .values({
      id: crypto.randomUUID(),
      nome: input.nome,
      cognome: input.cognome,
      email: input.email,
      azienda: input.azienda,
      sessionId: input.sessionId,
    })
    .returning();
  return row;
}

const ANSWER_FIELD = {
  cuoco: "rispostaCuocoDiLinea",
  sousChef: "rispostaSousChef",
  chef: "rispostaChef",
} as const;

export async function saveAnswer(
  db: Db,
  id: string,
  field: keyof typeof ANSWER_FIELD,
  value: string
): Promise<void> {
  await db
    .update(submissions)
    .set({ [ANSWER_FIELD[field]]: value, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markProcessing(db: Db, id: string): Promise<void> {
  await db
    .update(submissions)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markDone(db: Db, id: string, pillola: string): Promise<void> {
  await db
    .update(submissions)
    .set({ status: "done", pillolaGenerata: pillola, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markFailed(db: Db, id: string): Promise<void> {
  const current = await getById(db, id);
  const nextAttempt = (current?.attemptCount ?? 0) + 1;
  await db
    .update(submissions)
    .set({ status: "failed", attemptCount: nextAttempt, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function getBySessionId(db: Db, sessionId: string): Promise<Submission | undefined> {
  const [row] = await db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  return row;
}

export async function getById(db: Db, id: string): Promise<Submission | undefined> {
  const [row] = await db.select().from(submissions).where(eq(submissions.id, id));
  return row;
}

export async function getFailedForRetry(db: Db, maxAttempts: number): Promise<Submission[]> {
  return db
    .select()
    .from(submissions)
    .where(and(eq(submissions.status, "failed"), lt(submissions.attemptCount, maxAttempts)));
}

export async function getStats(db: Db): Promise<{ started: number; done: number }> {
  const [{ started }] = await db.select({ started: count() }).from(submissions);
  const [{ done }] = await db
    .select({ done: count() })
    .from(submissions)
    .where(eq(submissions.status, "done"));
  return { started: Number(started), done: Number(done) };
}

export async function getAllForExport(db: Db): Promise<Submission[]> {
  return db.select().from(submissions);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/db/queries.test.ts`
Expected: PASS (7 tests). If `crypto.randomUUID` is not defined in the test environment, add `import { randomUUID } from "node:crypto";` at the top of `lib/db/queries.ts` and use `randomUUID()` instead of `crypto.randomUUID()`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries.ts tests/lib/db/queries.test.ts
git commit -m "Add submission query functions with PGlite-backed tests"
```

---

### Task 6: Session cookie helpers

**Files:**
- Create: `lib/session.ts`
- Test: `tests/lib/session.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE_NAME = "brigata_session"`, `generateSessionId(): string`, `isValidSessionId(value: string | undefined): value is string`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/session.ts`:

```ts
export const SESSION_COOKIE_NAME = "brigata_session";

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function isValidSessionId(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/session.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts tests/lib/session.test.ts
git commit -m "Add session cookie helpers"
```

---

### Task 7: AI prompt builder

**Files:**
- Create: `lib/ai/prompt.ts`
- Test: `tests/lib/ai/prompt.test.ts`

**Interfaces:**
- Produces: `buildPrompt(answers: { cuoco: string; sousChef: string; chef: string }): { system: string; user: string }`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/ai/prompt.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/ai/prompt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/ai/prompt.ts`:

```ts
const SYSTEM_PROMPT = `Sei un assistente che aiuta piccoli imprenditori e installatori a riflettere
su quanto delle loro attività quotidiane è ripetitivo e potenzialmente
automatizzabile.

Riceverai 3 risposte di un partecipante a un esercizio in un evento formativo:
1. Un'attività ripetitiva che fa lui o i suoi collaboratori
2. Un controllo che fa sempre prima di consegnare o vendere
3. Una decisione che non delega mai a nessuno

Genera una riflessione di massimo 4 righe che:
- Riprenda in modo naturale almeno un elemento specifico tra quelli scritti
  (se le risposte sono vaghe o generiche, non forzare un riferimento
  specifico: genera comunque una riflessione utile partendo dal concetto
  generale)
- Faccia notare la differenza tra ciò che è ripetitivo (potenzialmente
  automatizzabile) e ciò che richiede giudizio umano (non automatizzabile)
- Chiuda con uno spunto di riflessione sul tempo o denaro che si potrebbe
  risparmiare tenendo sotto controllo le attività ripetitive
- Non usi gergo tecnico, non nomini strumenti specifici, non faccia promesse
  quantificate (niente numeri o percentuali)
- Non menzioni Mandarino, aziende, marchi, vendite, o inviti a contattare qualcuno

Rispondi solo con il testo della riflessione, nessun preambolo.`;

export function buildPrompt(answers: { cuoco: string; sousChef: string; chef: string }) {
  const user = `1. Attività ripetitiva: ${answers.cuoco}
2. Controllo prima di consegnare/vendere: ${answers.sousChef}
3. Decisione mai delegata: ${answers.chef}`;

  return { system: SYSTEM_PROMPT, user };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/ai/prompt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompt.ts tests/lib/ai/prompt.test.ts
git commit -m "Add AI prompt builder"
```

---

### Task 8: AI client wrapper

**Files:**
- Create: `lib/ai/client.ts`
- Test: `tests/lib/ai/client.test.ts`

**Interfaces:**
- Consumes: `{ system, user }` shape from `buildPrompt` (Task 7).
- Produces: `callClaude(anthropicClient, prompt: { system: string; user: string }): Promise<string>` — throws on timeout/error, resolves with the reflection text.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/ai/client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { callClaude } from "@/lib/ai/client";

function fakeAnthropicClient(response: unknown) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(response),
    },
  } as any;
}

describe("callClaude", () => {
  it("returns the text from the first content block", async () => {
    const client = fakeAnthropicClient({
      content: [{ type: "text", text: "La tua riflessione." }],
    });
    const result = await callClaude(client, { system: "sys", user: "usr" });
    expect(result).toBe("La tua riflessione.");
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "sys",
        messages: [{ role: "user", content: "usr" }],
      })
    );
  });

  it("propagates errors from the SDK call", async () => {
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error("network fail")) },
    } as any;
    await expect(callClaude(client, { system: "sys", user: "usr" })).rejects.toThrow("network fail");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/ai/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/ai/client.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";

export async function callClaude(
  client: Anthropic,
  prompt: { system: string; user: string }
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text content returned by Claude");
  }
  return block.text.trim();
}
```

Note: pin the exact model string to whatever the current Claude Sonnet model id is at build time (check `@anthropic-ai/sdk` docs/changelog when implementing — do not assume the id above is still current).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/ai/client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/client.ts tests/lib/ai/client.test.ts
git commit -m "Add Claude API client wrapper"
```

---

### Task 9: generatePillola orchestration

**Files:**
- Create: `lib/ai/generate.ts`
- Test: `tests/lib/ai/generate.test.ts`

**Interfaces:**
- Consumes: `Db`, `getById`, `markProcessing`, `markDone`, `markFailed` (Task 5); `buildPrompt` (Task 7); `callClaude` signature (Task 8).
- Produces: `generatePillola(db: Db, aiClient: Anthropic, submissionId: string): Promise<{ ok: true; pillola: string } | { ok: false }>` — reads the submission's 3 answers, calls Claude with a 10s timeout, retries once immediately on failure/timeout, updates DB status accordingly.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/ai/generate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "@/tests/helpers/test-db";
import { createSubmission, saveAnswer, getById } from "@/lib/db/queries";
import { generatePillola } from "@/lib/ai/generate";
import * as clientModule from "@/lib/ai/client";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  vi.restoreAllMocks();
});

async function seedSubmission(sessionId: string) {
  const s = await createSubmission(db, {
    nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId,
  });
  await saveAnswer(db, s.id, "cuoco", "attivita A");
  await saveAnswer(db, s.id, "sousChef", "controllo B");
  await saveAnswer(db, s.id, "chef", "decisione C");
  return s;
}

describe("generatePillola", () => {
  it("marks the submission done with the generated text on success", async () => {
    const submission = await seedSubmission("sess-ok");
    vi.spyOn(clientModule, "callClaude").mockResolvedValue("Ecco la tua riflessione.");

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: true, pillola: "Ecco la tua riflessione." });
    const row = await getById(db, submission.id);
    expect(row?.status).toBe("done");
    expect(row?.pillolaGenerata).toBe("Ecco la tua riflessione.");
  });

  it("retries once on failure, then succeeds on the second attempt", async () => {
    const submission = await seedSubmission("sess-retry");
    vi.spyOn(clientModule, "callClaude")
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("Seconda prova riuscita.");

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: true, pillola: "Seconda prova riuscita." });
    expect(clientModule.callClaude).toHaveBeenCalledTimes(2);
  });

  it("marks the submission failed after two consecutive failures", async () => {
    const submission = await seedSubmission("sess-fail");
    vi.spyOn(clientModule, "callClaude").mockRejectedValue(new Error("down"));

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: false });
    const row = await getById(db, submission.id);
    expect(row?.status).toBe("failed");
    expect(row?.attemptCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/ai/generate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/ai/generate.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/db/client";
import { getById, markProcessing, markDone, markFailed } from "@/lib/db/queries";
import { buildPrompt } from "./prompt";
import { callClaude } from "./client";

const CALL_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function generatePillola(
  db: Db,
  aiClient: Anthropic,
  submissionId: string
): Promise<{ ok: true; pillola: string } | { ok: false }> {
  const submission = await getById(db, submissionId);
  if (
    !submission ||
    !submission.rispostaCuocoDiLinea ||
    !submission.rispostaSousChef ||
    !submission.rispostaChef
  ) {
    return { ok: false };
  }

  await markProcessing(db, submissionId);

  const prompt = buildPrompt({
    cuoco: submission.rispostaCuocoDiLinea,
    sousChef: submission.rispostaSousChef,
    chef: submission.rispostaChef,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const pillola = await withTimeout(callClaude(aiClient, prompt), CALL_TIMEOUT_MS);
      await markDone(db, submissionId, pillola);
      return { ok: true, pillola };
    } catch {
      // fall through to retry or final failure below
    }
  }

  await markFailed(db, submissionId);
  return { ok: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/ai/generate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/generate.ts tests/lib/ai/generate.test.ts
git commit -m "Add generatePillola orchestration with retry and status tracking"
```

---

### Task 10: /api/generate-pillola route

**Files:**
- Create: `app/api/generate-pillola/route.ts`

**Interfaces:**
- Consumes: `generatePillola` (Task 9), `createDb` (Task 4), env `DATABASE_URL`, `ANTHROPIC_API_KEY`.
- Produces: `POST /api/generate-pillola` — body `{ submissionId: string }`, responds `202` immediately after kicking off generation (fire-and-forget from the caller's perspective; the `/domande` page does not block on this response body, `/elaborazione` polls `/api/submission-status` separately).

- [ ] **Step 1: Implement the route**

Create `app/api/generate-pillola/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createDb } from "@/lib/db/client";
import { generatePillola } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  const { submissionId } = (await req.json()) as { submissionId?: string };
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId required" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Not awaited: the client polls /api/submission-status for the result.
  generatePillola(db, anthropic, submissionId).catch((err) => {
    console.error("generatePillola failed unexpectedly", err);
  });

  return NextResponse.json({ started: true }, { status: 202 });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/api/generate-pillola/route.ts
git commit -m "Add /api/generate-pillola route"
```

---

### Task 11: Registrazione page

**Files:**
- Create: `app/registrazione/page.tsx`

**Interfaces:**
- Consumes: `isValidEmail`, `isNonEmpty` (Task 2); `createSubmission`, `getBySessionId` (Task 5); `createDb` (Task 4); `SESSION_COOKIE_NAME`, `generateSessionId`, `isValidSessionId` (Task 6).
- Produces: `/registrazione` route — on valid submit, sets `SESSION_COOKIE_NAME` cookie and creates a submission row, redirects to `/intro`.

- [ ] **Step 1: Implement the page with a Server Action**

Create `app/registrazione/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/lib/db/client";
import { createSubmission } from "@/lib/db/queries";
import { isValidEmail, isNonEmpty } from "@/lib/validation";
import { SESSION_COOKIE_NAME, generateSessionId } from "@/lib/session";

async function registerAction(formData: FormData) {
  "use server";

  const nome = String(formData.get("nome") ?? "");
  const cognome = String(formData.get("cognome") ?? "");
  const email = String(formData.get("email") ?? "");
  const azienda = String(formData.get("azienda") ?? "");

  if (![nome, cognome, azienda].every(isNonEmpty) || !isValidEmail(email)) {
    redirect("/registrazione?error=1");
  }

  const sessionId = generateSessionId();
  const db = createDb(process.env.DATABASE_URL!);
  await createSubmission(db, { nome, cognome, email, azienda, sessionId });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/intro");
}

export default async function RegistrazionePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <img src="/logo-mandarino.png" alt="Mandarino" className="h-6 w-auto" />
      <h1 className="text-2xl font-semibold text-brand-ink900">Mappa la tua Brigata</h1>
      {error && (
        <p className="text-sm text-red-600">Controlla i campi: sono tutti obbligatori.</p>
      )}
      <form action={registerAction} className="flex flex-col gap-4">
        <input name="nome" placeholder="Nome" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="cognome" placeholder="Cognome" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="email" type="email" placeholder="Email" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="azienda" placeholder="Azienda / Punto vendita" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <button type="submit" className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress">
          Inizia
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/registrazione`.
Expected: submitting with a field empty or a malformed email redirects back with the error message; submitting valid data redirects to `/intro` and sets a `brigata_session` cookie (check DevTools → Application → Cookies).

- [ ] **Step 3: Commit**

```bash
git add app/registrazione/page.tsx
git commit -m "Add registrazione page"
```

---

### Task 12: Intro page

**Files:**
- Create: `app/intro/page.tsx`

**Interfaces:**
- Consumes: none beyond static markup.
- Produces: `/intro` route, static content, CTA to `/domande`.

- [ ] **Step 1: Implement**

Create `app/intro/page.tsx`:

```tsx
import Link from "next/link";

export default function IntroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-ink900">Una brigata, tre ruoli</h1>
      <ul className="flex flex-col gap-4 text-brand-ink900">
        <li><strong>Cuoco di linea</strong> — esegue, ripete, non decide.</li>
        <li><strong>Sous-chef</strong> — controlla, verifica, segnala le anomalie.</li>
        <li><strong>Chef</strong> — decide, valida, si prende la responsabilità finale.</li>
      </ul>
      <Link
        href="/domande"
        className="rounded-sm bg-brand-orange px-6 py-3 text-center font-semibold text-white active:bg-brand-orangePress"
      >
        Continua
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/intro`.
Expected: content renders, "Continua" navigates to `/domande`.

- [ ] **Step 3: Commit**

```bash
git add app/intro/page.tsx
git commit -m "Add intro page"
```

---

### Task 13: Domande page

**Files:**
- Create: `app/domande/page.tsx` (server component, resolves current submission from cookie)
- Create: `app/domande/domande-form.tsx` (client component, one-question-at-a-time UI)
- Create: `app/api/domande/answer/route.ts` (POST, saves one answer; on the third, marks processing and triggers generation)

**Interfaces:**
- Consumes: `getBySessionId`, `saveAnswer`, `markProcessing` (Task 5); `isNonEmpty`, `MAX_ANSWER_LENGTH` (Task 2); `SESSION_COOKIE_NAME` (Task 6); `POST /api/generate-pillola` (Task 10).
- Produces: `/domande` route; `POST /api/domande/answer` — body `{ field: "cuoco"|"sousChef"|"chef", value: string }`, uses the session cookie server-side to resolve which submission to update, returns `{ nextField: string | null }`.

- [ ] **Step 1: Implement the answer-saving route**

Create `app/api/domande/answer/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getBySessionId, saveAnswer, markProcessing } from "@/lib/db/queries";
import { isNonEmpty } from "@/lib/validation";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const FIELD_ORDER = ["cuoco", "sousChef", "chef"] as const;

export async function POST(req: NextRequest) {
  const { field, value } = (await req.json()) as {
    field?: (typeof FIELD_ORDER)[number];
    value?: string;
  };

  if (!field || !FIELD_ORDER.includes(field) || !value || !isNonEmpty(value)) {
    return NextResponse.json({ error: "invalid field or value" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) {
    return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  await saveAnswer(db, submission.id, field, value);

  const currentIndex = FIELD_ORDER.indexOf(field);
  const nextField = FIELD_ORDER[currentIndex + 1] ?? null;

  if (!nextField) {
    await markProcessing(db, submission.id);
    await fetch(new URL("/api/generate-pillola", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: submission.id }),
    });
  }

  return NextResponse.json({ nextField });
}
```

- [ ] **Step 2: Implement the client form**

Create `app/domande/domande-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ANSWER_LENGTH } from "@/lib/validation";

const QUESTIONS = [
  { field: "cuoco" as const, label: "Un'attività ripetitiva che fai (o fanno i tuoi collaboratori) ogni giorno o quasi" },
  { field: "sousChef" as const, label: "Un controllo che fai sempre prima di consegnare o vendere qualcosa" },
  { field: "chef" as const, label: "Una decisione che non deleghi mai a nessuno" },
];

export default function DomandeForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  async function handleNext() {
    if (value.trim().length === 0) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);

    const res = await fetch("/api/domande/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: question.field, value }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(true);
      return;
    }

    if (isLast) {
      router.push("/elaborazione");
      return;
    }
    setStep((s) => s + 1);
    setValue("");
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-brand-ink500">{step + 1}/{QUESTIONS.length}</p>
      <p className="text-lg font-medium text-brand-ink900">{question.label}</p>
      <textarea
        value={value}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-xs border border-brand-hairline px-4 py-3"
        rows={3}
      />
      <p className="text-right text-xs text-brand-ink500">{value.length}/{MAX_ANSWER_LENGTH}</p>
      {error && <p className="text-sm text-red-600">Scrivi qualcosa prima di continuare.</p>}
      <button
        onClick={handleNext}
        disabled={submitting}
        className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress disabled:opacity-50"
      >
        {isLast ? "Invia" : "Avanti"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Implement the page shell**

Create `app/domande/page.tsx`:

```tsx
import DomandeForm from "./domande-form";

export default function DomandePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <DomandeForm />
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, complete `/registrazione` then walk through `/domande`.
Expected: each "Avanti" persists the answer (verify via DB or by reloading mid-flow — the current question's prior answers should already be saved), leaving the textarea empty does not advance, the third answer redirects to `/elaborazione` and triggers `/api/generate-pillola`.

- [ ] **Step 5: Commit**

```bash
git add app/domande/ app/api/domande/
git commit -m "Add domande flow with incremental answer saving"
```

---

### Task 14: Elaborazione page + status polling route

**Files:**
- Create: `app/api/submission-status/route.ts`
- Create: `app/elaborazione/page.tsx` (server shell, reads session cookie)
- Create: `app/elaborazione/polling-view.tsx` (client component)

**Interfaces:**
- Consumes: `getBySessionId` (Task 5); `SESSION_COOKIE_NAME` (Task 6).
- Produces: `GET /api/submission-status` → `{ status: "pending"|"processing"|"done"|"failed", attemptCount: number }` for the current session's submission; `/elaborazione` route.

- [ ] **Step 1: Implement the status route**

Create `app/api/submission-status/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getBySessionId } from "@/lib/db/queries";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: submission.status,
    attemptCount: submission.attemptCount,
  });
}
```

- [ ] **Step 2: Implement the polling client component**

Create `app/elaborazione/polling-view.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "processing" | "done" | "failed";

export default function PollingView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const res = await fetch("/api/submission-status");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { status: Status; attemptCount: number };
      setStatus(data.status);
      setAttemptCount(data.attemptCount);
      if (data.status === "done") {
        clearInterval(interval);
        router.push("/pillola");
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  if (status === "failed" && attemptCount >= 2) {
    return (
      <p className="text-brand-ink900">
        Ci siamo quasi, la tua pillola si sta ancora generando — riapri questa pagina tra
        qualche minuto.
      </p>
    );
  }

  if (status === "failed") {
    return <p className="text-brand-ink900">Qualcosa è andato storto, ci stiamo riprovando automaticamente…</p>;
  }

  return <p className="text-brand-ink900">Stiamo leggendo le tue risposte…</p>;
}
```

- [ ] **Step 3: Implement the page shell**

Create `app/elaborazione/page.tsx`:

```tsx
import PollingView from "./polling-view";

export default function ElaborazionePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <PollingView />
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, complete the flow through `/domande`.
Expected: `/elaborazione` shows the waiting message, then auto-redirects to `/pillola` once `status` becomes `done`. Temporarily throw inside `generatePillola` (or unset `ANTHROPIC_API_KEY`) to confirm the `failed` messaging appears after 2 attempts.

- [ ] **Step 5: Commit**

```bash
git add app/api/submission-status/route.ts app/elaborazione/
git commit -m "Add elaborazione polling page"
```

---

### Task 15: Pillola page

**Files:**
- Create: `app/pillola/page.tsx`

**Interfaces:**
- Consumes: `getBySessionId` (Task 5); `SESSION_COOKIE_NAME` (Task 6).
- Produces: `/pillola` route — server component, redirects to `/elaborazione` if not yet `done`.

- [ ] **Step 1: Implement**

Create `app/pillola/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/lib/db/client";
import { getBySessionId } from "@/lib/db/queries";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default async function PillolaPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) redirect("/registrazione");

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) redirect("/registrazione");
  if (submission.status !== "done" || !submission.pillolaGenerata) redirect("/elaborazione");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink500">La tua pillola</p>
      <p className="text-xl leading-relaxed text-brand-ink900">{submission.pillolaGenerata}</p>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, complete the full flow.
Expected: `/pillola` shows the generated text and nothing else (no CTA); visiting `/pillola` directly before completing the flow redirects appropriately.

- [ ] **Step 3: Commit**

```bash
git add app/pillola/page.tsx
git commit -m "Add pillola display page"
```

---

### Task 16: Presenter PIN auth

**Files:**
- Create: `lib/presenter-auth.ts`
- Test: `tests/lib/presenter-auth.test.ts`
- Create: `app/presenter/page.tsx`
- Create: `app/api/presenter/login/route.ts`

**Interfaces:**
- Produces: `PRESENTER_COOKIE_NAME = "brigata_presenter"`, `checkPin(input: string, expected: string): boolean` (constant-time-ish trim/compare); `/presenter` route; `POST /api/presenter/login`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/presenter-auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/presenter-auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/presenter-auth.ts`:

```ts
export const PRESENTER_COOKIE_NAME = "brigata_presenter";

export function checkPin(input: string, expected: string): boolean {
  return input.trim() === expected;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/presenter-auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the login route**

Create `app/api/presenter/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkPin, PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";

export async function POST(req: NextRequest) {
  const { pin } = (await req.json()) as { pin?: string };
  if (!pin || !checkPin(pin, process.env.PRESENTER_PIN!)) {
    return NextResponse.json({ error: "PIN errato" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(PRESENTER_COOKIE_NAME, "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Implement the PIN entry page**

Create `app/presenter/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PresenterLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/presenter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      setError(true);
      return;
    }
    router.push("/presenter/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 bg-brand-black px-6 py-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="rounded-xs border border-brand-hairline bg-transparent px-4 py-3 text-white"
        />
        {error && <p className="text-sm text-brand-orange">PIN errato.</p>}
        <button type="submit" className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white">
          Entra
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open `/presenter`, try a wrong PIN then the correct one (set `PRESENTER_PIN` in `.env.local` first).
Expected: wrong PIN shows the error and stays on the page; correct PIN redirects to `/presenter/dashboard` (404 until Task 17) and sets the `brigata_presenter` cookie.

- [ ] **Step 8: Commit**

```bash
git add lib/presenter-auth.ts tests/lib/presenter-auth.test.ts app/presenter/page.tsx app/api/presenter/login/
git commit -m "Add presenter PIN authentication"
```

---

### Task 17: Presenter dashboard + stats route

**Files:**
- Create: `app/api/presenter/stats/route.ts`
- Create: `app/presenter/dashboard/page.tsx`
- Create: `app/presenter/dashboard/stats-view.tsx`

**Interfaces:**
- Consumes: `getStats` (Task 5); `PRESENTER_COOKIE_NAME` (Task 16).
- Produces: `GET /api/presenter/stats` → `{ started: number; done: number }`, 401 if presenter cookie missing; `/presenter/dashboard` route, redirects to `/presenter` if not authenticated.

- [ ] **Step 1: Implement the stats route**

Create `app/api/presenter/stats/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getStats } from "@/lib/db/queries";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const stats = await getStats(db);
  return NextResponse.json(stats);
}
```

- [ ] **Step 2: Implement the client stats view**

Create `app/presenter/dashboard/stats-view.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export default function StatsView() {
  const [stats, setStats] = useState({ started: 0, done: 0 });

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/presenter/stats");
      if (res.ok) setStats(await res.json());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-white">
      <p className="text-5xl font-bold">{stats.done}</p>
      <p className="text-brand-ink500">risposte ricevute (su {stats.started} avviate)</p>
    </div>
  );
}
```

- [ ] **Step 3: Implement the dashboard page shell**

Create `app/presenter/dashboard/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";
import StatsView from "./stats-view";

export default async function PresenterDashboardPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    redirect("/presenter");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-black px-6 py-10">
      <StatsView />
      <a
        href="/api/export"
        className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress"
      >
        Esporta CSV
      </a>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in at `/presenter`, submit a few test flows in another tab/session, confirm the counter updates within ~4s.
Expected: unauthenticated access to `/presenter/dashboard` redirects to `/presenter`.

- [ ] **Step 5: Commit**

```bash
git add app/api/presenter/stats/ app/presenter/dashboard/
git commit -m "Add presenter dashboard with live counter"
```

---

### Task 18: CSV export

**Files:**
- Create: `lib/csv.ts`
- Test: `tests/lib/csv.test.ts`
- Create: `app/api/export/route.ts`

**Interfaces:**
- Consumes: `Submission` type (Task 3); `getAllForExport` (Task 5); `PRESENTER_COOKIE_NAME` (Task 16).
- Produces: `submissionsToCsv(rows: Submission[]): string`; `GET /api/export` — CSV file download, presenter-only.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/csv.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/csv.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/csv.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/csv.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement the export route**

Create `app/api/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getAllForExport } from "@/lib/db/queries";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";
import { submissionsToCsv } from "@/lib/csv";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const rows = await getAllForExport(db);
  const csv = submissionsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brigata-submissions-${Date.now()}.csv"`,
    },
  });
}
```

- [ ] **Step 6: Manual verification**

From `/presenter/dashboard`, click "Esporta CSV".
Expected: browser downloads a CSV file with correct headers and no `sessionId` column.

- [ ] **Step 7: Commit**

```bash
git add lib/csv.ts tests/lib/csv.test.ts app/api/export/route.ts
git commit -m "Add CSV export for presenter"
```

---

### Task 19: Cron retry route

**Files:**
- Create: `app/api/cron/retry-pillole/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `getFailedForRetry` (Task 5), `generatePillola` (Task 9), env `CRON_SECRET`.
- Produces: `GET /api/cron/retry-pillole`, protected by `Authorization: Bearer <CRON_SECRET>` header, retries every submission returned by `getFailedForRetry(db, 5)`.

- [ ] **Step 1: Implement the route**

Create `app/api/cron/retry-pillole/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createDb } from "@/lib/db/client";
import { getFailedForRetry } from "@/lib/db/queries";
import { generatePillola } from "@/lib/ai/generate";

const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pending = await getFailedForRetry(db, MAX_ATTEMPTS);
  const results = await Promise.allSettled(
    pending.map((s) => generatePillola(db, anthropic, s.id))
  );

  return NextResponse.json({
    retried: pending.length,
    succeeded: results.filter((r) => r.status === "fulfilled" && r.value.ok).length,
  });
}
```

- [ ] **Step 2: Configure the cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/retry-pillole",
      "schedule": "* * * * *"
    }
  ]
}
```

Note: Vercel Cron invokes the path without custom headers, so add the `CRON_SECRET` check via Vercel's built-in cron authentication (Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set as an env var on the project) — confirm this against current Vercel Cron docs when deploying; if the automatic header isn't sent in practice, switch the check to Vercel's `x-vercel-cron` header presence instead.

- [ ] **Step 3: Manual verification**

Set `CRON_SECRET` locally, run: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/retry-pillole`
Expected: `200` with `{ "retried": <n>, "succeeded": <n> }`; a request without the header returns `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/retry-pillole/route.ts vercel.json
git commit -m "Add cron retry route for failed pillola generations"
```

---

### Task 20: Env template, root redirect, and deploy docs

**Files:**
- Create: `.env.example`
- Create: `app/page.tsx` (redirects `/` → `/registrazione`)
- Modify: `app/layout.tsx` (page title, lang="it")

**Interfaces:**
- Produces: root route redirect; documented env vars for deploy.

- [ ] **Step 1: Create env template**

Create `.env.example`:

```
DATABASE_URL=
ANTHROPIC_API_KEY=
PRESENTER_PIN=
CRON_SECRET=
```

- [ ] **Step 2: Redirect root to registrazione**

Create `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/registrazione");
}
```

- [ ] **Step 3: Set page metadata and language**

Edit `app/layout.tsx` — set `<html lang="it">` and `export const metadata = { title: "Mappa la tua Brigata" }`.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/`.
Expected: redirects to `/registrazione`; browser tab title reads "Mappa la tua Brigata".

- [ ] **Step 5: Commit**

```bash
git add .env.example app/page.tsx app/layout.tsx
git commit -m "Add env template and root redirect"
```

---

### Task 21: Account setup, DB migration, and deploy

**Files:** none (operational task, run with the user)

- [ ] **Step 1: Create accounts**

Guide the user through: Vercel account + GitHub repo connection; Neon project (copy the pooled connection string into `DATABASE_URL`); Anthropic Console API key (`ANTHROPIC_API_KEY`); choose and set `PRESENTER_PIN` and a random `CRON_SECRET` (e.g. `openssl rand -hex 16`).

- [ ] **Step 2: Push local repo to GitHub**

```bash
git remote add origin <repo-url>
git push -u origin main
```

- [ ] **Step 3: Generate and apply the DB migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: `drizzle/` migration files created; `submissions` table exists in the Neon database (verify via Neon's SQL console: `SELECT * FROM submissions LIMIT 1;` returns an empty result with no error).

- [ ] **Step 4: Configure Vercel project env vars and deploy**

In the Vercel project settings, add all four vars from `.env.example` (Production + Preview). Trigger a deploy (push to `main` or `vercel --prod`).

- [ ] **Step 5: Verify cron registration**

In the Vercel dashboard, confirm the `retry-pillole` cron job is listed under the project's Cron Jobs tab, schedule `* * * * *`.

---

### Task 22: Load test and pre-event smoke test

**Files:**
- Create: `scripts/load-test.mjs`

**Interfaces:**
- Consumes: deployed `/api/generate-pillola` endpoint (Task 10, live in production per Task 21).

- [ ] **Step 1: Write the load test script**

Create `scripts/load-test.mjs`:

```js
const BASE_URL = process.env.LOAD_TEST_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.LOAD_TEST_N ?? 45);

async function submitOne(i) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/generate-pillola`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: `load-test-fake-${i}` }),
    });
    return { i, status: res.status, ms: Date.now() - start };
  } catch (err) {
    return { i, error: String(err), ms: Date.now() - start };
  }
}

const results = await Promise.all(
  Array.from({ length: CONCURRENCY }, (_, i) => submitOne(i))
);

const failures = results.filter((r) => r.error || (r.status && r.status >= 500));
console.log(`Completed ${results.length} requests, ${failures.length} failures.`);
console.log(`Max latency: ${Math.max(...results.map((r) => r.ms))}ms`);
if (failures.length > 0) {
  console.error("Failures:", failures);
  process.exit(1);
}
```

Note: this script hits `/api/generate-pillola` with fake `submissionId`s to measure raw endpoint throughput/latency under concurrency (the route will 202 immediately and the background `generatePillola` call will no-op on a missing submission — this is intentional, it isolates infra-level concurrency behavior from AI-call correctness). For a true end-to-end load test, seed 45 real submissions first via direct DB inserts, then pass their ids in.

- [ ] **Step 2: Run it against the deployed preview/production URL**

Run: `LOAD_TEST_URL=https://<your-deploy>.vercel.app LOAD_TEST_N=45 node scripts/load-test.mjs`
Expected: 0 failures, max latency reasonable (sub-2s for the 202 response, since generation runs unawaited).

- [ ] **Step 3: Manual smoke test checklist**

Run through on a real phone, on the venue wifi if possible before the event:
- Full flow `/registrazione` → `/pillola` completes and shows text referencing at least one real answer
- Reloading mid-flow (after `/domande` step 2, say) does not lose earlier answers
- `/presenter` rejects wrong PIN, accepts correct PIN
- `/presenter/dashboard` counter increments after a real submission completes
- "Esporta CSV" downloads a file openable in a spreadsheet app with correct columns
- Force an AI failure (temporarily set an invalid `ANTHROPIC_API_KEY` in a preview deploy) and confirm `/elaborazione` shows the "riapri tra qualche minuto" message after 2 failures, and that resetting the key + waiting for the cron makes `/pillola` show up correctly on reload

- [ ] **Step 4: Commit**

```bash
git add scripts/load-test.mjs
git commit -m "Add load test script for concurrent submission handling"
```
