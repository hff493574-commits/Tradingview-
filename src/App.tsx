/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_SYMBOLS,
  SymbolInfo,
  CandleBar,
  PriceAlert,
  TradePosition,
  evaluateAlertTrigger,
  parseTimeframeToSeconds,
  parseLseTimeToUnix,
  mergeTickIntoCandles,
} from './utils/marketEngine';
import {
  ChartStyleType,
  DrawingToolId,
  ChartDrawing,
  IndicatorConfig,
  RightRailTab,
  CompareOverlay,
  LseUsageData,
  EconomicEventItem,
  BondYieldItem,
  TickTapeEntry,
  LseSymbolDetails,
  ChartSettingsConfig,
  getDefaultChartSettings,
  LAYOUT_PRESETS,
  LayoutSyncConfig,
  ChartPaneConfig,
  ChartGexOverlayLevel,
} from './types/trading';
import { TopToolbar } from './components/TopToolbar';
import { LeftDrawingToolbar } from './components/LeftDrawingToolbar';
import { DEFAULT_FAVORITE_TOOLS } from './components/FloatingFavoritesToolbar';
import { ChartWorkspace } from './components/ChartWorkspace';
import { RightSidebar } from './components/RightSidebar';
import { BottomBar } from './components/BottomBar';
import {
  SymbolSearchModal,
  IndicatorsModal,
  CreateAlertModal,
  LseAccountUsageModal,
} from './components/Modals';
import { ChartSettingsModal, SettingsTabId } from './components/ChartSettingsModal';
import { GexDashboardModal } from './components/GexDashboardModal';
import { translateDrawing } from './utils/drawingEngine';

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
    paramsText: 'Dynamic 1σ Realized Volatility Levels',
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
    id: 'sma-50',
    name: 'SMA 50 Trend Baseline',
    shortTitle: 'SMA',
    paramsText: '50 close 0',
    visible: false,
    category: 'overlay',
    color: '#e040fb',
  },
  {
    id: 'bb-20',
    name: 'Bollinger Bands (20, 2)',
    shortTitle: 'BB',
    paramsText: '20 2',
    visible: false,
    category: 'overlay',
    color: '#26a69a',
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

const COMPARE_COLORS = ['#ff9800', '#e040fb', '#26a69a', '#f59e0b'];
const CHART_SETTINGS_STORAGE_KEY = 'tv_lse_chart_settings_v1';

const INITIAL_PANES: ChartPaneConfig[] = [
  { id: 'pane-1', symbol: 'NASDAQ100', timeframe: '1m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-2', symbol: 'BTCUSDT', timeframe: '1m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-3', symbol: 'GOLD', timeframe: '5m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-4', symbol: 'EUR_USD', timeframe: '15m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-5', symbol: 'NVDA', timeframe: '5m', range: '5D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-6', symbol: 'SP500', timeframe: '5m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-7', symbol: 'DOW', timeframe: '15m', range: '5D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-8', symbol: 'CRUDEOIL', timeframe: '15m', range: '5D', toDate: '', chartStyle: 'candles' },
];

interface CachedCandleEntry {
  candles: CandleBar[];
  loading: boolean;
  error: string | null;
  source: string;
}

function makeCandleCacheKey(
  symbol: string,
  timeframe: string,
  range: string,
  toDate: string,
  backAdjusted: boolean,
  ethSession: 'ETH' | 'RTH'
): string {
  return `${symbol}__${timeframe}__${range}__${toDate}__${backAdjusted ? 1 : 0}__${ethSession}`;
}

function loadInitialChartSettings(theme: 'light' | 'dark'): ChartSettingsConfig {
  const defaults = getDefaultChartSettings(theme);
  try {
    const raw = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export default function App() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>(INITIAL_SYMBOLS);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([
    'NASDAQ100',
    'DOW',
    'SP500',
    'GOLD',
    'CRUDEOIL',
    'BTCUSDT',
    'NVDA',
    'EUR_USD',
  ]);
  const [customTimeframes, setCustomTimeframes] = useState<string[]>([]);
  const [chartCanvasTheme, setChartCanvasTheme] = useState<'light' | 'dark'>('light');
  const [chartSettings, setChartSettings] = useState<ChartSettingsConfig>(() =>
    loadInitialChartSettings('light')
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('symbol');

  // Multi-chart layout & sync state
  const [layoutId, setLayoutId] = useState<string>('1');
  const [layoutSync, setLayoutSync] = useState<LayoutSyncConfig>({
    symbol: false,
    interval: false,
    crosshair: true,
    time: false,
    dateRange: false,
  });
  const [panes, setPanes] = useState<ChartPaneConfig[]>(INITIAL_PANES);
  const [activePaneId, setActivePaneId] = useState<string>('pane-1');
  const [syncedCrosshair, setSyncedCrosshair] = useState<{
    time: number;
    sourcePaneId: string;
  } | null>(null);
  const [syncedTimeRange, setSyncedTimeRange] = useState<{
    from: number;
    to: number;
    sourcePaneId: string;
  } | null>(null);

  const currentLayoutPreset =
    LAYOUT_PRESETS.find((p) => p.id === layoutId) || LAYOUT_PRESETS[0];
  const visiblePanes = panes.slice(0, currentLayoutPreset.count);
  const activePane =
    visiblePanes.find((p) => p.id === activePaneId) || visiblePanes[0] || panes[0];

  const activeSymbol = activePane.symbol;
  const activeTimeframe = activePane.timeframe;
  const activeRange = activePane.range;
  const toDate = activePane.toDate;
  const chartStyle = activePane.chartStyle;

  // Deduplicated candle cache keyed by symbol + timeframe + range + toDate + adjusted + eth
  const [candleCache, setCandleCache] = useState<Record<string, CachedCandleEntry>>({});
  const candleCacheRef = useRef<Record<string, CachedCandleEntry>>({});
  candleCacheRef.current = candleCache;
  const [candlesRetrySeq, setCandlesRetrySeq] = useState<number>(0);
  const lastRetrySeqRef = useRef<number>(0);
  const [compareOverlays, setCompareOverlays] = useState<CompareOverlay[]>([]);

  // Drawing tools & floating toolbar state
  const [activeTool, setActiveTool] = useState<DrawingToolId>('cursor');
  const [favoritesBarVisible, setFavoritesBarVisible] = useState<boolean>(true);
  const [favoriteToolIds, setFavoriteToolIds] = useState<DrawingToolId[]>(DEFAULT_FAVORITE_TOOLS);
  const [magnetActive, setMagnetActive] = useState<boolean>(true);
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [drawingsLocked, setDrawingsLocked] = useState<boolean>(false);
  const [drawingsHidden, setDrawingsHidden] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawingPast, setDrawingPast] = useState<ChartDrawing[][]>([]);
  const [drawingFuture, setDrawingFuture] = useState<ChartDrawing[][]>([]);
  const [zoomTrigger, setZoomTrigger] = useState<number>(0);

  // Indicators, Alerts & Positions
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(INITIAL_INDICATORS);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [positions, setPositions] = useState<TradePosition[]>([]);

  // Right sidebar tab & bottom bar states
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('watchlist');
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [ethSession, setEthSession] = useState<'ETH' | 'RTH'>('ETH');
  const [backAdjusted, setBackAdjusted] = useState<boolean>(true);
  const [logScale, setLogScale] = useState<boolean>(false);
  const [autoScale, setAutoScale] = useState<boolean>(true);
  const [timezoneId, setTimezoneId] = useState<string>('America/New_York');

  // LSE Reference, Macro, Usage & Live Tape data
  const [economicEvents, setEconomicEvents] = useState<EconomicEventItem[]>([]);
  const [bondYields, setBondYields] = useState<BondYieldItem[]>([]);
  const [symbolDetails, setSymbolDetails] = useState<LseSymbolDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [tickTape, setTickTape] = useState<TickTapeEntry[]>([]);
  const [lseUsage, setLseUsage] = useState<LseUsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState<boolean>(false);

  // Bar Replay state
  const [replayActive, setReplayActive] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(120);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);

  // Modals state
  const [symbolModalOpen, setSymbolModalOpen] = useState<boolean>(false);
  const [symbolModalMode, setSymbolModalMode] = useState<'switch' | 'compare' | 'watchlist'>('switch');
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState<boolean>(false);
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [usageModalOpen, setUsageModalOpen] = useState<boolean>(false);
  const [gexModalOpen, setGexModalOpen] = useState<boolean>(false);
  const [gexUnderlying, setGexUnderlying] = useState<string>('SPY');
  const [gexOverlayLevels, setGexOverlayLevels] = useState<ChartGexOverlayLevel[]>([]);

  // Real-time WebSocket status
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState<boolean>(true);
  const [lastTickSymbol, setLastTickSymbol] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  const activePaneRef = useRef(activePane);
  activePaneRef.current = activePane;

  const activeSymbolObj = symbols.find((s) => s.symbol === activeSymbol) || symbols[0];

  const activeCacheKey = makeCandleCacheKey(
    activeSymbol,
    activeTimeframe,
    activeRange,
    toDate,
    backAdjusted,
    ethSession
  );
  const activeCacheEntry = candleCache[activeCacheKey];
  const candles = activeCacheEntry?.candles ?? [];
  const loadingCandles = activeCacheEntry ? activeCacheEntry.loading : true;
  const candlesError = activeCacheEntry?.error ?? null;

  const setActiveSymbol = useCallback(
    (nextSymbol: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.symbol ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, symbol: nextSymbol };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.symbol]
  );

  const setActiveTimeframe = useCallback(
    (nextTimeframe: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.interval ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, timeframe: nextTimeframe };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.interval]
  );

  const setActiveRangeAndDate = useCallback(
    (nextRange: string, nextToDate?: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.dateRange ? visibleIds.has(p.id) : p.id === activePane.id) {
            return {
              ...p,
              range: nextRange,
              toDate: nextToDate !== undefined ? nextToDate : p.toDate,
            };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.dateRange]
  );

  const setToDate = useCallback(
    (nextToDate: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.dateRange ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, toDate: nextToDate };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.dateRange]
  );

  const setChartStyle = useCallback(
    (nextStyle: ChartStyleType) => {
      setPanes((prev) =>
        prev.map((p) => (p.id === activePane.id ? { ...p, chartStyle: nextStyle } : p))
      );
    },
    [activePane.id]
  );

  const handleSelectLayout = useCallback(
    (nextLayoutId: string) => {
      const preset = LAYOUT_PRESETS.find((p) => p.id === nextLayoutId) || LAYOUT_PRESETS[0];
      setLayoutId(preset.id);
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, preset.count).map((p) => p.id));
        if (!visibleIds.has(activePane.id)) {
          setActivePaneId(prev[0].id);
        }
        if (!layoutSync.symbol && !layoutSync.interval && !layoutSync.dateRange) {
          return prev;
        }
        return prev.map((p) => {
          if (!visibleIds.has(p.id)) return p;
          return {
            ...p,
            symbol: layoutSync.symbol ? activePane.symbol : p.symbol,
            timeframe: layoutSync.interval ? activePane.timeframe : p.timeframe,
            range: layoutSync.dateRange ? activePane.range : p.range,
            toDate: layoutSync.dateRange ? activePane.toDate : p.toDate,
          };
        });
      });
    },
    [activePane, layoutSync]
  );

  const handleToggleLayoutSync = useCallback(
    (key: keyof LayoutSyncConfig) => {
      setLayoutSync((prev) => {
        const nextVal = !prev[key];
        const next = { ...prev, [key]: nextVal };
        if (nextVal && (key === 'symbol' || key === 'interval' || key === 'dateRange')) {
          setPanes((currPanes) => {
            const visibleIds = new Set(
              currPanes.slice(0, currentLayoutPreset.count).map((p) => p.id)
            );
            return currPanes.map((p) => {
              if (!visibleIds.has(p.id)) return p;
              return {
                ...p,
                symbol: key === 'symbol' ? activePane.symbol : p.symbol,
                timeframe: key === 'interval' ? activePane.timeframe : p.timeframe,
                range: key === 'dateRange' ? activePane.range : p.range,
                toDate: key === 'dateRange' ? activePane.toDate : p.toDate,
              };
            });
          });
        }
        return next;
      });
    },
    [activePane, currentLayoutPreset.count]
  );

  const handleToggleChartCanvasTheme = useCallback(() => {
    setChartCanvasTheme((prevTheme) => {
      const nextTheme = prevTheme === 'light' ? 'dark' : 'light';
      const themeDefaults = getDefaultChartSettings(nextTheme);
      setChartSettings((prevSettings) => {
        const updated: ChartSettingsConfig = {
          ...prevSettings,
          ...(!prevSettings.useCustomCandleColors
            ? {
                bodyUpColor: themeDefaults.bodyUpColor,
                bodyDownColor: themeDefaults.bodyDownColor,
                borderUpColor: themeDefaults.borderUpColor,
                borderDownColor: themeDefaults.borderDownColor,
                wickUpColor: themeDefaults.wickUpColor,
                wickDownColor: themeDefaults.wickDownColor,
              }
            : {}),
          ...(!prevSettings.useCustomCanvasColors
            ? {
                bgType: themeDefaults.bgType,
                bgColor: themeDefaults.bgColor,
                bgColorBottom: themeDefaults.bgColorBottom,
                vertGridColor: themeDefaults.vertGridColor,
                horzGridColor: themeDefaults.horzGridColor,
                crosshairColor: themeDefaults.crosshairColor,
                watermarkColor: themeDefaults.watermarkColor,
                scalesTextColor: themeDefaults.scalesTextColor,
                scalesLinesColor: themeDefaults.scalesLinesColor,
              }
            : {}),
        };
        try {
          localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      return nextTheme;
    });
  }, []);

  // Hydrate initial LSE market snapshot + Economic Calendar on mount
  useEffect(() => {
    fetch('/api/market/snapshot')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.symbols)) {
          setSymbols(data.symbols);
        }
      })
      .catch(() => {});

    fetch('/api/lse/calendar?limit=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rows)) {
          setEconomicEvents(data.rows);
        }
      })
      .catch(() => {
        // Keep empty gracefully if offline
      });
  }, []);

  // Fetch Sovereign Bond Yields lazily when Macro tab is opened
  useEffect(() => {
    if (rightRailTab !== 'macro_yields' || bondYields.length > 0) return;
    fetch('/api/lse/bond-yields?limit=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rows)) {
          setBondYields(data.rows);
        }
      })
      .catch(() => {});
  }, [rightRailTab, bondYields.length]);

  // Fetch Symbol Fundamentals/Details when Fundamentals tab opens or activeSymbol changes while tab is open
  useEffect(() => {
    if (rightRailTab !== 'screener_factors') return;
    let cancelled = false;
    setLoadingDetails(true);
    const qs = new URLSearchParams({
      symbol: activeSymbolObj.symbol,
      market: activeSymbolObj.lseMarket,
      httpSymbol: activeSymbolObj.lseHttpSymbol,
    });
    fetch(`/api/lse/details?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSymbolDetails(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rightRailTab, activeSymbolObj.symbol, activeSymbolObj.lseMarket, activeSymbolObj.lseHttpSymbol]);

  const fetchLseUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch('/api/lse/usage');
      if (res.ok) {
        const data = await res.json();
        setLseUsage(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (usageModalOpen) {
      fetchLseUsage();
    }
  }, [usageModalOpen, fetchLseUsage]);

  const visiblePaneSpecsSig = visiblePanes
    .map((p) =>
      makeCandleCacheKey(p.symbol, p.timeframe, p.range, p.toDate, backAdjusted, ethSession)
    )
    .join('|');

  // Fetch real OHLCV candles from LSE Data 3.0 backend proxy for all unique visible panes
  useEffect(() => {
    const controller = new AbortController();
    const forceRetry = candlesRetrySeq !== lastRetrySeqRef.current;
    lastRetrySeqRef.current = candlesRetrySeq;

    const seenKeys = new Set<string>();
    const toFetch: Array<{
      cacheKey: string;
      symbol: string;
      timeframe: string;
      range: string;
      toDate: string;
    }> = [];

    for (const pane of visiblePanes) {
      const cacheKey = makeCandleCacheKey(
        pane.symbol,
        pane.timeframe,
        pane.range,
        pane.toDate,
        backAdjusted,
        ethSession
      );
      if (seenKeys.has(cacheKey)) continue;
      seenKeys.add(cacheKey);
      const existing = candleCacheRef.current[cacheKey];
      if (!forceRetry && existing && !existing.error && existing.candles.length > 0 && !existing.loading) {
        continue;
      }
      toFetch.push({
        cacheKey,
        symbol: pane.symbol,
        timeframe: pane.timeframe,
        range: pane.range,
        toDate: pane.toDate,
      });
    }

    if (toFetch.length === 0) return () => controller.abort();

    setCandleCache((prev) => {
      const next = { ...prev };
      for (const item of toFetch) {
        next[item.cacheKey] = {
          candles: prev[item.cacheKey]?.candles ?? [],
          loading: true,
          error: null,
          source: prev[item.cacheKey]?.source ?? 'lse-export',
        };
      }
      return next;
    });

    for (const item of toFetch) {
      const symMeta =
        symbolsRef.current.find((s) => s.symbol === item.symbol) || symbolsRef.current[0];
      const qs = new URLSearchParams({
        symbol: symMeta?.symbol || item.symbol,
        market: symMeta?.lseMarket || '',
        httpSymbol: symMeta?.lseHttpSymbol || item.symbol,
        timeframe: item.timeframe,
        range: item.range,
        adjusted: backAdjusted ? '1' : '0',
        eth: ethSession,
      });
      if (item.toDate) qs.set('toDate', item.toDate);

      fetch(`/api/market/candles?${qs.toString()}`, { signal: controller.signal })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(data.error || 'LSE candle request failed');
          }
          return data;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (Array.isArray(data.candles)) {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: data.candles,
                loading: false,
                error: null,
                source: data.source || 'lse-export',
              },
            }));
            const curActiveKey = makeCandleCacheKey(
              activePaneRef.current.symbol,
              activePaneRef.current.timeframe,
              activePaneRef.current.range,
              activePaneRef.current.toDate,
              backAdjusted,
              ethSession
            );
            if (item.cacheKey === curActiveKey) {
              setReplayIndex(Math.max(20, data.candles.length - 20));
            }
          } else {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: [],
                loading: false,
                error: 'No candle array returned by LSE API',
                source: 'lse-export',
              },
            }));
          }
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: [],
                loading: false,
                error: (err as Error).message || 'Failed to load LSE candles',
                source: 'lse-export',
              },
            }));
          }
        });
    }

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePaneSpecsSig, backAdjusted, ethSession, candlesRetrySeq]);

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
          } else if (msg.type === 'symbol:added' && msg.symbol) {
            setSymbols((prev) => {
              const exists = prev.some((s) => s.symbol === msg.symbol.symbol);
              return exists
                ? prev.map((s) => (s.symbol === msg.symbol.symbol ? msg.symbol : s))
                : [...prev, msg.symbol];
            });
          } else if (msg.type === 'feed:status') {
            setLiveStreamEnabled(Boolean(msg.liveStreamEnabled));
          } else if (msg.type === 'market:tick' && msg.tick) {
            const incoming: SymbolInfo = msg.tick;
            setLastTickSymbol(incoming.symbol);

            if (msg.rawTick) {
              setTickTape((prev) => [
                {
                  id: `${msg.seq || Date.now()}-${incoming.symbol}`,
                  symbol: incoming.symbol,
                  price: msg.rawTick.price,
                  bid: msg.rawTick.bid,
                  ask: msg.rawTick.ask,
                  volume: msg.rawTick.volume || 0,
                  ts: msg.rawTick.ts || new Date().toISOString(),
                  sourceSocket: msg.rawTick.sourceSocket,
                },
                ...prev.slice(0, 79),
              ]);
            }

            setSymbols((prev) => {
              const oldSym = prev.find((s) => s.symbol === incoming.symbol);
              if (oldSym) {
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
              const exists = prev.some((s) => s.symbol === incoming.symbol);
              return exists
                ? prev.map((s) => (s.symbol === incoming.symbol ? incoming : s))
                : [...prev, incoming];
            });

            // Live tick candle aggregation across all cached symbol/timeframe entries matching incoming.symbol
            const tickSec = parseLseTimeToUnix(msg.rawTick?.ts || Date.now());
            const tickVol = Number(msg.rawTick?.volume) || 0;
            const symPrefix = `${incoming.symbol}__`;

            setCandleCache((prevCache) => {
              let mutated = false;
              let nextCache = prevCache;
              for (const [key, entry] of Object.entries(prevCache)) {
                if (!key.startsWith(symPrefix) || entry.candles.length === 0) continue;
                const tf = key.split('__')[1] || '1m';
                const tfSec = parseTimeframeToSeconds(tf);
                const updatedCandles = mergeTickIntoCandles(
                  entry.candles,
                  incoming.price,
                  tickSec,
                  tickVol,
                  tfSec
                );
                if (updatedCandles !== entry.candles) {
                  if (!mutated) {
                    nextCache = { ...prevCache };
                    mutated = true;
                  }
                  nextCache[key] = { ...entry, candles: updatedCandles };
                }
              }
              return nextCache;
            });
          }
        } catch {
          // Ignore parse errors
        }
      };

      socket.onclose = () => {
        if (!isUnmounted) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2500);
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

  const handleRefreshQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.symbols)) setSymbols(data.symbols);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectLsePair = useCallback(
    async (
      market: string,
      pairSymbol: string,
      pairName: string,
      intent: 'switch' | 'compare' | 'watchlist'
    ) => {
      const res = await fetch('/api/market/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, symbol: pairSymbol, name: pairName }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const addedSym: SymbolInfo = data.symbol;
      if (!addedSym) return;

      setSymbols((prev) => {
        const exists = prev.some((s) => s.symbol === addedSym.symbol);
        return exists
          ? prev.map((s) => (s.symbol === addedSym.symbol ? addedSym : s))
          : [...prev, addedSym];
      });

      if (intent === 'watchlist') {
        setWatchlistSymbols((prev) =>
          prev.includes(addedSym.symbol) ? prev : [...prev, addedSym.symbol]
        );
      } else if (intent === 'compare') {
        const qs = new URLSearchParams({
          symbol: addedSym.symbol,
          market: addedSym.lseMarket,
          httpSymbol: addedSym.lseHttpSymbol,
          timeframe: activeTimeframe,
          range: activeRange,
        });
        const candleRes = await fetch(`/api/market/candles?${qs.toString()}`);
        if (candleRes.ok) {
          const candleData = await candleRes.json();
          const seriesPts = (candleData.candles || []).map((c: CandleBar) => ({
            time: c.time,
            close: c.close,
          }));
          setCompareOverlays((prev) => {
            const without = prev.filter((o) => o.symbol !== addedSym.symbol);
            const color = COMPARE_COLORS[without.length % COMPARE_COLORS.length];
            return [
              ...without,
              {
                symbol: addedSym.symbol,
                name: addedSym.name,
                color,
                market: addedSym.lseMarket,
                httpSymbol: addedSym.lseHttpSymbol,
                candles: seriesPts,
              },
            ];
          });
        }
      } else {
        setWatchlistSymbols((prev) =>
          prev.includes(addedSym.symbol) ? prev : [addedSym.symbol, ...prev]
        );
        setActiveSymbol(addedSym.symbol);
      }
    },
    [activeTimeframe, activeRange, setActiveSymbol]
  );

  const handleOpenOptionContract = useCallback(
    async (contract: {
      occSymbol: string;
      underlying: string;
      strike: number;
      expiry: string;
      contract_type: 'call' | 'put';
    }) => {
      const label = `${contract.underlying} ${contract.expiry} $${contract.strike}${
        contract.contract_type === 'call' ? 'C' : 'P'
      }`;
      await handleSelectLsePair('us_options', contract.occSymbol, label, 'switch');
    },
    [handleSelectLsePair]
  );

  const handleOpenGexDashboard = useCallback(
    (preferredUnderlying?: string) => {
      const nextTicker =
        preferredUnderlying?.trim().toUpperCase() ||
        (activeSymbolObj.lseMarket === 'us_stocks'
          ? activeSymbolObj.symbol.toUpperCase()
          : 'SPY');
      setGexUnderlying(nextTicker);
      setGexModalOpen(true);
    },
    [activeSymbolObj.lseMarket, activeSymbolObj.symbol]
  );

  const handleTogglePinGexLevels = useCallback(
    async (targetUnderlying: string, levels: ChartGexOverlayLevel[]) => {
      const upper = targetUnderlying.toUpperCase();
      const currentlyPinned =
        gexOverlayLevels.length > 0 &&
        gexOverlayLevels[0].underlying.toUpperCase() === upper;
      if (currentlyPinned) {
        setGexOverlayLevels([]);
        return;
      }
      setGexOverlayLevels(levels);
      if (
        activeSymbolObj.symbol.toUpperCase() !== upper &&
        activeSymbolObj.lseHttpSymbol.toUpperCase() !== upper
      ) {
        const existing = symbolsRef.current.find(
          (s) => s.symbol.toUpperCase() === upper || s.lseHttpSymbol.toUpperCase() === upper
        );
        if (existing) {
          setActiveSymbol(existing.symbol);
        } else {
          await handleSelectLsePair('us_stocks', upper, upper, 'switch');
        }
      }
    },
    [
      gexOverlayLevels,
      activeSymbolObj.symbol,
      activeSymbolObj.lseHttpSymbol,
      setActiveSymbol,
      handleSelectLsePair,
    ]
  );

  const handleQuickOrder = useCallback(
    (side: 'BUY' | 'SELL', qty: number = 1, stopLoss?: number, takeProfit?: number) => {
      const fallbackLast = candles[candles.length - 1]?.close ?? 0;
      const execPrice =
        side === 'BUY'
          ? activeSymbolObj.ask > 0
            ? activeSymbolObj.ask
            : fallbackLast
          : activeSymbolObj.bid > 0
          ? activeSymbolObj.bid
          : fallbackLast;
      if (execPrice <= 0) return;
      const newPos: TradePosition = {
        id: `pos-${Date.now()}`,
        symbol: activeSymbolObj.symbol,
        side,
        qty,
        entryPrice: execPrice,
        stopLoss,
        takeProfit,
        timestamp: new Date().toLocaleTimeString(),
      };
      setPositions((prev) => [newPos, ...prev]);
    },
    [activeSymbolObj, candles]
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

  // Drawing CRUD + Undo/Redo history helpers
  const commitDrawingsChange = useCallback(
    (updater: (prev: ChartDrawing[]) => ChartDrawing[]) => {
      setDrawings((prev) => {
        const next = updater(prev);
        setDrawingPast((past) => [...past.slice(-39), prev]);
        setDrawingFuture([]);
        return next;
      });
    },
    []
  );

  const handleAddDrawing = useCallback(
    (d: ChartDrawing) => {
      commitDrawingsChange((prev) => [...prev, d]);
    },
    [commitDrawingsChange]
  );

  const handleUpdateDrawing = useCallback(
    (updated: ChartDrawing) => {
      commitDrawingsChange((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    },
    [commitDrawingsChange]
  );

  const handleCloneDrawing = useCallback(
    (source: ChartDrawing) => {
      const basePrice =
        activeSymbolObj.price > 0
          ? activeSymbolObj.price
          : candles[candles.length - 1]?.close ?? 100;
      const offsetPrice = basePrice * 0.0008;
      const tfSec = Math.max(60, parseTimeframeToSeconds(activeTimeframe));
      const cloned: ChartDrawing = {
        ...translateDrawing(source, tfSec * 5, -offsetPrice),
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        locked: false,
      };
      commitDrawingsChange((prev) => [...prev, cloned]);
      setSelectedDrawingId(cloned.id);
    },
    [activeSymbolObj.price, activeTimeframe, candles, commitDrawingsChange]
  );

  const handleRemoveDrawing = useCallback(
    (id: string) => {
      commitDrawingsChange((prev) => prev.filter((item) => item.id !== id));
      setSelectedDrawingId((cur) => (cur === id ? null : cur));
    },
    [commitDrawingsChange]
  );

  const handleClearDrawings = useCallback(() => {
    setDrawings((prev) => {
      if (prev.length === 0) return prev;
      setDrawingPast((past) => [...past.slice(-39), prev]);
      setDrawingFuture([]);
      return [];
    });
    setSelectedDrawingId(null);
  }, []);

  const handleUndoDrawing = useCallback(() => {
    setDrawingPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setDrawings((curr) => {
        setDrawingFuture((fut) => [curr, ...fut.slice(0, 39)]);
        return previous;
      });
      setSelectedDrawingId(null);
      return past.slice(0, -1);
    });
  }, []);

  const handleRedoDrawing = useCallback(() => {
    setDrawingFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setDrawings((curr) => {
        setDrawingPast((past) => [...past.slice(-39), curr]);
        return next;
      });
      setSelectedDrawingId(null);
      return fut.slice(1);
    });
  }, []);

  const handleToggleFavoriteTool = useCallback((toolId: DrawingToolId) => {
    setFavoriteToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  }, []);

  // Global TradingView Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (activeTool !== 'cursor') {
          setActiveTool('cursor');
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        const targetDrawing = drawings.find((d) => d.id === selectedDrawingId);
        if (targetDrawing && !targetDrawing.locked && !drawingsLocked) {
          e.preventDefault();
          handleRemoveDrawing(selectedDrawingId);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedoDrawing();
        else handleUndoDrawing();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoDrawing();
        return;
      }

      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          setActiveTool('trend-line');
        } else if (key === 'h') {
          e.preventDefault();
          setActiveTool('horizontal-line');
        } else if (key === 'j') {
          e.preventDefault();
          setActiveTool('horizontal-ray');
        } else if (key === 'v') {
          e.preventDefault();
          setActiveTool('vertical-line');
        } else if (key === 'c') {
          e.preventDefault();
          setActiveTool('cross-line');
        } else if (key === 'f') {
          e.preventDefault();
          setActiveTool('fib-levels');
        } else if (key === 'r') {
          e.preventDefault();
          setActiveTool('rectangle');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTool,
    selectedDrawingId,
    drawings,
    drawingsLocked,
    handleRemoveDrawing,
    handleUndoDrawing,
    handleRedoDrawing,
  ]);

  const alertBadgeCount = alerts.filter((a) => a.active).length;

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
        onOpenTradeTicket={() => {
          if (rightPanelOpen && rightRailTab === 'dom_trade') {
            setRightPanelOpen(false);
          } else {
            setRightRailTab('dom_trade');
            setRightPanelOpen(true);
          }
        }}
        onOpenScreener={() => {
          if (rightPanelOpen && rightRailTab === 'screener_factors') {
            setRightPanelOpen(false);
          } else {
            setRightRailTab('screener_factors');
            setRightPanelOpen(true);
          }
        }}
        onOpenUsageModal={() => setUsageModalOpen(true)}
        onOpenSettings={() => {
          setSettingsInitialTab('symbol');
          setSettingsModalOpen(true);
        }}
        activeLayoutId={layoutId}
        onSelectLayout={handleSelectLayout}
        layoutSync={layoutSync}
        onToggleLayoutSync={handleToggleLayoutSync}
        alertBadgeCount={alertBadgeCount}
        chartCanvasTheme={chartCanvasTheme}
        onToggleChartCanvasTheme={handleToggleChartCanvasTheme}
        wsConnected={wsConnected}
        liveStreamEnabled={liveStreamEnabled}
        onToggleLiveStream={handleToggleLiveStream}
        onOpenGexDashboard={() => handleOpenGexDashboard()}
      />

      {/* Main Middle Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftDrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          favoritesBarVisible={favoritesBarVisible}
          onToggleFavoritesBar={() => setFavoritesBarVisible((v) => !v)}
          favoriteToolIds={favoriteToolIds}
          onToggleFavoriteTool={handleToggleFavoriteTool}
          magnetActive={magnetActive}
          onToggleMagnet={() => setMagnetActive((v) => !v)}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          drawingsLocked={drawingsLocked}
          onToggleLockDrawings={() => setDrawingsLocked((v) => !v)}
          drawingsHidden={drawingsHidden}
          onToggleHideDrawings={() => setDrawingsHidden((v) => !v)}
          onClearDrawings={handleClearDrawings}
          onZoomIn={() => setZoomTrigger((z) => z + 1)}
        />

        {/* Center Column: Single or Multi-Chart Grid + Bottom Timeframe Range & Clock Bar */}
        <main className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <div
            className="flex-1 min-h-0 grid gap-[2px] bg-[#22252e] overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${currentLayoutPreset.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${currentLayoutPreset.rows}, minmax(0, 1fr))`,
            }}
          >
            {visiblePanes.map((pane, idx) => {
              const slot = currentLayoutPreset.slots[idx] || {};
              const paneSymbolObj =
                symbols.find((s) => s.symbol === pane.symbol) || symbols[0];
              const paneCacheKey = makeCandleCacheKey(
                pane.symbol,
                pane.timeframe,
                pane.range,
                pane.toDate,
                backAdjusted,
                ethSession
              );
              const paneEntry = candleCache[paneCacheKey];
              const paneCandles = paneEntry?.candles ?? [];
              const paneLoading = paneEntry ? paneEntry.loading : true;
              const paneError = paneEntry?.error ?? null;
              const paneSource = paneEntry?.source ?? 'lse-export';
              const isPaneActive = pane.id === activePane.id;

              return (
                <div
                  key={pane.id}
                  onMouseDown={() => {
                    if (activePaneId !== pane.id) {
                      setActivePaneId(pane.id);
                    }
                  }}
                  style={{
                    gridColumn: slot.colSpan ? `span ${slot.colSpan}` : undefined,
                    gridRow: slot.rowSpan ? `span ${slot.rowSpan}` : undefined,
                  }}
                  className="min-w-0 min-h-0 w-full h-full overflow-hidden flex flex-col"
                >
                  <ChartWorkspace
                    paneId={pane.id}
                    isActivePane={isPaneActive}
                    isMultiPane={currentLayoutPreset.count > 1}
                    onFocusPane={() => setActivePaneId(pane.id)}
                    symbolInfo={paneSymbolObj}
                    timeframe={pane.timeframe}
                    candles={paneCandles}
                    chartStyle={pane.chartStyle}
                    chartCanvasTheme={chartCanvasTheme}
                    chartSettings={chartSettings}
                    onOpenSettings={(tab) => {
                      setSettingsInitialTab(tab || 'symbol');
                      setSettingsModalOpen(true);
                    }}
                    syncedCrosshair={layoutSync.crosshair ? syncedCrosshair : null}
                    onCrosshairSync={(time) => {
                      if (!layoutSync.crosshair) return;
                      setSyncedCrosshair(
                        time !== null ? { time, sourcePaneId: pane.id } : null
                      );
                    }}
                    syncedTimeRange={layoutSync.time ? syncedTimeRange : null}
                    onTimeRangeSync={(range) => {
                      if (!layoutSync.time || !range) return;
                      setSyncedTimeRange({
                        from: range.from,
                        to: range.to,
                        sourcePaneId: pane.id,
                      });
                    }}
                    activeTool={activeTool}
                    onSelectTool={setActiveTool}
                    favoriteToolIds={favoriteToolIds}
                    magnetActive={magnetActive}
                    stayInDrawingMode={stayInDrawingMode}
                    drawingsLocked={drawingsLocked}
                    drawingsHidden={drawingsHidden}
                    drawings={drawings}
                    selectedDrawingId={selectedDrawingId}
                    onSelectDrawing={setSelectedDrawingId}
                    onAddDrawing={handleAddDrawing}
                    onUpdateDrawing={handleUpdateDrawing}
                    onCloneDrawing={handleCloneDrawing}
                    onRemoveDrawing={handleRemoveDrawing}
                    favoritesBarVisible={favoritesBarVisible && isPaneActive}
                    indicators={indicators}
                    onToggleIndicatorVisibility={(id) =>
                      setIndicators((prev) =>
                        prev.map((ind) =>
                          ind.id === id ? { ...ind, visible: !ind.visible } : ind
                        )
                      )
                    }
                    compareOverlays={isPaneActive ? compareOverlays : []}
                    onRemoveCompareOverlay={(sym) =>
                      setCompareOverlays((prev) => prev.filter((o) => o.symbol !== sym))
                    }
                    positions={positions}
                    onQuickOrder={(side) => handleQuickOrder(side, 1)}
                    onClosePosition={(id) =>
                      setPositions((prev) => prev.filter((p) => p.id !== id))
                    }
                    alerts={alerts}
                    replayActive={replayActive && isPaneActive}
                    replayIndex={replayIndex}
                    replayPlaying={replayPlaying}
                    onReplayTogglePlay={() => setReplayPlaying((p) => !p)}
                    onReplayStep={() =>
                      setReplayIndex((curIdx) => Math.min(paneCandles.length, curIdx + 1))
                    }
                    onReplayExit={() => {
                      setReplayActive(false);
                      setReplayPlaying(false);
                    }}
                    zoomTrigger={isPaneActive ? zoomTrigger : 0}
                    logScale={logScale}
                    autoScale={autoScale}
                    onToggleLogScale={() => setLogScale((l) => !l)}
                    onToggleAutoScale={() => setAutoScale((a) => !a)}
                    onOpenNewsDrawer={() => {
                      setRightRailTab('news_calendar');
                      setRightPanelOpen(true);
                    }}
                    candleDataSource={paneSource}
                    loadingCandles={paneLoading}
                    candlesError={paneError}
                    onRetryCandles={() => setCandlesRetrySeq((c) => c + 1)}
                    timezoneId={timezoneId}
                    gexOverlayLevels={gexOverlayLevels}
                  />
                </div>
              );
            })}
          </div>

          <BottomBar
            activeRange={activeRange}
            onSelectRange={(r) => setActiveRangeAndDate(r, '')}
            toDate={toDate}
            onSelectToDate={setToDate}
            ethSession={ethSession}
            onToggleEthSession={() => setEthSession((s) => (s === 'ETH' ? 'RTH' : 'ETH'))}
            backAdjusted={backAdjusted}
            onToggleBackAdjusted={() => setBackAdjusted((b) => !b)}
            logScale={logScale}
            onToggleLogScale={() => setLogScale((l) => !l)}
            autoScale={autoScale}
            onToggleAutoScale={() => setAutoScale((a) => !a)}
            loadingCandles={loadingCandles}
            timezoneId={timezoneId}
            onSelectTimezone={setTimezoneId}
            activeSymbolMarket={activeSymbolObj.lseMarket}
          />
        </main>

        {/* Right Watchlist, Symbol Details, Economic Calendar & Tools Rail */}
        <RightSidebar
          symbols={symbols}
          watchlistSymbols={watchlistSymbols}
          activeSymbol={activeSymbol}
          activeTimeframe={activeTimeframe}
          onSelectSymbol={(sym) => setActiveSymbol(sym)}
          onRemoveFromWatchlist={(sym) =>
            setWatchlistSymbols((prev) => prev.filter((item) => item !== sym))
          }
          onToggleSymbolFlag={handleToggleSymbolFlag}
          onOpenAddSymbol={() => {
            setSymbolModalMode('watchlist');
            setSymbolModalOpen(true);
          }}
          onRefreshQuotes={handleRefreshQuotes}
          economicEvents={economicEvents}
          bondYields={bondYields}
          symbolDetails={symbolDetails}
          loadingDetails={loadingDetails}
          tickTape={tickTape}
          activeTab={rightRailTab}
          panelOpen={rightPanelOpen}
          onSelectTab={(tab) => {
            if (rightPanelOpen && rightRailTab === tab) {
              setRightPanelOpen(false);
            } else {
              setRightRailTab(tab);
              setRightPanelOpen(true);
            }
          }}
          alerts={alerts}
          onOpenCreateAlert={() => setAlertModalOpen(true)}
          onRemoveAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
          drawings={drawings}
          selectedDrawingId={selectedDrawingId}
          onSelectDrawing={setSelectedDrawingId}
          onUpdateDrawing={handleUpdateDrawing}
          onRemoveDrawing={handleRemoveDrawing}
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
          onOpenUsageModal={() => setUsageModalOpen(true)}
          onSelectOptionContract={handleOpenOptionContract}
          onOpenGexDashboard={(ticker) => handleOpenGexDashboard(ticker)}
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
        onSelectLsePair={handleSelectLsePair}
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

      <LseAccountUsageModal
        open={usageModalOpen}
        usage={lseUsage}
        loading={loadingUsage}
        onRefreshUsage={fetchLseUsage}
        onReconnectWs={async () => {
          await fetch('/api/lse/ws/reconnect', { method: 'POST' });
          setTimeout(fetchLseUsage, 1200);
        }}
        onClose={() => setUsageModalOpen(false)}
      />

      <ChartSettingsModal
        open={settingsModalOpen}
        initialTab={settingsInitialTab}
        settings={chartSettings}
        chartCanvasTheme={chartCanvasTheme}
        onPreviewSettings={(next) => setChartSettings(next)}
        onCommitSettings={(next, nextTheme) => {
          setChartSettings(next);
          if (nextTheme) {
            setChartCanvasTheme(nextTheme);
          }
          try {
            localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          setSettingsModalOpen(false);
        }}
        onCancelSettings={(original) => {
          setChartSettings(original);
          setSettingsModalOpen(false);
        }}
      />

      <GexDashboardModal
        open={gexModalOpen}
        onClose={() => setGexModalOpen(false)}
        initialUnderlying={gexUnderlying}
        pinnedUnderlying={gexOverlayLevels[0]?.underlying ?? null}
        onTogglePinLevels={handleTogglePinGexLevels}
        onSelectOptionContract={handleOpenOptionContract}
      />
    </div>
  );
}
