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
