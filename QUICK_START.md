# Quick Start — Arquitectura final

This project is a TanStack Start app built on Vite with React + TypeScript. The final architecture is split into three main pieces:

- Chat UI in `src/components/chat/Chat.tsx`, backed by an n8n webhook.
- Dashboard data in `src/services/dashboard.ts` and `src/hooks/useDashboardData.ts`, backed by Supabase.
- App shell, routing, and SSR entrypoints in `src/routes/`, `src/router.tsx`, `src/client.tsx`, and `src/server.ts`.

This guide assumes you have Node.js 18+ and `npm` installed.

## 1) Clone and install

```bash
git clone <repo-url>
cd WorkPilot-AI
npm install
```

## 2) Configure environment

Copy the example file and fill in the required values:

```bash
cp .env.example .env
```

Required variables:

- `VITE_SUPABASE_URL` — Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key.
- `VITE_N8N_WEBHOOK_URL` — full URL to the n8n webhook used by the chat.

Optional variables currently present in `.env.example` can stay empty unless you wire extra voice features later.

## 3) Prepare Supabase

The dashboard reads from two tables only:

- `projects` with at least `id`, `name`, `client`, `hourly_rate`, `created_at`.
- `time_logs` with at least `id`, `project_id`, `hours`, `description`, `logged_at`.

`time_logs.project_id` should reference `projects.id`.

## 4) Prepare the n8n webhook

The chat sends a POST request with this payload:

```json
{ "message": "...", "sessionId": "..." }
```

The webhook must return JSON with at least:

```json
{ "reply": "..." }
```

Optional fields supported by the UI:

- `toolUsed`
- `sessionId`

## 5) Run locally

```bash
npm run dev
```

Open http://localhost:8080/ and test the chat plus dashboard. The chat keeps its session id in browser session storage, and dashboard data loads from Supabase on the client.

## Final architecture at a glance

- `src/routes/index.tsx` renders the chat as the home screen.
- `src/components/chat/Chat.tsx` owns the conversational UI and webhook calls.
- `src/hooks/useDashboardData.ts` loads projects and time logs.
- `src/services/dashboard.ts` centralizes Supabase queries and dashboard metrics.
- `src/integrations/supabase.ts` creates the Supabase client from environment variables.
- `src/server.ts` and `src/client.tsx` provide the SSR entrypoints used by TanStack Start.

## Troubleshooting

- If the app cannot reach the webhook, verify `VITE_N8N_WEBHOOK_URL` and CORS/access from your machine.
- If dashboard data fails, verify `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the table names above.
- Run `npm run lint` if you want a fast sanity check after changes.
