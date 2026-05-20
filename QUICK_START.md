# Quick Start — Run locally in under 5 minutes

This guide assumes you have Node.js (v18+) and `npm` installed.

1) Clone the repository

```bash
git clone <repo-url>
cd samuel-ocampo-voiceagent
```

2) Install dependencies

```bash
npm install
```

3) Create your `.env` file

Copy the example and populate required values:

```bash
cp .env.example .env
# Edit .env and set your VITE_N8N_WEBHOOK_URL and Supabase values
```

Required variables:
- `VITE_N8N_WEBHOOK_URL` — full URL to your n8n webhook that accepts POST JSON and returns `{ reply: string }`.
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

4) Supabase (quick)

- Create a Supabase project and add two tables used by the app: `projects` and `time_logs`.
- Use the SQL available in the project or create simple tables with basic columns: id, name/title, timestamps, etc.

5) n8n webhook (quick)

- Create an HTTP webhook in n8n that receives JSON `{ message, sessionId }` and returns JSON `{ reply, toolUsed?, sessionId? }`.
- For development you can return a static reply to verify the flow.

6) Start the dev server

```bash
npm run dev
```

Open http://localhost:8080/ and interact with the chat. Messages will be posted to the `VITE_N8N_WEBHOOK_URL`.

Troubleshooting
- If the app can't reach the webhook, make sure `VITE_N8N_WEBHOOK_URL` is correct and accessible from your machine.
- If Supabase calls fail, verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Run `npm run lint` to surface potential code issues.

If something is unclear or a variable is missing, open an issue or reach out.
