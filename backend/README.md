# Interview Assistant Backend

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API listens on `http://localhost:4000` by default. Open that URL in your
browser, or visit `http://localhost:4000/api/health` for the health check. The
server binds to `0.0.0.0` by default to accept local and network connections;
use `localhost` (or `127.0.0.1`) in the browser, not `0.0.0.0`. Configure
`PORT`, `HOST`, and `CORS_ORIGINS` in `.env` as needed. AI provider keys are
optional until their integrations are used.

## Endpoints

- `GET /api/health` — backend health check
- `GET /` — backend status and health-check link
- `ws://localhost:4000/ws` — WebSocket connection endpoint

## Scripts

- `npm run dev` — run in development with reload
- `npm run build` — compile TypeScript into `dist/`
- `npm start` — run the compiled backend
- `npm run typecheck` — type-check without emitting files
