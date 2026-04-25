import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  FINNHUB_API_KEY: z.string().optional(),
  YAHOO_FINANCE_ENABLED: z.coerce.boolean().default(true),
  REDIS_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().default(2)
});

export const config = envSchema.parse(process.env);
