# macros

Conversational nutrition and calorie tracking. See [macrosMVP_phase1.md](./macrosMVP_phase1.md) for the build spec and [tasks/todo.md](./tasks/todo.md) for the sequenced PR plan.

## Stack

- Next.js 15 + Tailwind v4 (`apps/web`) — Vercel
- Fastify + TypeScript (`apps/api`) — Railway
- Postgres 16 + Drizzle ORM (`packages/db`) — Railway
- Stytch Consumer (magic links + Google OAuth)
- Anthropic Claude with tool use
- Turborepo + pnpm workspaces

## Local development

Prereqs: Node 20+, pnpm 9+, Docker.

```sh
# 1. Install deps
pnpm install

# 2. Start Postgres
docker compose up -d

# 3. Copy env templates and fill secrets
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local files with Stytch / Anthropic credentials

# 4. Run migrations (lands in PR 2)
pnpm db:migrate

# 5. Run both apps
pnpm dev
```

- API: http://localhost:4000 (try `/health`)
- Web: http://localhost:3000

## Workspace layout

```
apps/
  web/       Next.js frontend
  api/       Fastify backend
packages/
  shared/    zod schemas + shared TS types
  db/        Drizzle schema, migrations, query helpers
```
