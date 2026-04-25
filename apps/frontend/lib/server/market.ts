import { CacheService } from "./services/cache";
import { MarketService } from "./services/marketService";
import { MarketDataProvider } from "./services/providers";
import { WatchlistStore } from "./services/watchlistStore";

const globalForMarket = globalThis as typeof globalThis & {
  marketScopeService?: MarketService;
};

export function marketService() {
  if (!globalForMarket.marketScopeService) {
    globalForMarket.marketScopeService = new MarketService(new CacheService(), new MarketDataProvider(), new WatchlistStore());
  }

  return globalForMarket.marketScopeService;
}
