import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { filterCandlesBySession } from './src/utils/marketEngine.ts';
import { LseClient } from './src/server/lseClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json());

  const lseApiKey = process.env.LSE_API_KEY || '';
  const lse = new LseClient(lseApiKey);
  let liveStreamEnabled = true;
  let tickSequence = 1;

  // Hydrate initial watchlist prices from LSE Data 3.0 REST API on boot
  lse.hydrateWatchlistFromLse().catch((err) => {
    console.warn('[LSE] Initial watchlist hydration skipped:', err?.message || err);
  });

  // WebSocket Server attached to HTTP Server on port 3000
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/market' });

  const broadcast = (payload: Record<string, unknown>) => {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  // Start real LSE upstream WebSocket feeds (data-ws + london-ws)
  lse.startWebSockets((updatedSymbol, rawTick) => {
    if (!liveStreamEnabled) return;
    broadcast({
      type: 'market:tick',
      seq: ++tickSequence,
      tick: updatedSymbol,
      rawTick,
      timestamp: Date.now(),
    });
  });

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'market:init',
        symbols: lse.getAllSymbols(),
        liveStreamEnabled,
        wsStatus: lse.getWsStatus(),
        serverTime: Date.now(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'feed:toggle') {
          liveStreamEnabled =
            typeof data.enabled === 'boolean' ? data.enabled : !liveStreamEnabled;
          lse.setStreamPaused(!liveStreamEnabled);
          broadcast({
            type: 'feed:status',
            liveStreamEnabled,
            wsStatus: lse.getWsStatus(),
          });
        } else if (data.type === 'ws:reconnect') {
          lse.reconnectWebSockets();
          broadcast({
            type: 'feed:status',
            liveStreamEnabled,
            wsStatus: lse.getWsStatus(),
          });
        }
      } catch {
        // Ignore malformed client message
      }
    });
  });

  // --- Market Data REST Endpoints ---

  app.get('/api/market/snapshot', (_req, res) => {
    res.json({
      symbols: lse.getAllSymbols(),
      serverTime: Date.now(),
      liveStreamEnabled,
      wsStatus: lse.getWsStatus(),
      apiConfigured: lse.hasKey(),
    });
  });

  app.post('/api/market/refresh', async (_req, res) => {
    try {
      await lse.hydrateWatchlistFromLse();
      const all = lse.getAllSymbols();
      broadcast({
        type: 'market:init',
        symbols: all,
        liveStreamEnabled,
        wsStatus: lse.getWsStatus(),
        serverTime: Date.now(),
      });
      res.json({ symbols: all, wsStatus: lse.getWsStatus() });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/market/candles', async (req, res) => {
    try {
      const symbolKey = String(req.query.symbol || 'NASDAQ100');
      const market = req.query.market ? String(req.query.market) : undefined;
      const httpSymbol = req.query.httpSymbol ? String(req.query.httpSymbol) : undefined;
      const timeframe = String(req.query.timeframe || '1m');
      const range = String(req.query.range || '1D');
      const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
      const adjusted = req.query.adjusted !== '0';
      const ethSession = req.query.eth === 'RTH' ? 'RTH' : 'ETH';

      const result = await lse.getCandles({
        symbolKey,
        market,
        httpSymbol,
        timeframe,
        range,
        toDate,
        adjusted,
      });

      const candles = filterCandlesBySession(result.candles, ethSession);
      const sym = lse.getSymbol(result.symbol);
      if (sym) {
        lse.ensureSubscribed(sym);
      }

      res.json({
        symbol: result.symbol,
        market: result.market,
        httpSymbol: result.httpSymbol,
        timeframe: result.timeframe,
        candles,
        source: result.source,
        from: result.from,
        to: result.to,
      });
    } catch (err) {
      res.status(502).json({
        error: (err as Error).message || 'Failed to load candles from LSE Data 3.0',
      });
    }
  });

  app.post('/api/market/subscribe', async (req, res) => {
    try {
      const market = String(req.body?.market || 'us_stocks');
      const pairSymbol = String(req.body?.symbol || '').trim();
      const pairName = String(req.body?.name || pairSymbol).trim();
      if (!pairSymbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
      }
      const sym = await lse.subscribeAndHydrate(market, pairSymbol, pairName);
      broadcast({
        type: 'symbol:added',
        symbol: sym,
        symbols: lse.getAllSymbols(),
      });
      res.json({ symbol: sym, wsStatus: lse.getWsStatus() });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // --- LSE Data 3.0 Metadata, Reference, Macro & Export Endpoints ---

  app.get('/api/lse/usage', async (_req, res) => {
    try {
      const usage = await lse.fetchJson<Record<string, unknown>>('/v3/usage', 15_000);
      res.json({
        ...usage,
        ws: lse.getWsStatus(),
      });
    } catch (err) {
      res.status(502).json({
        error: (err as Error).message,
        ws: lse.getWsStatus(),
      });
    }
  });

  app.post('/api/lse/ws/reconnect', (_req, res) => {
    lse.reconnectWebSockets();
    res.json({ wsStatus: lse.getWsStatus() });
  });

  app.get('/api/lse/markets', async (_req, res) => {
    try {
      const data = await lse.fetchJson('/v3/markets', 5 * 60_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/pairs', async (req, res) => {
    try {
      const market = String(req.query.market || 'us_stocks');
      const q = String(req.query.q || '').trim();
      const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 40));
      const qs = new URLSearchParams({ market, limit: String(limit) });
      if (q) qs.set('q', q);
      const data = await lse.fetchJson(`/v3/pairs?${qs.toString()}`, 2 * 60_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/details', async (req, res) => {
    const symbolKey = String(req.query.symbol || 'NASDAQ100');
    const sym = lse.getSymbol(symbolKey);
    const market = String(req.query.market || sym?.lseMarket || 'futures');
    const httpSymbol = String(req.query.httpSymbol || sym?.lseHttpSymbol || 'NASDAQ100');

    const [overviewRes, factorsRes, profileRes] = await Promise.allSettled([
      lse.fetchJson<{ history?: { first: string; last: string; rows: number; timeframe: string } }>(
        `/v3/overview?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      lse.fetchJson<{
        dividends?: Array<{ ex_date?: string; amount?: number; currency?: string; declaration_date?: string }>;
        splits?: Array<{ date?: string; numerator?: number; denominator?: number; ratio?: string }>;
      }>(
        `/v3/factors?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      market === 'us_stocks'
        ? lse.fetchJson<{ rows?: Array<Record<string, unknown>> }>(
            `/v3/reference/preview?dataset=company_profiles&symbol=${encodeURIComponent(httpSymbol)}&limit=1`,
            10 * 60_000
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
    const factors = factorsRes.status === 'fulfilled' ? factorsRes.value : null;
    const profileRows = profileRes.status === 'fulfilled' ? profileRes.value?.rows || [] : [];

    res.json({
      symbol: sym?.symbol || symbolKey,
      market,
      httpSymbol,
      history: overview?.history || null,
      factors: factors
        ? {
            dividendsCount: Array.isArray(factors.dividends) ? factors.dividends.length : 0,
            recentDividends: Array.isArray(factors.dividends) ? factors.dividends.slice(0, 8) : [],
            splits: Array.isArray(factors.splits) ? factors.splits.slice(0, 8) : [],
          }
        : null,
      profile: profileRows[0] || null,
    });
  });

  app.get('/api/lse/calendar', async (req, res) => {
    try {
      const limit = Math.min(60, Math.max(5, Number(req.query.limit) || 30));
      const data = await lse.fetchJson<{ rows?: unknown[] }>(
        `/v3/reference/preview?dataset=economic_calendar&limit=${limit}`,
        3 * 60_000
      );
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/bond-yields', async (req, res) => {
    try {
      const limit = Math.min(60, Math.max(5, Number(req.query.limit) || 30));
      const [yieldsRes, macroRes] = await Promise.allSettled([
        lse.fetchJson<{ rows?: unknown[] }>(
          `/v3/reference/preview?dataset=bond_yields&limit=${limit}`,
          5 * 60_000
        ),
        lse.fetchJson<Record<string, unknown>>('/v3/macro', 10 * 60_000),
      ]);
      res.json({
        rows: yieldsRes.status === 'fulfilled' ? yieldsRes.value.rows || [] : [],
        macro: macroRes.status === 'fulfilled' ? macroRes.value : null,
      });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/estimate', async (req, res) => {
    try {
      const market = String(req.query.market || 'futures');
      const symbol = String(req.query.symbol || 'NASDAQ100');
      const timeframe = String(req.query.timeframe || '1m');
      const from = String(req.query.from || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10));
      const to = String(req.query.to || new Date().toISOString().slice(0, 10));
      const qs = new URLSearchParams({ market, symbol, timeframe, from, to });
      const data = await lse.fetchJson(`/v3/estimate?${qs.toString()}`, 30_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/export', async (req, res) => {
    try {
      const market = String(req.query.market || 'futures');
      const symbol = String(req.query.symbol || 'NASDAQ100');
      const timeframe = String(req.query.timeframe || '1m');
      const from = String(req.query.from || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10));
      const to = String(req.query.to || new Date().toISOString().slice(0, 10));
      const adjusted = req.query.adjusted !== '0';

      const csv = await lse.exportRawCsv({ market, symbol, timeframe, from, to, adjusted });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${symbol}_${timeframe}_${from}_to_${to}.csv"`
      );
      res.send(csv);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/chain', async (req, res) => {
    try {
      const underlying = String(req.query.underlying || 'AAPL');
      const contractType = req.query.contract_type ? String(req.query.contract_type) : undefined;
      const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 250;
      const data = await lse.getOptionsChain({ underlying, contractType, expiry, limit });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/flow', async (req, res) => {
    try {
      const underlying = req.query.underlying ? String(req.query.underlying) : undefined;
      const minPremium = req.query.min_premium ? Number(req.query.min_premium) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 60;
      const data = await lse.getOptionsFlow({ underlying, minPremium, limit });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/gex', async (req, res) => {
    try {
      const underlying = String(req.query.underlying || 'SPY');
      const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
      const flowScope = req.query.flow_scope === 'all' ? 'all' : '0dte';
      const data = await lse.getOptionsGexDashboard({ underlying, expiry, flowScope });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // --- Vite / Static Assets ---
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

  const shutdown = () => {
    lse.stopWebSockets();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TradingView Supercharts + LSE Data 3.0 server running on http://localhost:${PORT}`);
  });
}

startServer();
