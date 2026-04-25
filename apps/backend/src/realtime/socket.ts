import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "../config.js";
import type { MarketService } from "../services/marketService.js";

export function createRealtimeServer(httpServer: HttpServer, marketService: MarketService): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ["GET", "POST", "DELETE"]
    }
  });

  const broadcastSnapshot = async () => {
    io.emit("market:snapshot", await marketService.snapshot());
  };

  io.on("connection", (socket) => {
    socket.emit("connection:ready", { id: socket.id });
    void broadcastSnapshot();
  });

  setInterval(() => {
    void broadcastSnapshot();
  }, config.MARKET_TICK_INTERVAL_MS);

  return io;
}
