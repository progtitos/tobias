# Tobias

Tobias is an AI-powered personal financial planning agent: conversational onboarding, manual + photographed expense
tracking, a 9-dimension "Bússola Financeira" health score, quantified goals/dreams, a dynamic budget engine, a
retirement projection curve, proactive behavior-based alerts, and a "posso comprar isso?" affordability agent — all
backed by real Postgres data, never hardcoded numbers.

## Tech stack

- **Next.js 16** (App Router, Turbopack, React 19.2) — pages are dynamic-by-default (no Cache Components), auth is
  gated per-layout via `requireUser()` / `requireOnboardedUser()` rather than middleware.
- **Drizzle ORM** + `postgres.js` — plain SQL-first ORM, no native binaries to download (chosen over Prisma, whose
  engine binaries are blocked in some sandboxed CI/dev environments).
- **Custom DB-backed session auth** — opaque token in an httpOnly cookie, mapped to a `sessions` row. No NextAuth
  dependency; `auth_accounts` / `verification_tokens` tables already exist for adding real OAuth later.
- **Google Gemini** (`@google/genai`) — a single `AIService` module fronts every AI call (chat, onboarding
  extraction, receipt OCR, categorization, retirement narrative, affordability check) behind named "agents" that all
  share one financial-context builder. Supports comma-separated API keys with automatic round-robin/retry on
  429/5xx.
- **Tailwind CSS v4** (CSS-first `@theme`, no config file) — brand palette (deep green / off-white / gold) and
  native system font stacks (no external font loading).
- **Supabase Storage** for receipt photos in production, with a local-disk fallback for dev.

## Local development

Prerequisites: Node 22+, a local Postgres instance.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL at minimum; see below for the rest
npm run db:push           # sync the Drizzle schema to your database
npm run db:seed           # optional: creates the "João da Silva" demo account
npm run dev
```

Open http://localhost:3000. If you ran `db:seed`, log in with:

- **email:** `joao@tobias.demo`
- **password:** `TobiasDemo123!`

### Environment variables

See `.env.example` for the full list with inline explanations. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection string (used by the app at request time) |
| `DIRECT_URL` | yes | Non-pooled connection string (used only by `drizzle-kit` for migrations) |
| `AUTH_SECRET` | yes | Not currently used by session signing (sessions are opaque DB tokens), reserved for future JWT/OAuth use — generate one anyway with `openssl rand -base64 32` |
| `GEMINI_API_KEYS` | yes, for any AI feature | Comma-separated; without this, onboarding chat, receipt OCR, and the affordability check all fail gracefully (error message, never a fabricated response) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | production only | Without these, receipt photos are written to local disk, which does not persist on Vercel |
| `WHATSAPP_*` | no | WhatsApp Business API integration is scaffolded (see `src/lib/whatsapp/WhatsAppService.ts`) but intentionally not wired to a live provider in this MVP |
| `APP_TRIAL_DAYS` | no | Defaults to 15 |

### Useful scripts

```bash
npm run db:generate   # generate a new Drizzle migration from schema changes
npm run db:migrate    # apply migrations
npm run db:push       # push schema directly (fastest for dev; skips migration files)
npm run db:studio     # Drizzle Studio, a GUI for the database
npm run db:seed       # (re)seed the demo user — safe to re-run, deletes and recreates it
```

## Deploying to production (Supabase + Vercel)

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Database → Connect**: copy the **Transaction pooler** connection string (port 6543) into `DATABASE_URL`, and the
   **Direct connection** string (port 5432) into `DIRECT_URL`.
3. **Storage**: create a bucket named exactly `receipts`, and set it **public** (the app reads uploaded receipt
   photos back via Supabase's public object URL — see `src/lib/storage/index.ts`).
4. **Project Settings → API**: copy the Project URL into `SUPABASE_URL` and the `service_role` secret key into
   `SUPABASE_SERVICE_ROLE_KEY`. The service role key bypasses Row Level Security, so it must only ever be used
   server-side (which is exactly what `StorageService` does — never expose it to the client).

### 2. Run migrations against Supabase

From your machine, with `.env` pointed at the Supabase `DIRECT_URL`:

```bash
npm run db:push
npm run db:seed   # optional — creates the demo account in production too, useful for a live demo link
```

### 3. Deploy to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket) and import it in Vercel, or run `vercel` from the CLI.
2. In **Project Settings → Environment Variables**, set every variable from `.env.example` (the same values you put
   in your local `.env`, minus any local-only Postgres credentials).
3. Deploy. Next.js's build step doesn't touch the database, so there's no build-time migration step to configure —
   migrations are run manually (step 2) whenever the schema changes.

### 4. Post-deploy checklist

- Visit `/login` and confirm the demo account (if seeded) works.
- Upload a receipt photo and confirm it round-trips through Supabase Storage (check the bucket in the Supabase
  dashboard).
- Check the server logs for any `[whatsapp]`, `[insights]`, or Gemini `ApiError` lines — these are all designed to
  degrade gracefully (logged, never thrown to the user as a crash), but worth confirming Gemini is actually
  reachable from Vercel's network (it is not reachable from every sandboxed dev environment, which is why this was
  deferred to production testing).

## Architecture notes worth knowing

- **AI is never the source of truth for numbers.** Net worth, the Bússola Financeira scores, budget guidelines, and
  the retirement curve are all pure deterministic calculations (see `src/services/aggregations.ts`,
  `compass.ts`, `budget.ts`, `retirement.ts`) — reproducible and auditable. AI (`AIService`) is only used to
  interpret conversation, extract structured data, read receipts, and phrase narratives around numbers that were
  already computed. Every AI-derived record carries a `source`/`confidence` field so the UI can distinguish a
  confirmed fact from an inference.
- **Behavior checks are rule-based, not AI-generated** (`src/services/insights.ts`) — budget overruns, subscription
  price increases, installments ending, missing contributions, goals falling behind pace, and reserve progress are
  all detected by fixed, explainable rules over real transaction data, with a dedup window so re-running them on
  every dashboard load never spams duplicate alerts.
- **Account deletion is a real hard delete.** Every table cascades from `users.id` (`onDelete: "cascade"`), so
  deleting a user row removes every piece of their financial data in one statement. `analytics_events` is the one
  exception (`onDelete: "set null"`), which deliberately keeps aggregate product metrics without retaining anything
  identifying.
