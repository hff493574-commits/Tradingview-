/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_SYMBOLS,
  INITIAL_NEWS,
  SymbolInfo,
  CandleBar,
  PriceAlert,
  TradePosition,
  generateHistoricalCandles,
  evaluateAlertTrigger,
} from './utils/marketEngine';
import {
  ChartStyleType,
  DrawingToolId,
  ChartDrawing,
  IndicatorConfig,
  RightRailTab,
} from './types/trading';
import { TopToolbar } from './components/TopToolbar';
import { LeftDrawingToolbar } from './components/LeftDrawingToolbar';
import { ChartWorkspace } from './components/ChartWorkspace';
import { RightSidebar } from './components/RightSidebar';
import { BottomBar } from './components/BottomBar';
import {
  SymbolSearchModal,
  IndicatorsModal,
  CreateAlertModal,
} from './components/Modals';

const DEFAULT_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  'D',
  'W',
  'M',
  '3M',
  '12M',
];

const INITIAL_INDICATORS: IndicatorConfig[] = [
  {
    id: 'iv-walls-1',
    name: 'IV WALLS [H+D+W+M+Q+Y]',
    shortTitle: 'IV WALLS[H+D+W+M+Q+Y]',
    paramsText: '5 1 2 20 1 1 5 1 1 20 1 1 5 2 2 10 2 1 5 1 2 10 2 1',
    visible: false,
    category: 'institutional',
  },
  {
    id: 'iv-walls-2',
    name: 'IV WALLS [D+W+H+4H] Institutional Sigma',
    shortTitle: 'IV WALLS[D+W+H+4H]',
    paramsText:
      'tiny 1 5 1 2 20 1 5 2 2 10 1 America/New_York 5 1 2 20 1 5 1 2 20 1 1030-1130 GMT-4 5 1 2 20 1 ∅ ∅ ∅ ∅ ∅ ∅ ∅ ...',
    visible: true,
    category: 'institutional',
  },
  {
    id: 'ssmt-zones',
    name: 'Quantum Wealth SSMT Liquidity Zones',
    shortTitle: 'Quantum Wealth SSMT',
    paramsText: '',
    visible: true,
    category: 'institutional',
  },
  {
    id: 'vwap',
    name: 'Session VWAP',
    shortTitle: 'VWAP Session',
    paramsText: 'hlc3',
    visible: false,
    category: 'overlay',
    color: '#ff9800',
  },
  {
    id: 'ema-20',
    name: 'EMA 20 Institutional Trend',
    shortTitle: 'EMA',
    paramsText: '20 close 0',
    visible: false,
    category: 'overlay',
    color: '#2962ff',
  },
  {
    id: 'volume',
    name: 'Volume Histogram',
    shortTitle: 'Vol',
    paramsText: '20',
    visible: false,
    category: 'volume',
  },
];

export default function App() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>(INITIAL_SYMBOLS);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([
    'NQ1!',
    'YM1!',
    'ES1!',
    'GC1!',
    'CL1!',
    'BTCUSD',
    'NVDA',
    'EURUSD',
  ]);
  const [activeSymbol, setActiveSymbol] = useState<string>('NQ1!');
  const [activeTimeframe, setActiveTimeframe] = useState<string>('1m');
  const [customTimeframes, setCustomTimeframes] = useState<string[]>([]);
  const [chartStyle, setChartStyle] = useState<ChartStyleType>('candles');
  // Screenshot 1 shows dark outer chrome with white chart canvas
  const [chartCanvasTheme, setChartCanvasTheme] = useState<'light' | 'dark'>('light');

  // Candles state for active symbol + timeframe
  const [candles, setCandles] = useState<CandleBar[]>(() =>
    generateHistoricalCandles(INITIAL_SYMBOLS[0], '1m', 330)
  );

  // Drawing tools & floating toolbar state
  const [activeTool, setActiveTool] = useState<DrawingToolId>('cursor');
  const [favoritesBarVisible, setFavoritesBarVisible] = useState<boolean>(true);
  const [magnetActive, setMagnetActive] = useState<boolean>(true);
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [drawingsLocked, setDrawingsLocked] = useState<boolean>(false);
  const [drawingsHidden, setDrawingsHidden] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [zoomTrigger, setZoomTrigger] = useState<number>(0);

  // Indicators, Alerts & Positions
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(INITIAL_INDICATORS);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [positions, setPositions] = useState<TradePosition[]>([]);

  // Right sidebar tab & bottom bar states
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('watchlist');
  const [activeRange, setActiveRange] = useState<string>('1D');
  const [ethSession, setEthSession] = useState<'ETH' | 'RTH'>('ETH');
  const [backAdjusted, setBackAdjusted] = useState<boolean>(true);
  const [logScale, setLogScale] = useState<boolean>(false);
  const [autoScale, setAutoScale] = useState<boolean>(true);

  // Bar Replay state
  const [replayActive, setReplayActive] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(300);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);

  // Modals state
  const [symbolModalOpen, setSymbolModalOpen] = useState<boolean>(false);
  const [symbolModalMode, setSymbolModalMode] = useState<'switch' | 'compare' | 'watchlist'>('switch');
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState<boolean>(false);
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);

  // Real-time WebSocket status
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState<boolean>(true);
  const [lastTickSymbol, setLastTickSymbol] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  const activeSymbolObj = symbols.find((s) => s.symbol === activeSymbol) || symbols[0];

  // Regenerate historical candles when symbol or timeframe changes
  useEffect(() => {
    const sym = symbols.find((s) => s.symbol === activeSymbol) || INITIAL_SYMBOLS[0];
    const generated = generateHistoricalCandles(sym, activeTimeframe, 330);
    setCandles(generated);
    setReplayIndex(Math.max(40, generated.length - 25));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, activeTimeframe]);

  // Connect to Real-Time WebSocket Market Feed (/ws/market on port 3000)
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/market`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isUnmounted) setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'market:init' && Array.isArray(msg.symbols)) {
            setSymbols(msg.symbols);
            if (typeof msg.liveStreamEnabled === 'boolean') {
              setLiveStreamEnabled(msg.liveStreamEnabled);
            }
          } else if (msg.type === 'feed:status') {
            setLiveStreamEnabled(Boolean(msg.liveStreamEnabled));
          } else if (msg.type === 'market:tick' && msg.tick) {
            const incoming: SymbolInfo = msg.tick;
            setLastTickSymbol(incoming.symbol);

            setSymbols((prev) => {
              const oldSym = prev.find((s) => s.symbol === incoming.symbol);
              if (oldSym) {
                // Check if any price alerts triggered
                setAlerts((prevAlerts) =>
                  prevAlerts.map((al) => {
                    if (
                      al.symbol === incoming.symbol &&
                      evaluateAlertTrigger(al, oldSym.price, incoming.price)
                    ) {
                      return {
                        ...al,
                        triggered: true,
                        triggeredAt: new Date().toLocaleTimeString(),
                      };
                    }
                    return al;
                  })
                );
              }
              return prev.map((s) => (s.symbol === incoming.symbol ? incoming : s));
            });

            // If this tick is for the currently displayed symbol, update the latest candle close/high/low/volume live!
            if (incoming.symbol === activeSymbolRef.current) {
              setCandles((prevCandles) => {
                if (prevCandles.length === 0) return prevCandles;
                const last = prevCandles[prevCandles.length - 1];
                const updatedLast: CandleBar = {
                  ...last,
                  close: incoming.price,
                  high: Math.max(last.high, incoming.price),
                  low: Math.min(last.low, incoming.price),
                  volume: last.volume + Math.floor(Math.random() * 12 + 1),
                };
                return [...prevCandles.slice(0, -1), updatedLast];
              });
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      socket.onclose = () => {
        if (!isUnmounted) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2000);
        }
      };
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Bar Replay auto-advance timer
  useEffect(() => {
    if (!replayActive || !replayPlaying) return;
    const timer = setInterval(() => {
      setReplayIndex((idx) => {
        if (idx >= candles.length) {
          setReplayPlaying(false);
          return candles.length;
        }
        return idx + 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [replayActive, replayPlaying, candles.length]);

  const handleToggleLiveStream = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'feed:toggle',
          enabled: !liveStreamEnabled,
        })
      );
    } else {
      setLiveStreamEnabled((v) => !v);
    }
  }, [liveStreamEnabled]);

  const handleQuickOrder = useCallback(
    (side: 'BUY' | 'SELL') => {
      const execPrice = side === 'BUY' ? activeSymbolObj.ask : activeSymbolObj.bid;
      const newPos: TradePosition = {
        id: `pos-${Date.now()}`,
        symbol: activeSymbolObj.symbol,
        side,
        qty: 1,
        entryPrice: execPrice,
        timestamp: new Date().toLocaleTimeString(),
      };
      setPositions((prev) => [newPos, ...prev]);
    },
    [activeSymbolObj]
  );

  const handleToggleSymbolFlag = useCallback((symbolKey: string) => {
    const cycle: Array<SymbolInfo['flagColor']> = ['red', 'orange', 'blue', null];
    setSymbols((prev) =>
      prev.map((s) => {
        if (s.symbol !== symbolKey) return s;
        const nextIdx = (cycle.indexOf(s.flagColor ?? null) + 1) % cycle.length;
        return { ...s, flagColor: cycle[nextIdx] };
      })
    );
  }, []);

  const handleAddCustomTimeframe = useCallback((tf: string) => {
    if (DEFAULT_TIMEFRAMES.includes(tf)) return;
    setCustomTimeframes((prev) => (prev.includes(tf) ? prev : [...prev, tf]));
  }, []);

  const handleRemoveCustomTimeframe = useCallback(
    (tf: string) => {
      setCustomTimeframes((prev) => prev.filter((item) => item !== tf));
      if (activeTimeframe === tf) {
        setActiveTimeframe('1m');
      }
    },
    [activeTimeframe]
  );

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0a0a0d] text-[#d1d4dc] overflow-hidden select-none">
      {/* Top Navigation & Chart Controls Bar */}
      <TopToolbar
        activeSymbol={activeSymbol}
        onOpenSymbolSearch={(mode) => {
          setSymbolModalMode(mode);
          setSymbolModalOpen(true);
        }}
        activeTimeframe={activeTimeframe}
        timeframes={DEFAULT_TIMEFRAMES}
        customTimeframes={customTimeframes}
        onSelectTimeframe={(tf) => setActiveTimeframe(tf)}
        onAddCustomTimeframe={handleAddCustomTimeframe}
        onRemoveCustomTimeframe={handleRemoveCustomTimeframe}
        chartStyle={chartStyle}
        onSelectChartStyle={setChartStyle}
        onOpenIndicators={() => setIndicatorsModalOpen(true)}
        activeIndicatorsCount={indicators.filter((i) => i.visible).length}
        onOpenAlertModal={() => setAlertModalOpen(true)}
        replayActive={replayActive}
        onToggleReplay={() => {
          setReplayActive((v) => !v);
          setReplayPlaying(false);
        }}
        onOpenTradeTicket={() => setRightRailTab('dom_trade')}
        chartCanvasTheme={chartCanvasTheme}
        onToggleChartCanvasTheme={() =>
          setChartCanvasTheme((t) => (t === 'light' ? 'dark' : 'light'))
        }
        wsConnected={wsConnected}
        liveStreamEnabled={liveStreamEnabled}
        onToggleLiveStream={handleToggleLiveStream}
      />

      {/* Main Middle Workspace: Left Drawing Toolbar + Center Chart & Bottom Bar + Right Watchlist/Details Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Vertical Drawing Tools Bar */}
        <LeftDrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          favoritesBarVisible={favoritesBarVisible}
          onToggleFavoritesBar={() => setFavoritesBarVisible((v) => !v)}
          magnetActive={magnetActive}
          onToggleMagnet={() => setMagnetActive((v) => !v)}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          drawingsLocked={drawingsLocked}
          onToggleLockDrawings={() => setDrawingsLocked((v) => !v)}
          drawingsHidden={drawingsHidden}
          onToggleHideDrawings={() => setDrawingsHidden((v) => !v)}
          onClearDrawings={() => setDrawings([])}
          onZoomIn={() => setZoomTrigger((z) => z + 1)}
        />

        {/* Center Column: Main Chart Canvas + Bottom Timeframe Range & Clock Bar */}
        <main className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <ChartWorkspace
            symbolInfo={activeSymbolObj}
            timeframe={activeTimeframe}
            candles={candles}
            chartStyle={chartStyle}
            chartCanvasTheme={chartCanvasTheme}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            magnetActive={magnetActive}
            stayInDrawingMode={stayInDrawingMode}
            drawingsLocked={drawingsLocked}
            drawingsHidden={drawingsHidden}
            drawings={drawings}
            onAddDrawing={(d) => setDrawings((prev) => [...prev, d])}
            onRemoveDrawing={(id) => setDrawings((prev) => prev.filter((item) => item.id !== id))}
            favoritesBarVisible={favoritesBarVisible}
            indicators={indicators}
            onToggleIndicatorVisibility={(id) =>
              setIndicators((prev) =>
                prev.map((ind) => (ind.id === id ? { ...ind, visible: !ind.visible } : ind))
              )
            }
            positions={positions}
            onQuickOrder={handleQuickOrder}
            onClosePosition={(id) => setPositions((prev) => prev.filter((p) => p.id !== id))}
            alerts={alerts}
            replayActive={replayActive}
            replayIndex={replayIndex}
            replayPlaying={replayPlaying}
            onReplayTogglePlay={() => setReplayPlaying((p) => !p)}
            onReplayStep={() =>
              setReplayIndex((idx) => Math.min(candles.length, idx + 1))
            }
            onReplayExit={() => {
              setReplayActive(false);
              setReplayPlaying(false);
            }}
            zoomTrigger={zoomTrigger}
            logScale={logScale}
            autoScale={autoScale}
            onOpenNewsDrawer={() => setRightRailTab('news_calendar')}
          />

          <BottomBar
            activeRange={activeRange}
            onSelectRange={setActiveRange}
            ethSession={ethSession}
            onToggleEthSession={() => setEthSession((s) => (s === 'ETH' ? 'RTH' : 'ETH'))}
            backAdjusted={backAdjusted}
            onToggleBackAdjusted={() => setBackAdjusted((b) => !b)}
            logScale={logScale}
            onToggleLogScale={() => setLogScale((l) => !l)}
            autoScale={autoScale}
            onToggleAutoScale={() => setAutoScale((a) => !a)}
          />
        </main>

        {/* Right Watchlist, Symbol Details, Forward Curve & Far-Right Icon Rail */}
        <RightSidebar
          symbols={symbols}
          watchlistSymbols={watchlistSymbols}
          activeSymbol={activeSymbol}
          onSelectSymbol={(sym) => setActiveSymbol(sym)}
          onRemoveFromWatchlist={(sym) =>
            setWatchlistSymbols((prev) => prev.filter((item) => item !== sym))
          }
          onToggleSymbolFlag={handleToggleSymbolFlag}
          onOpenAddSymbol={() => {
            setSymbolModalMode('watchlist');
            setSymbolModalOpen(true);
          }}
          news={INITIAL_NEWS}
          activeTab={rightRailTab}
          onSelectTab={setRightRailTab}
          alerts={alerts}
          onOpenCreateAlert={() => setAlertModalOpen(true)}
          onRemoveAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
          drawings={drawings}
          onRemoveDrawing={(id) => setDrawings((prev) => prev.filter((d) => d.id !== id))}
          indicators={indicators}
          onToggleIndicator={(id) =>
            setIndicators((prev) =>
              prev.map((ind) => (ind.id === id ? { ...ind, visible: !ind.visible } : ind))
            )
          }
          positions={positions}
          onQuickOrder={handleQuickOrder}
          onClosePosition={(id) => setPositions((prev) => prev.filter((p) => p.id !== id))}
          lastTickSymbol={lastTickSymbol}
        />
      </div>

      {/* Modals */}
      <SymbolSearchModal
        open={symbolModalOpen}
        mode={symbolModalMode}
        symbols={symbols}
        activeSymbol={activeSymbol}
        watchlistSymbols={watchlistSymbols}
        onSelectSymbol={(sym) => setActiveSymbol(sym)}
        onAddToWatchlist={(sym) =>
          setWatchlistSymbols((prev) => (prev.includes(sym) ? prev : [...prev, sym]))
        }
        onClose={() => setSymbolModalOpen(false)}
      />

      <IndicatorsModal
        open={indicatorsModalOpen}
        indicators={indicators}
        onToggleIndicator={(id) =>
          setIndicators((prev) =>
            prev.map((ind) => (ind.id === id ? { ...ind, visible: !ind.visible } : ind))
          )
        }
        onClose={() => setIndicatorsModalOpen(false)}
      />

      <CreateAlertModal
        open={alertModalOpen}
        symbolInfo={activeSymbolObj}
        onCreateAlert={(newAlert) =>
          setAlerts((prev) => [
            {
              ...newAlert,
              id: `alert-${Date.now()}`,
              triggered: false,
              createdAt: new Date().toLocaleTimeString(),
            },
            ...prev,
          ])
        }
        onClose={() => setAlertModalOpen(false)}
      />
    </div>
  );
}
