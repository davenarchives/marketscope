import http from "http";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { createApiRouter } from "./routes/api.js";
import { createRealtimeServer } from "./realtime/socket.js";
import { CacheService } from "./services/cache.js";
import { MarketDataProvider } from "./services/providers.js";
import { MarketService } from "./services/marketService.js";
import { WatchlistStore } from "./services/watchlistStore.js";

const app = express();
const server = http.createServer(app);
const cache = new CacheService();
const provider = new MarketDataProvider();
const watchlistStore = new WatchlistStore();
const marketService = new MarketService(cache, provider, watchlistStore);

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());
app.use("/api", createApiRouter(marketService));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request", details: error.flatten() });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Unexpected server error" });
});

createRealtimeServer(server, marketService);

server.listen(config.PORT, () => {
  console.log(`Market Scope backend listening on http://localhost:${config.PORT}`);
});
