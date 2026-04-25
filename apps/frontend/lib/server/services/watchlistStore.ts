import pg from "pg";
import { config } from "../config";
import { DEFAULT_WATCHLIST } from "../data/symbols";
import type { WatchlistItem } from "../types";

const { Pool } = pg;

export class WatchlistStore {
  private pool?: pg.Pool;
  private readonly memory = new Map<string, WatchlistItem>();

  constructor() {
    DEFAULT_WATCHLIST.forEach((item) => {
      this.memory.set(item.symbol, { ...item, addedAt: new Date().toISOString() });
    });

    if (config.DATABASE_URL) {
      this.pool = new Pool({ connectionString: config.DATABASE_URL });
      void this.ensureSchema();
    }
  }

  async list(): Promise<WatchlistItem[]> {
    if (!this.pool) return [...this.memory.values()];

    const result = await this.pool.query<WatchlistItem>(
      "select symbol, name, added_at as \"addedAt\" from watchlist order by added_at asc"
    );

    return result.rows;
  }

  async add(symbol: string, name?: string): Promise<WatchlistItem> {
    const item = {
      symbol: symbol.toUpperCase(),
      name: name?.trim() || symbol.toUpperCase(),
      addedAt: new Date().toISOString()
    };

    if (!this.pool) {
      this.memory.set(item.symbol, item);
      return item;
    }

    const result = await this.pool.query<WatchlistItem>(
      `insert into watchlist (symbol, name)
       values ($1, $2)
       on conflict (symbol) do update set name = excluded.name
       returning symbol, name, added_at as "addedAt"`,
      [item.symbol, item.name]
    );

    return result.rows[0];
  }

  async remove(symbol: string): Promise<void> {
    const normalized = symbol.toUpperCase();

    if (!this.pool) {
      this.memory.delete(normalized);
      return;
    }

    await this.pool.query("delete from watchlist where symbol = $1", [normalized]);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(`
      create table if not exists watchlist (
        symbol text primary key,
        name text not null,
        added_at timestamptz not null default now()
      )
    `);

    for (const item of DEFAULT_WATCHLIST) {
      await this.add(item.symbol, item.name);
    }
  }
}
