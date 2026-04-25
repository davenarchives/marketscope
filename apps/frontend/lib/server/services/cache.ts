import { Redis } from "ioredis";
import { config } from "../config";

type CacheValue = {
  expiresAt: number;
  value: string;
};

export class CacheService {
  private readonly redis?: Redis;
  private readonly memory = new Map<string, CacheValue>();

  constructor() {
    if (config.REDIS_URL) {
      this.redis = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2
      });

      this.redis.on("error", (error: Error) => {
        console.warn("Redis cache unavailable:", error.message);
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        return cached ? (JSON.parse(cached) as T) : null;
      } catch {
        return this.getMemory<T>(key);
      }
    }

    return this.getMemory<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds = config.CACHE_TTL_SECONDS): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.redis) {
      try {
        await this.redis.set(key, serialized, "EX", ttlSeconds);
        return;
      } catch {
        // Fall through to in-memory cache.
      }
    }

    this.memory.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value: serialized
    });
  }

  private getMemory<T>(key: string): T | null {
    const cached = this.memory.get(key);
    if (!cached) return null;

    if (cached.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return JSON.parse(cached.value) as T;
  }
}
