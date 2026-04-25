# Market Scope

Production-oriented MVP for a live-updating market intelligence dashboard.

## Stack

- App: Next.js App Router, TypeScript, Tailwind CSS, lightweight-charts, Recharts
- API: Next.js Route Handlers under `apps/frontend/app/api`
- Data: Finnhub primary, Yahoo Finance secondary, simulated fallback
- Realtime model: client polling of `/api/snapshot`
- Persistence: localStorage on the client, optional PostgreSQL watchlist table
- Cache: optional Redis, in-memory fallback

## Folder Structure

```text
market-scope/
  apps/
    frontend/
      app/                 # Next.js app router and API routes
      components/          # dashboard UI
      lib/                 # API client, shared types, server market services
    backend/               # legacy Express/Socket.IO server, not needed for Vercel
  .env.example
  package.json
```

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:3000`.

The app serves both the dashboard and API routes from the same Next.js dev server.

## Environment Variables

```text
FINNHUB_API_KEY=
YAHOO_FINANCE_ENABLED=true
REDIS_URL=
DATABASE_URL=
CACHE_TTL_SECONDS=5
```

Without API keys or infrastructure, the app still runs with Yahoo Finance where available and simulated data as the final fallback. On Vercel, use `DATABASE_URL` for persistent watchlists and `REDIS_URL` for shared cache if needed.

## API Routes

- `GET /api/health`
- `GET /api/snapshot`
- `GET /api/indices`
- `GET /api/candles/:symbol`
- `GET /api/symbols?q=AAPL`
- `GET /api/watchlist`
- `POST /api/watchlist` with `{ "symbol": "AAPL" }`
- `DELETE /api/watchlist/:symbol`
- `GET /api/signals`
- `GET /api/bubbles`

## Vercel Deployment

Import the repository into Vercel and set:

```text
Root Directory: apps/frontend
Build Command: npm run build
Install Command: npm install
```

Set the environment variables from `.env.example`. Do not set `NEXT_PUBLIC_API_URL` for the all-Vercel deployment; the browser calls same-origin `/api/*` routes.

## Data Flow

```text
External APIs -> Next API routes -> Redis or memory cache -> polling dashboard
```
