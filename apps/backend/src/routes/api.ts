import { Router } from "express";
import { z } from "zod";
import type { CandleRange } from "../services/providers.js";
import type { MarketService } from "../services/marketService.js";

export function createApiRouter(marketService: MarketService): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ ok: true, service: "market-scope-backend", timestamp: new Date().toISOString() });
  });

  router.get("/indices", async (_request, response, next) => {
    try {
      response.json(await marketService.indices());
    } catch (error) {
      next(error);
    }
  });

  router.get("/snapshot", async (_request, response, next) => {
    try {
      response.json(await marketService.snapshot());
    } catch (error) {
      next(error);
    }
  });

  router.get("/candles/:symbol", async (request, response, next) => {
    try {
      const range = candleRangeSchema.parse(request.query.range ?? "1d");
      response.json(await marketService.candles(request.params.symbol, undefined, range));
    } catch (error) {
      next(error);
    }
  });

  router.get("/symbols", async (request, response, next) => {
    const query = typeof request.query.q === "string" ? request.query.q : "";

    try {
      response.json(await marketService.lookupSymbols(query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/watchlist", async (_request, response, next) => {
    try {
      response.json({
        items: await marketService.watchlistItems(),
        quotes: await marketService.watchlistQuotes()
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/watchlist", async (request, response, next) => {
    const bodySchema = z.object({
      symbol: z.string().trim().min(1).max(12),
      name: z.string().trim().max(80).optional()
    });

    try {
      const body = bodySchema.parse(request.body);
      const item = await marketService.addWatchlistItem(body.symbol, body.name);
      response.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/watchlist/:symbol", async (request, response, next) => {
    try {
      await marketService.removeWatchlistItem(request.params.symbol);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/signals", (_request, response) => {
    response.json(marketService.signals());
  });

  router.get("/bubbles", (_request, response) => {
    response.json(marketService.bubbles());
  });

  return router;
}

const candleRangeSchema = z.enum(["1d", "1m", "3m", "1y", "5y", "all"]) satisfies z.ZodType<CandleRange>;
