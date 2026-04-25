# Market Scope

Production-oriented MVP for a real-time market intelligence dashboard.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, Radix UI, lightweight-charts, Recharts, Socket.IO client
- Backend: Node.js, Express.js, Socket.IO
- Data: Finnhub primary, Yahoo Finance secondary, simulated fallback
- Persistence: localStorage on the client, optional PostgreSQL watchlist table
- Cache: optional Redis, in-memory fallback

## Folder Structure

```text
market-scope/
  apps/
    backend/
      src/
        data/              # index symbols, base signals, bubble sectors
        realtime/          # Socket.IO snapshot broadcaster
        routes/            # REST API routes
        services/          # cache, providers, watchlist store, market service
        server.ts          # Express app entry
    frontend/
      app/                 # Next.js app router
      components/          # dashboard UI
      lib/                 # API client and shared types
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

The backend listens on `http://localhost:4000`.

The dashboard includes a Radix Switch theme toggle in the sidebar. The selected light/dark theme is stored in localStorage.

## Environment Variables

```text
PORT=4000
CORS_ORIGIN=http://localhost:3000
FINNHUB_API_KEY=
YAHOO_FINANCE_ENABLED=true
REDIS_URL=
DATABASE_URL=
CACHE_TTL_SECONDS=5
MARKET_TICK_INTERVAL_MS=5000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

Without API keys or infrastructure, the app still runs with Yahoo Finance where available and simulated data as the final fallback.

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

## WebSocket Events

- `market:snapshot`: broadcasts indices, watchlist quotes, OHLC candles, signals, bubble sectors, and timestamp every three seconds
- `connection:ready`: confirms the socket connection

`market:snapshot` also includes `candles`, a map of symbol to OHLC arrays:

```json
{
  "time": 1713984000,
  "open": 5120.25,
  "high": 5132.4,
  "low": 5118.1,
  "close": 5128.8
}
```

## Data Flow

```text
External APIs -> Backend -> Redis or memory cache -> WebSocket/REST -> Frontend
```
