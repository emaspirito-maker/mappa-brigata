# Design — "Mappa la tua Brigata"

Data: 2026-08-17
Deadline evento: venerdì 21/08/2026
Spec di prodotto di riferimento: [brigata-cucina-spec.md](../../../brigata-cucina-spec.md)

## Obiettivo

Mini-webapp mobile-first per un esercizio live durante uno speech Mandarino per Rossato Group. I partecipanti compilano un flow di 5 schermate da smartphone (via QR code) e ricevono una riflessione personalizzata ("pillola") generata da Claude a partire da 3 risposte testuali. Vista separata per il presenter (Emanuele) con contatore live ed export CSV.

## Vincoli chiave

- Consegna entro venerdì 21/08/2026 (4 giorni da oggi)
- Nessun account/credenziale già pronto (Vercel, Anthropic, DB) — da creare in fase di build
- Carico: 40-50 submission simultanee nel giro di ~1 minuto
- Rete wifi in sala potenzialmente instabile — nessuna perdita dati, nessun blocco permanente per l'utente
- Nessuna vista pubblica/proiettata dei contenuti; presenter vede solo un contatore aggregato, mai il contenuto delle risposte

## Stack

- **Framework**: Next.js 14+ (App Router), TypeScript, deploy su Vercel
- **DB**: Neon Postgres, driver serverless (HTTP-based, evita esaurimento del pool di connessioni sotto carico concorrente da funzioni serverless)
- **ORM**: Drizzle (schema + migrations)
- **AI**: Claude API (Anthropic SDK, modello Sonnet), chiamata solo lato server (Route Handler), mai esposta al client
- **Styling**: Tailwind CSS, configurato sui design token Mandarino (vedi sezione Brand)
- **Stato partecipante**: cookie httpOnly `sessionId` generato al primo accesso a `/registrazione`, per permettere reload/riapertura senza perdita dati
- **Retry di fallback**: Vercel Cron (ogni 1 min) su submission in stato `failed`

## Brand

Asset e token estratti da `Mandarino UI Design System.zip`, copiati in [brand-assets/](../../../brand-assets/):
- `logo-mandarino.png` / `logo-mandarino-inverse.png` — wordmark
- `colors_and_type.css` — token sorgente (colori, tipografia, spacing, radii, motion)

Punti chiave applicati al tool:
- Palette quasi monocromatica: nero `#000000` / bianco `#ffffff` / testo `#181a1b`, unico accento saturo arancio `#ff3e00` (CTA primarie, focus ring, elementi chiave)
- Font Inter (400/500/600/700), scala tipografica densa (base 14/20)
- Nessun gradiente, nessuna ombra di default, hairline (`#e4e4e7` light) invece di shadow sulle card
- Radius: 2px input, 8px card, pill per elementi tondi
- Motion: 150/300/500ms, easing `cubic-bezier(0.2, 0, 0, 1)`, no bounce/spring

Nota: questo design system è pensato per il sito marketing di Mandarino; qui viene riusato solo per i token fondativi (colore/tipografia/spacing/motion) applicati a un flow mobile-first, non per i componenti marketing (Hero, Nav, ecc. in `ui_kits/marketing/` non sono rilevanti per questo tool).

## Struttura progetto

```
app/
  registrazione/         → step 1, crea sessionId + submission iniziale
  intro/                 → step 2, contenuto statico brigata
  domande/                → step 3, una domanda alla volta (1/3, 2/3, 3/3)
  elaborazione/           → step 4, poll stato submission
  pillola/                → step 5, output finale
  presenter/
    page.tsx              → form PIN
    dashboard/             → contatore live + export (protetta da cookie sessione presenter)
  api/
    generate-pillola/      → route handler, chiamata Claude
    cron/retry-pillole/    → cron di retry, protetto da CRON_SECRET
    export/                → CSV, solo presenter
lib/
  db/                     → schema Drizzle + client Neon
  ai/                     → prompt system + client Anthropic
```

Ogni route del flow partecipante è guardata server-side: se manca lo step precedente (nessun cookie/submission valida), redirect allo step corretto.

## Data model

Tabella `submissions` (Postgres via Drizzle):

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | default random |
| `createdAt` | timestamp | default now() |
| `sessionId` | text, not null | cookie anonimo, per resume dopo reload |
| `nome` | text, not null | |
| `cognome` | text, not null | |
| `email` | text, not null | validazione formato email |
| `azienda` | text, not null | |
| `rispostaCuocoDiLinea` | text, not null | |
| `rispostaSousChef` | text, not null | |
| `rispostaChef` | text, not null | |
| `pillolaGenerata` | text, nullable | null finché non generata |
| `status` | enum('pending','processing','done','failed') | default 'pending' |
| `attemptCount` | integer | default 0 |
| `updatedAt` | timestamp | on update now() |

**Scrittura incrementale**: `INSERT` iniziale a `/registrazione` (subito dopo submit form), poi `UPDATE` incrementale a ogni domanda risposta in `/domande`. Motivazione: se un partecipante abbandona a metà, restano comunque nome/email per un eventuale follow-up, invece di perdere tutto.

**Export CSV**: tutte le colonne tranne `sessionId` (dettaglio interno di sessione, non utile al follow-up commerciale).

## Flow dettagliato

1. **`/registrazione`** — form (nome, cognome, email, azienda), validazione client + server, CTA "Inizia" → `INSERT` submission (status `pending`) + cookie `sessionId` → redirect `/intro`
2. **`/intro`** — contenuto statico (cuoco di linea / sous-chef / chef), CTA "Continua" → `/domande`
3. **`/domande`** — una domanda alla volta con progress "1/3 · 2/3 · 3/3", back navigabile, campo breve con contatore ~150 caratteri, nessuna validazione di "qualità" del contenuto (solo non-vuoto) → `UPDATE` incrementale a ogni step → all'ultima domanda CTA "Invia" → set status `processing`, trigger chiamata AI, redirect `/elaborazione`
4. **`/elaborazione`** — poll leggero (1-2s) sullo stato della submission corrente:
   - `done` → redirect `/pillola`
   - primo fallimento → messaggio scuse + "Riprova" (ritenta subito)
   - 2° fallimento consecutivo → messaggio "Ci siamo quasi, la tua pillola si sta ancora generando — riapri questa pagina tra qualche minuto" (niente ulteriore retry manuale a oltranza; il cron lavora in background, il cookie `sessionId` permette di ritrovare la pillola pronta riaprendo il link in un secondo momento)
5. **`/pillola`** — mostra il testo generato (3-4 righe), nessuna CTA aggiuntiva, nessun modo di tornare indietro a modificare le risposte

## Integrazione AI

- Route Handler `/api/generate-pillola`: riceve `submissionId`, legge le 3 risposte dal DB, chiama Claude (system prompt basato sulla bozza nello spec di prodotto, rifinito in fase di build)
- Timeout chiamata: 10s
- Retry: 1 retry immediato lato server se la prima chiamata fallisce/va in timeout; se fallisce ancora → `status='failed'`, `attemptCount++`
- Requisiti del prompt (dallo spec di prodotto): cita almeno un elemento concreto dalle risposte utente quando presente, gestisce correttamente risposte vaghe/minime senza bloccare, mai promesse quantificate, mai menzioni commerciali o del brand Mandarino

## Retry di fallback (cron)

- `/api/cron/retry-pillole`, eseguito ogni 1 minuto da Vercel Cron, protetto da header `CRON_SECRET`
- Seleziona submission `status='failed' AND attemptCount < 5`, ritenta la generazione
- Oltre 5 tentativi la submission resta `failed`: i dati grezzi (3 risposte) restano comunque nel DB/export per eventuale generazione manuale post-evento

## Vista Presenter

- **`/presenter`**: form con singolo campo PIN (env var `PRESENTER_PIN`), submit corretto imposta cookie httpOnly di sessione presenter (scadenza fine giornata evento)
- **`/presenter/dashboard`**: protetta dal cookie sopra
  - Contatore live: submission `status='done'` su totale submission iniziate (poll ogni 3-5s)
  - Pulsante "Esporta CSV" → chiama `/api/export`
- **`/api/export`**: genera CSV on-the-fly da tutte le submission, protetto dallo stesso cookie di sessione presenter

## Privacy & sicurezza

- Nessuna vista pubblica o proiettata dei contenuti delle risposte/pillole
- Ogni route partecipante mostra solo i dati della sessione corrente (via cookie `sessionId`), mai dati di altri partecipanti
- Presenter non ha mai accesso al contenuto delle risposte, solo al contatore aggregato e all'export (che lui solo può scaricare)
- API key Anthropic e connection string DB solo in env vars server-side, mai esposte al client

## Setup account (da fare prima del deploy)

1. Account Vercel collegato a un repo Git (GitHub)
2. Progetto Neon (Postgres) — free tier sufficiente per il volume previsto
3. API key Anthropic da console.anthropic.com (piano a consumo)
4. Env vars su Vercel: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `PRESENTER_PIN`, `CRON_SECRET`

## Testing & verifica pre-evento

- Test manuale del flow completo da smartphone reale
- Simulazione di carico: ~40-50 richieste parallele a `/api/generate-pillola` per verificare assenza di errori/timeout a cascata
- Test del path di errore: fallimento AI forzato → verifica messaggio corretto e funzionamento del cron di retry
- Verifica export CSV con dati di test

## Fuori scope (esplicitamente, da spec di prodotto)

- Invio email della pillola o di qualsiasi follow-up (il partecipante ritrova la pillola riaprendo il link, nessun invio email è previsto)
- Generazione del consiglio commerciale ad hoc post-evento (processo separato, successivo)
- Qualsiasi vista pubblica/proiettata dei contenuti
- CTA commerciali nella schermata della pillola
