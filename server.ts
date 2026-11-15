import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  INITIAL_SYMBOLS,
  SymbolInfo,
  generateHistoricalCandles,
  roundToTick,
} from './src/utils/marketEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Server-authoritative state for market symbols
  const marketState = new Map<string, SymbolInfo>();
  for (const sym of INITIAL_SYMBOLS) {
    marketState.set(sym.symbol, { ...sym });
  }

  let liveStreamEnabled = true;
  let tickSequence = 1;

  // REST API for snapshot & candles
  app.get('/api/market/snapshot', (_req, res) => {
    res.json({
      symbols: Array.from(marketState.values()),
      serverTime: Date.now(),
      liveStreamEnabled,
    });
  });

  app.get('/api/market/candles', (req, res) => {
    const symbolKey = String(req.query.symbol || 'NQ1!');
    const timeframe = String(req.query.timeframe || '1m');
    const sym = marketState.get(symbolKey) || INITIAL_SYMBOLS[0];
    const candles = generateHistoricalCandles(sym, timeframe, 330);
    res.json({
      symbol: sym.symbol,
      timeframe,
      candles,
    });
  });

  // WebSocket Server attached to HTTP Server on same port 3000
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/market' });

  const broadcast = (payload: Record<string, unknown>) => {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  wss.on('connection', (ws) => {
    // 1. Send initial authoritative state on connect
    ws.send(
      JSON.stringify({
        type: 'market:init',
        symbols: Array.from(marketState.values()),
        liveStreamEnabled,
        serverTime: Date.now(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'feed:toggle') {
          liveStreamEnabled = typeof data.enabled === 'boolean' ? data.enabled : !liveStreamEnabled;
          broadcast({
            type: 'feed:status',
            liveStreamEnabled,
          });
        } else if (data.type === 'market:nudge' && data.symbol) {
          const current = marketState.get(data.symbol);
          if (current) {
            const deltaTicks = Number(data.deltaTicks) || (Math.random() > 0.5 ? 2 : -2);
            const delta = deltaTicks * current.tickSize;
            const nextPrice = roundToTick(current.price + delta, current.tickSize, current.decimals);
            const nextChange = Number((nextPrice - current.dayOpen).toFixed(current.decimals));
            const nextChangePct = Number(((nextChange / current.dayOpen) * 100).toFixed(2));
            const halfSpread = current.spread / 2;
            const updated: SymbolInfo = {
              ...current,
              price: nextPrice,
              change: nextChange,
              changePercent: nextChangePct,
              bid: roundToTick(nextPrice - halfSpread, current.tickSize, current.decimals),
              ask: roundToTick(nextPrice + halfSpread, current.tickSize, current.decimals),
              dayHigh: Math.max(current.dayHigh, nextPrice),
              dayLow: Math.min(current.dayLow, nextPrice),
              volume24h: current.volume24h + Math.floor(Math.random() * 25 + 5),
            };
            marketState.set(current.symbol, updated);
            broadcast({
              type: 'market:tick',
              seq: ++tickSequence,
              tick: updated,
              timestamp: Date.now(),
            });
          }
        }
      } catch {
        // Ignore malformed client message
      }
    });
  });

  // Authoritative server-side market tick engine broadcasting delta updates
  setInterval(() => {
    if (!liveStreamEnabled || wss.clients.size === 0) return;

    const symbolsList = Array.from(marketState.values());
    // Always include NQ1! plus 1-2 other random symbols per tick so the primary chart & watchlist feel alive
    const targets: SymbolInfo[] = [];
    const nq = marketState.get('NQ1!');
    if (nq) targets.push(nq);

    const otherIdx = Math.floor(Math.random() * symbolsList.length);
    if (symbolsList[otherIdx] && symbolsList[otherIdx].symbol !== 'NQ1!') {
      targets.push(symbolsList[otherIdx]);
    }

    for (const sym of targets) {
      // Gentle mean-reverting micro-ticks around initial anchor price so the chart stays faithful to reference levels
      const anchor = INITIAL_SYMBOLS.find((s) => s.symbol === sym.symbol)?.price ?? sym.price;
      const driftFromAnchor = (anchor - sym.price) / (sym.tickSize * 12);
      const stepTicks = Math.round((Math.random() - 0.5 + driftFromAnchor * 0.15) * 3);
      const tickDelta = (stepTicks === 0 ? (Math.random() > 0.5 ? 1 : -1) : stepTicks) * sym.tickSize;

      const nextPrice = roundToTick(sym.price + tickDelta, sym.tickSize, sym.decimals);
      const nextChange = Number((nextPrice - sym.dayOpen).toFixed(sym.decimals));
      const nextChangePct = Number(((nextChange / sym.dayOpen) * 100).toFixed(2));
      const halfSpread = sym.spread / 2;

      const updated: SymbolInfo = {
        ...sym,
        price: nextPrice,
        change: nextChange,
        changePercent: nextChangePct,
        bid: roundToTick(nextPrice - halfSpread, sym.tickSize, sym.decimals),
        ask: roundToTick(nextPrice + halfSpread, sym.tickSize, sym.decimals),
        dayHigh: Math.max(sym.dayHigh, nextPrice),
        dayLow: Math.min(sym.dayLow, nextPrice),
        volume24h: sym.volume24h + Math.floor(Math.random() * 14 + 2),
      };

      marketState.set(sym.symbol, updated);

      broadcast({
        type: 'market:tick',
        seq: ++tickSequence,
        tick: updated,
        timestamp: Date.now(),
      });
    }
  }, 1100);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TradingView Supercharts server + WebSocket running on http://localhost:${PORT}`);
  });
}

startServer();
