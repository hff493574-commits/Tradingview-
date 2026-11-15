import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  Time,
} from 'lightweight-charts';
import {
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Settings,
  Zap,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  X,
  Info,
} from 'lucide-react';
import {
  SymbolInfo,
  CandleBar,
  formatPrice,
  formatTimeframeHeaderLabel,
  toHeikinAshiCandles,
  calculateEMA,
  calculateVWAP,
  getInstitutionalIVWalls,
  getSupplyDemandZones,
  TradePosition,
  PriceAlert,
  calculatePositionPnL,
} from '../utils/marketEngine';
import {
  ChartStyleType,
  DrawingToolId,
  ChartDrawing,
  IndicatorConfig,
} from '../types/trading';
import { FloatingFavoritesToolbar } from './FloatingFavoritesToolbar';

interface ChartWorkspaceProps {
  symbolInfo: SymbolInfo;
  timeframe: string;
  candles: CandleBar[];
  chartStyle: ChartStyleType;
  chartCanvasTheme: 'light' | 'dark';
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  magnetActive: boolean;
  stayInDrawingMode: boolean;
  drawingsLocked: boolean;
  drawingsHidden: boolean;
  drawings: ChartDrawing[];
  onAddDrawing: (drawing: ChartDrawing) => void;
  onRemoveDrawing: (id: string) => void;
  favoritesBarVisible: boolean;
  indicators: IndicatorConfig[];
  onToggleIndicatorVisibility: (id: string) => void;
  positions: TradePosition[];
  onQuickOrder: (side: 'BUY' | 'SELL') => void;
  onClosePosition: (id: string) => void;
  alerts: PriceAlert[];
  replayActive: boolean;
  replayIndex: number;
  replayPlaying: boolean;
  onReplayTogglePlay: () => void;
  onReplayStep: () => void;
  onReplayExit: () => void;
  zoomTrigger: number;
  logScale: boolean;
  autoScale: boolean;
  onOpenNewsDrawer: () => void;
}

interface HoverBarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  vwap?: number;
  x: number;
  y: number;
}

export const ChartWorkspace: React.FC<ChartWorkspaceProps> = ({
  symbolInfo,
  timeframe,
  candles,
  chartStyle,
  chartCanvasTheme,
  activeTool,
  onSelectTool,
  magnetActive,
  stayInDrawingMode,
  drawingsLocked,
  drawingsHidden,
  drawings,
  onAddDrawing,
  onRemoveDrawing,
  favoritesBarVisible,
  indicators,
  onToggleIndicatorVisibility,
  positions,
  onQuickOrder,
  onClosePosition,
  alerts,
  replayActive,
  replayIndex,
  replayPlaying,
  onReplayTogglePlay,
  onReplayStep,
  onReplayExit,
  zoomTrigger,
  logScale,
  autoScale,
  onOpenNewsDrawer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);

  const [legendExpanded, setLegendExpanded] = useState(true);
  const [hoverData, setHoverData] = useState<HoverBarData | null>(null);
  const [floatingTooltipEnabled, setFloatingTooltipEnabled] = useState(true);
  const [currencyUnit, setCurrencyUnit] = useState(symbolInfo.currency || 'USD');
  const [countdownText, setCountdownText] = useState('00:01');
  const [overlayTick, setOverlayTick] = useState(0);

  // Two-click interactive drawing draft state
  const [draftAnchor, setDraftAnchor] = useState<{ t: number; p: number } | null>(null);
  const [mouseChartPoint, setMouseChartPoint] = useState<{ t: number; p: number } | null>(null);

  // Slice candles if in Bar Replay mode
  const displayedCandles = useMemo(() => {
    if (!replayActive) return candles;
    const endIdx = Math.max(20, Math.min(candles.length, replayIndex));
    return candles.slice(0, endIdx);
  }, [candles, replayActive, replayIndex]);

  const processedCandles = useMemo(() => {
    if (chartStyle === 'heikin_ashi') {
      return toHeikinAshiCandles(displayedCandles);
    }
    return displayedCandles;
  }, [displayedCandles, chartStyle]);

  const vwapMap = useMemo(() => {
    const vwapArr = calculateVWAP(displayedCandles);
    const map = new Map<number, number>();
    for (const pt of vwapArr) {
      map.set(pt.time, pt.value);
    }
    return map;
  }, [displayedCandles]);

  const ivWalls = useMemo(() => getInstitutionalIVWalls(symbolInfo), [symbolInfo]);
  const supplyDemandZones = useMemo(
    () => getSupplyDemandZones(symbolInfo, displayedCandles),
    [symbolInfo, displayedCandles]
  );

  const ivWallsVisible = useMemo(
    () => indicators.some((ind) => (ind.id === 'iv-walls-1' || ind.id === 'iv-walls-2') && ind.visible),
    [indicators]
  );

  const ssmtVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'ssmt-zones' && ind.visible),
    [indicators]
  );

  const vwapVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'vwap' && ind.visible),
    [indicators]
  );

  const emaVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'ema-20' && ind.visible),
    [indicators]
  );

  const volumeVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'volume' && ind.visible),
    [indicators]
  );

  // Live candle countdown timer ("00:01")
  useEffect(() => {
    const timer = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rem = 59 - (nowSec % 60);
      const mm = String(Math.floor(rem / 60)).padStart(2, '0');
      const ss = String(rem % 60).padStart(2, '0');
      setCountdownText(`${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger overlay re-render when chart pans/zooms
  const refreshOverlay = useCallback(() => {
    setOverlayTick((t) => t + 1);
  }, []);

  // Build & configure lightweight-charts v5 instance
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const isLight = chartCanvasTheme === 'light';
    const bgColor = isLight ? '#ffffff' : '#0f1219';
    const textColor = isLight ? '#787b86' : '#868993';
    const gridColor = isLight ? '#f2f4f8' : '#181c27';
    const borderColor = isLight ? '#e0e3eb' : '#222631';

    const chart = createChart(el, {
      width: el.clientWidth || 1000,
      height: el.clientHeight || 620,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      localization: {
        priceFormatter: (p: number) => formatPrice(p, symbolInfo.decimals),
      },
      grid: {
        vertLines: { color: gridColor, style: LineStyle.Solid },
        horzLines: { color: gridColor, style: LineStyle.Solid },
      },
      crosshair: {
        mode: magnetActive ? CrosshairMode.Magnet : CrosshairMode.Normal,
        vertLine: {
          color: isLight ? '#9598a1' : '#5d606b',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#363a45',
        },
        horzLine: {
          color: isLight ? '#9598a1' : '#5d606b',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#363a45',
        },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: {
          top: 0.04,
          bottom: 0.06,
        },
        mode: logScale ? 1 : 0,
        autoScale,
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 14,
        barSpacing: 3.4,
        minBarSpacing: 1.2,
        tickMarkFormatter: (time: Time) => {
          const t = Number(time);
          const d = new Date(t * 1000);
          const hh = d.getUTCHours();
          const mm = d.getUTCMinutes();
          if (hh === 0 && mm === 0) {
            return String(d.getUTCDate());
          }
          const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
          const ampm = hh >= 12 ? 'PM' : 'AM';
          return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
        },
      },
    });

    chartRef.current = chart;

    // Ensure the price scale spans the full institutional IV WALLS range (e.g. 28,095 to 28,485 on NQ1!)
    // so both the upper 1σ cluster and lower 1σ cluster (28,228.00 / 28,212.94) are always in view like Screenshot 1
    const autoscaleInfoProvider = () => {
      if (processedCandles.length === 0) return null;
      const ratio = symbolInfo.price / 28304.0;
      return {
        priceRange: {
          minValue: 28095.0 * ratio,
          maxValue: 28485.0 * ratio,
        },
      };
    };

    // Add Main Series according to selected chartStyle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mainSeries: ISeriesApi<any>;

    if (chartStyle === 'bars') {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: isLight ? '#434651' : '#26a69a',
        downColor: isLight ? '#434651' : '#ef5350',
        thinBars: false,
        lastValueVisible: false,
        priceLineVisible: true,
        priceLineColor: '#9598a1',
        priceLineStyle: LineStyle.Dotted,
        autoscaleInfoProvider,
      });
    } else if (chartStyle === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#2962ff',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: true,
        autoscaleInfoProvider,
      });
    } else if (chartStyle === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#2962ff',
        topColor: 'rgba(41, 98, 255, 0.28)',
        bottomColor: 'rgba(41, 98, 255, 0.02)',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: true,
        autoscaleInfoProvider,
      });
    } else if (chartStyle === 'baseline') {
      mainSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: symbolInfo.dayOpen },
        topLineColor: '#089981',
        bottomLineColor: '#f23645',
        lastValueVisible: false,
        priceLineVisible: true,
        autoscaleInfoProvider,
      });
    } else {
      // 'candles', 'hollow_candles', 'heikin_ashi'
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: isLight
          ? chartStyle === 'hollow_candles'
            ? 'transparent'
            : '#ffffff'
          : '#089981',
        downColor: isLight ? '#434651' : '#f23645',
        borderVisible: true,
        borderUpColor: isLight ? '#434651' : '#089981',
        borderDownColor: isLight ? '#434651' : '#f23645',
        wickUpColor: isLight ? '#434651' : '#089981',
        wickDownColor: isLight ? '#434651' : '#f23645',
        lastValueVisible: false,
        priceLineVisible: true,
        priceLineColor: '#9598a1',
        priceLineStyle: LineStyle.Dotted,
        autoscaleInfoProvider,
      });
    }

    mainSeriesRef.current = mainSeries;

    if (
      chartStyle === 'line' ||
      chartStyle === 'area' ||
      chartStyle === 'baseline'
    ) {
      mainSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          value: c.close,
        }))
      );
    } else {
      mainSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    }

    // Optional Volume Histogram
    if (volumeVisible) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.84, bottom: 0 },
      });
      volSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)',
        }))
      );
    }

    // Optional Session VWAP Line
    if (vwapVisible) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: '#ff9800',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const vwapData = calculateVWAP(processedCandles);
      vwapSeries.setData(vwapData.map((d) => ({ time: d.time as Time, value: d.value })));
    }

    // Optional EMA 20 Line
    if (emaVisible) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: '#2962ff',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const emaData = calculateEMA(processedCandles, 20);
      emaSeries.setData(emaData.map((d) => ({ time: d.time as Time, value: d.value })));
    }

    // Add Horizontal Pivot Line matching Screenshot 1 (28,399.25 solid dark line)
    if (ivWallsVisible && ivWalls.length > 0) {
      const pivotWall = ivWalls[0];
      mainSeries.createPriceLine({
        price: pivotWall.price,
        color: '#434651',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
    }

    // Subscribe to crosshair move for live OHLC legend & tooltip HUD
    const candleByTime = new Map<number, CandleBar>();
    for (let i = 0; i < processedCandles.length; i++) {
      candleByTime.set(processedCandles[i].time, processedCandles[i]);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoverData(null);
        return;
      }
      const t = Number(param.time);
      const bar = candleByTime.get(t);
      if (bar) {
        const chg = bar.close - bar.open;
        const chgPct = (chg / bar.open) * 100;
        setHoverData({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          change: chg,
          changePercent: chgPct,
          vwap: vwapMap.get(bar.time),
          x: param.point.x,
          y: param.point.y,
        });
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshOverlay);
    chart.timeScale().subscribeSizeChange(refreshOverlay);

    // Show the last ~195 candles so the exact pattern from 08:00 PM to 01:30 AM fills the screen like Screenshot 1
    if (processedCandles.length > 195) {
      chart.timeScale().setVisibleLogicalRange({
        from: processedCandles.length - 195,
        to: processedCandles.length + 14,
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          refreshOverlay();
        }
      }
    });
    resizeObserver.observe(el);

    // Trigger initial overlay paint shortly after mount
    const initTimer = setTimeout(refreshOverlay, 60);

    return () => {
      clearTimeout(initTimer);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
    };
  }, [
    symbolInfo.symbol,
    timeframe,
    chartStyle,
    chartCanvasTheme,
    magnetActive,
    logScale,
    autoScale,
    ivWallsVisible,
    vwapVisible,
    emaVisible,
    volumeVisible,
  ]);

  // Update the latest candle in-place when live WebSocket ticks arrive (without tearing down the chart)
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series || processedCandles.length === 0) return;

    const lastBar = processedCandles[processedCandles.length - 1];
    try {
      if (
        chartStyle === 'line' ||
        chartStyle === 'area' ||
        chartStyle === 'baseline'
      ) {
        series.update({
          time: lastBar.time as Time,
          value: lastBar.close,
        });
      } else {
        series.update({
          time: lastBar.time as Time,
          open: lastBar.open,
          high: lastBar.high,
          low: lastBar.low,
          close: lastBar.close,
        });
      }
      refreshOverlay();
    } catch {
      // Safe guard if series was just recreated
    }
  }, [processedCandles, chartStyle, refreshOverlay]);

  // Handle Zoom In button click from left toolbar
  useEffect(() => {
    if (zoomTrigger === 0 || !chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const nextSpan = Math.max(20, span * 0.75);
      ts.setVisibleLogicalRange({
        from: range.to - nextSpan,
        to: range.to,
      });
    }
  }, [zoomTrigger]);

  // Helper to convert (time, price) <-> pixel coordinates on the chart overlay
  const toCoords = useCallback(
    (timeSec: number, price: number): { x: number | null; y: number | null } => {
      const chart = chartRef.current;
      const series = mainSeriesRef.current;
      if (!chart || !series) return { x: null, y: null };
      const x = chart.timeScale().timeToCoordinate(timeSec as Time);
      const y = series.priceToCoordinate(price);
      return {
        x: x !== null ? Number(x) : null,
        y: y !== null ? Number(y) : null,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlayTick, processedCandles]
  );

  const fromCoords = useCallback(
    (x: number, y: number): { t: number; p: number } | null => {
      const chart = chartRef.current;
      const series = mainSeriesRef.current;
      if (!chart || !series || processedCandles.length === 0) return null;

      const rawPrice = series.coordinateToPrice(y);
      if (rawPrice === null) return null;

      let timeSec = Number(chart.timeScale().coordinateToTime(x));
      if (!Number.isFinite(timeSec)) {
        const logical = chart.timeScale().coordinateToLogical(x);
        if (logical !== null) {
          const idx = Math.max(0, Math.min(processedCandles.length - 1, Math.round(logical)));
          timeSec = processedCandles[idx].time;
        } else {
          timeSec = processedCandles[processedCandles.length - 1].time;
        }
      }

      let snappedPrice = Number(rawPrice);
      if (magnetActive) {
        const bar = processedCandles.find((c) => c.time === timeSec);
        if (bar) {
          const candidates = [bar.open, bar.high, bar.low, bar.close];
          candidates.sort((a, b) => Math.abs(a - snappedPrice) - Math.abs(b - snappedPrice));
          snappedPrice = candidates[0];
        }
      }

      return { t: timeSec, p: snappedPrice };
    },
    [processedCandles, magnetActive]
  );

  // Quick-place a drawing automatically in the visible chart area (when double-clicking a tool or clicking while already active)
  const handleQuickPlaceTool = useCallback(
    (tool: DrawingToolId) => {
      if (tool === 'cursor' || processedCandles.length < 30) return;
      const n = processedCandles.length;
      const bar1 = processedCandles[Math.max(0, n - 48)];
      const bar2 = processedCandles[Math.max(0, n - 8)];
      const spread = symbolInfo.price * 0.0012;

      const newDrawing: ChartDrawing = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: symbolInfo.symbol,
        tool,
        t1: bar1.time,
        p1: Number((symbolInfo.price + spread).toFixed(symbolInfo.decimals)),
        t2: bar2.time,
        p2: Number((symbolInfo.price - spread).toFixed(symbolInfo.decimals)),
        text: tool === 'text-note' ? `${symbolInfo.symbol} Institutional Liquidity Pool` : undefined,
        color: '#2962ff',
      };
      onAddDrawing(newDrawing);
      if (!stayInDrawingMode) {
        onSelectTool('cursor');
      }
    },
    [processedCandles, symbolInfo, onAddDrawing, stayInDrawingMode, onSelectTool]
  );

  // Interactive click on the chart canvas when a drawing tool is selected
  const handleChartOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'cursor' || drawingsLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pt = fromCoords(x, y);
    if (!pt) return;

    // Single-click tools
    if (
      activeTool === 'horizontal-ray' ||
      activeTool === 'vertical-line' ||
      activeTool === 'text-note'
    ) {
      const lastTime = processedCandles[processedCandles.length - 1]?.time ?? pt.t + 1800;
      onAddDrawing({
        id: `draw-${Date.now()}`,
        symbol: symbolInfo.symbol,
        tool: activeTool,
        t1: pt.t,
        p1: pt.p,
        t2: lastTime,
        p2: pt.p,
        text:
          activeTool === 'text-note'
            ? `Liquidity Note @ ${formatPrice(pt.p, symbolInfo.decimals)}`
            : undefined,
        color: '#2962ff',
      });
      if (!stayInDrawingMode) onSelectTool('cursor');
      return;
    }

    // Two-click tools (Trend line, Liquidity box [L], Stop channel [S], Rectangle, Fib, Volume Profile, Measure, etc.)
    if (!draftAnchor) {
      setDraftAnchor(pt);
    } else {
      onAddDrawing({
        id: `draw-${Date.now()}`,
        symbol: symbolInfo.symbol,
        tool: activeTool,
        t1: draftAnchor.t,
        p1: draftAnchor.p,
        t2: pt.t === draftAnchor.t ? pt.t + 900 : pt.t,
        p2: pt.p === draftAnchor.p ? pt.p - symbolInfo.tickSize * 20 : pt.p,
        color: '#2962ff',
      });
      setDraftAnchor(null);
      setMouseChartPoint(null);
      if (!stayInDrawingMode) onSelectTool('cursor');
    }
  };

  const handleChartOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draftAnchor) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = fromCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (pt) setMouseChartPoint(pt);
  };

  // Current OHLC readout for the top-left legend
  const lastCandle = processedCandles[processedCandles.length - 1];
  const displayBar = hoverData || {
    time: lastCandle?.time ?? 0,
    open: lastCandle?.open ?? symbolInfo.dayOpen,
    high: lastCandle?.high ?? symbolInfo.dayHigh,
    low: lastCandle?.low ?? symbolInfo.dayLow,
    close: lastCandle?.close ?? symbolInfo.price,
    volume: lastCandle?.volume ?? 1840,
    change: lastCandle ? lastCandle.close - lastCandle.open : -3.0,
    changePercent: lastCandle ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100 : -0.01,
  };

  const isLight = chartCanvasTheme === 'light';
  const activeSymbolDrawings = drawings.filter((d) => d.symbol === symbolInfo.symbol);
  const currentPriceY = mainSeriesRef.current
    ? mainSeriesRef.current.priceToCoordinate(symbolInfo.price)
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-full overflow-hidden select-none ${
        isLight ? 'bg-white' : 'bg-[#0f1219]'
      }`}
    >
      {/* Lightweight Charts Canvas Mount Container */}
      <div
        ref={chartContainerRef}
        data-testid="tradingview-chart-canvas"
        className="w-full h-full"
      />

      {/* Synchronized Institutional Zones, IV Wall Badges & User Drawings SVG Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* 1. Green Shaded Institutional Supply/Demand Zones matching Screenshot 1 */}
        {ssmtVisible &&
          supplyDemandZones.map((zone) => {
            const startIdx = Math.max(0, Math.min(processedCandles.length - 1, zone.startTimeIndex));
            const endIdx = Math.max(0, Math.min(processedCandles.length - 1, zone.endTimeIndex));
            const c1 = toCoords(processedCandles[startIdx]?.time ?? 0, zone.topPrice);
            const c2 = toCoords(processedCandles[endIdx]?.time ?? 0, zone.bottomPrice);
            if (c1.x === null || c1.y === null || c2.x === null || c2.y === null) return null;
            const x = Math.min(c1.x, c2.x);
            const y = Math.min(c1.y, c2.y);
            const width = Math.max(12, Math.abs(c2.x - c1.x));
            const height = Math.max(2, Math.abs(c2.y - c1.y));
            return (
              <g key={zone.id}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={zone.color}
                />
                <line
                  x1={x}
                  y1={y + height}
                  x2={x + width}
                  y2={y + height}
                  stroke={zone.borderColor}
                  strokeWidth="1"
                />
              </g>
            );
          })}

        {/* 2. Subtle Horizontal Gray Reference Step Lines from Screenshot 1 */}
        {ivWallsVisible &&
          processedCandles.length > 60 &&
          (() => {
            const leftBar = processedCandles[Math.floor(processedCandles.length * 0.25)];
            const midBar = processedCandles[Math.floor(processedCandles.length * 0.55)];
            const pRatio = symbolInfo.price / 28304.0;
            const step1 = toCoords(leftBar.time, 28349.5 * pRatio);
            const step2 = toCoords(midBar.time, 28349.5 * pRatio);
            const lowStep1 = toCoords( processedCandles[0].time, 28268.0 * pRatio);
            const lowStep2 = toCoords(leftBar.time, 28268.0 * pRatio);
            return (
              <g>
                {step1.x !== null && step2.x !== null && step1.y !== null && (
                  <line
                    x1={step1.x}
                    y1={step1.y}
                    x2={step2.x}
                    y2={step1.y}
                    stroke={isLight ? '#d1d4dc' : '#2a2e39'}
                    strokeWidth="1.5"
                  />
                )}
                {lowStep1.x !== null && lowStep2.x !== null && lowStep1.y !== null && (
                  <line
                    x1={lowStep1.x}
                    y1={lowStep1.y}
                    x2={lowStep2.x}
                    y2={lowStep1.y}
                    stroke={isLight ? '#e0e3eb' : '#2a2e39'}
                    strokeWidth="1.2"
                  />
                )}
              </g>
            );
          })()}

        {/* 3. User Interactive Drawings & Draft Preview */}
        {!drawingsHidden &&
          [
            ...activeSymbolDrawings,
            ...(draftAnchor && mouseChartPoint
              ? [
                  {
                    id: 'draft-preview',
                    symbol: symbolInfo.symbol,
                    tool: activeTool,
                    t1: draftAnchor.t,
                    p1: draftAnchor.p,
                    t2: mouseChartPoint.t,
                    p2: mouseChartPoint.p,
                    color: '#2962ff',
                  } as ChartDrawing,
                ]
              : []),
          ].map((d) => {
            const c1 = toCoords(d.t1, d.p1);
            const c2 = toCoords(d.t2, d.p2);
            if (c1.x === null || c1.y === null) return null;
            const x1 = c1.x;
            const y1 = c1.y;
            const x2 = c2.x ?? x1 + 140;
            const y2 = c2.y ?? y1;
            const rx = Math.min(x1, x2);
            const ry = Math.min(y1, y2);
            const rw = Math.max(20, Math.abs(x2 - x1));
            const rh = Math.max(12, Math.abs(y2 - y1));

            if (d.tool === 'horizontal-ray') {
              return (
                <g key={d.id}>
                  <line x1={x1} y1={y1} x2={2000} y2={y1} stroke={d.color} strokeWidth="1.6" />
                  <circle cx={x1} cy={y1} r="3.5" fill="#ffffff" stroke={d.color} strokeWidth="1.6" />
                </g>
              );
            }

            if (d.tool === 'vertical-line') {
              return (
                <g key={d.id}>
                  <line x1={x1} y1={0} x2={x1} y2={1200} stroke={d.color} strokeWidth="1.5" strokeDasharray="4 3" />
                  <circle cx={x1} cy={y1} r="3.5" fill="#ffffff" stroke={d.color} strokeWidth="1.6" />
                </g>
              );
            }

            if (d.tool === 'text-note') {
              return (
                <g key={d.id}>
                  <rect
                    x={x1}
                    y={y1 - 24}
                    width={195}
                    height={22}
                    rx={4}
                    fill="#131722"
                    stroke="#2962ff"
                    strokeWidth="1"
                  />
                  <text x={x1 + 8} y={y1 - 9} fill="#ffffff" fontSize="11" fontWeight="600">
                    {d.text || 'Liquidity Annotation'}
                  </text>
                </g>
              );
            }

            if (d.tool === 'liquidity-box' || d.tool === 'stop-channel') {
              const tag = d.tool === 'liquidity-box' ? 'L' : 'S';
              const midY = (y1 + y2) / 2;
              return (
                <g key={d.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={d.tool === 'liquidity-box' ? 'rgba(41, 98, 255, 0.10)' : 'rgba(242, 54, 69, 0.10)'}
                  />
                  <line x1={rx} y1={y1} x2={rx + rw} y2={y1} stroke={d.color} strokeWidth="1.5" />
                  <line x1={rx} y1={midY} x2={rx + rw} y2={midY} stroke={d.color} strokeWidth="1" strokeDasharray="3 3" />
                  <line x1={rx} y1={y2} x2={rx + rw} y2={y2} stroke={d.color} strokeWidth="1.5" />
                  <circle cx={rx} cy={y1} r="3" fill="#ffffff" stroke={d.color} strokeWidth="1.5" />
                  <circle cx={rx} cy={y2} r="3" fill="#ffffff" stroke={d.color} strokeWidth="1.5" />
                  <text
                    x={rx + rw / 2}
                    y={midY - 4}
                    textAnchor="middle"
                    fill={d.color}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {tag} · {formatPrice(Math.abs(d.p1 - d.p2), symbolInfo.decimals)} pts
                  </text>
                </g>
              );
            }

            if (d.tool === 'rectangle' || d.tool === 'measure') {
              const ptsDiff = d.p2 - d.p1;
              return (
                <g key={d.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={
                      d.tool === 'measure'
                        ? ptsDiff >= 0
                          ? 'rgba(41, 98, 255, 0.16)'
                          : 'rgba(242, 54, 69, 0.16)'
                        : 'rgba(16, 185, 129, 0.15)'
                    }
                    stroke={d.tool === 'measure' ? '#2962ff' : '#089981'}
                    strokeWidth="1.4"
                  />
                  <circle cx={rx} cy={ry} r="3" fill="#ffffff" stroke="#2962ff" strokeWidth="1.4" />
                  <circle cx={rx + rw} cy={ry} r="3" fill="#ffffff" stroke="#2962ff" strokeWidth="1.4" />
                  <circle cx={rx} cy={ry + rh} r="3" fill="#ffffff" stroke="#2962ff" strokeWidth="1.4" />
                  <circle cx={rx + rw} cy={ry + rh} r="3" fill="#ffffff" stroke="#2962ff" strokeWidth="1.4" />
                  {d.tool === 'measure' && (
                    <g>
                      <rect x={rx + rw / 2 - 55} y={ry - 24} width={110} height={20} rx={3} fill="#2962ff" />
                      <text
                        x={rx + rw / 2}
                        y={ry - 10}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10.5"
                        fontWeight="600"
                      >
                        {ptsDiff >= 0 ? '+' : ''}
                        {formatPrice(ptsDiff, symbolInfo.decimals)} ({((ptsDiff / d.p1) * 100).toFixed(2)}%)
                      </text>
                    </g>
                  )}
                </g>
              );
            }

            if (d.tool === 'fib-levels') {
              const levels = [0, 0.382, 0.5, 0.618, 1];
              return (
                <g key={d.id}>
                  {levels.map((lvl) => {
                    const py = y1 + (y2 - y1) * lvl;
                    const priceAtLvl = d.p1 + (d.p2 - d.p1) * lvl;
                    return (
                      <g key={lvl}>
                        <line x1={rx} y1={py} x2={rx + rw} y2={py} stroke="#2962ff" strokeWidth="1.2" />
                        <text x={rx + 4} y={py - 3} fill="#2962ff" fontSize="9.5" fontWeight="600">
                          {lvl.toFixed(3)} ({formatPrice(priceAtLvl, symbolInfo.decimals)})
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            }

            if (d.tool === 'volume-profile') {
              const rows = 8;
              const rowH = rh / rows;
              const weights = [0.45, 0.72, 0.95, 0.64, 0.88, 0.52, 0.38, 0.25];
              return (
                <g key={d.id}>
                  <line x1={rx} y1={ry} x2={rx} y2={ry + rh} stroke="#2962ff" strokeWidth="1.5" />
                  <line x1={rx + rw} y1={ry} x2={rx + rw} y2={ry + rh} stroke="#2962ff" strokeWidth="1.5" />
                  {weights.map((w, idx) => (
                    <rect
                      key={idx}
                      x={rx}
                      y={ry + idx * rowH + 1}
                      width={rw * w}
                      height={Math.max(2, rowH - 2)}
                      fill={idx === 2 ? 'rgba(242, 54, 69, 0.45)' : 'rgba(41, 98, 255, 0.32)'}
                    />
                  ))}
                </g>
              );
            }

            // Default: Trend Line / Wave Path / Time Cycles / Candle Pattern
            return (
              <g key={d.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d.color} strokeWidth="1.8" />
                <circle cx={x1} cy={y1} r="3.5" fill="#ffffff" stroke={d.color} strokeWidth="1.8" />
                <circle cx={x2} cy={y2} r="3.5" fill="#ffffff" stroke={d.color} strokeWidth="1.8" />
              </g>
            );
          })}
      </svg>

      {/* Interactive Click & MouseMove Capture Layer when a Drawing Tool is Active */}
      {activeTool !== 'cursor' && !drawingsLocked && (
        <div
          onClick={handleChartOverlayClick}
          onMouseMove={handleChartOverlayMouseMove}
          className="absolute inset-0 z-20 cursor-crosshair"
          title={`Click on chart to place ${activeTool}`}
        >
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#131722]/95 border border-[#2962ff] text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2962ff]" />
            <span>
              Drawing Mode: <strong>{activeTool}</strong>{' '}
              {draftAnchor ? '(Click second point to finish)' : '(Click on chart to anchor)'}
            </span>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setDraftAnchor(null);
                onSelectTool('cursor');
              }}
              className="ml-1 text-[#9598a1] hover:text-white"
            >
              Esc
            </button>
          </div>
        </div>
      )}

      {/* Right-Side Price Scale Custom Institutional Badges (matching Screenshot 1: 28,399.25, Blue 1σ IV WALLS, and NQZ2026 Current Price Countdown) */}
      <div className="absolute top-0 right-0 bottom-[28px] w-[165px] pointer-events-none z-20 overflow-visible">
        {ivWallsVisible &&
          (() => {
            const u1Coord = toCoords(0, ivWalls[1]?.price ?? 0).y ?? 200;
            const l1Coord = toCoords(0, ivWalls[5]?.price ?? 0).y ?? 450;
            return ivWalls.map((wall, idx) => {
              const coord = toCoords(processedCandles[processedCandles.length - 1]?.time ?? 0, wall.price);
              if (coord.y === null || coord.y < 8 || coord.y > 820) return null;
              // Clean, contiguous vertical stacking for the 4 upper 1σ tags (28,365.56 / 28,351.93 / 28,350.50 / 28,349.50)
              // and 2 lower 1σ tags (28,228.00 / 28,212.94) matching Screenshot 1
              let adjustedY = coord.y;
              if (wall.id === 'iv-u1') adjustedY = u1Coord;
              if (wall.id === 'iv-u2') adjustedY = u1Coord + 17;
              if (wall.id === 'iv-u3') adjustedY = u1Coord + 34;
              if (wall.id === 'iv-u4') adjustedY = u1Coord + 51;
              if (wall.id === 'iv-l1') adjustedY = l1Coord;
              if (wall.id === 'iv-l2') adjustedY = l1Coord + 18;

              return (
                <div
                  key={wall.id || idx}
                  style={{ top: `${adjustedY - 9}px` }}
                  className="absolute right-0.5 flex items-center gap-1"
                >
                  {wall.sigma && (
                    <span
                      className={`text-[9px] font-mono leading-none ${
                        isLight ? 'text-[#434651]' : 'text-[#9598a1]'
                      }`}
                    >
                      {wall.sigma}
                    </span>
                  )}
                  <div
                    style={{ backgroundColor: wall.bgColor, color: wall.textColor }}
                    className="px-1.5 py-[2px] rounded-[2px] text-[11px] font-mono font-semibold leading-none tabular-nums shadow-xs min-w-[66px] text-right"
                  >
                    {formatPrice(wall.price, symbolInfo.decimals)}
                  </div>
                </div>
              );
            });
          })()}

        {/* Current Price & Contract Tag matching Screenshot 1: [NQZ2026] [28,304.00 / 00:01] */}
        {currentPriceY !== null && currentPriceY > 10 && currentPriceY < 820 && (
          <div
            style={{ top: `${Number(currentPriceY) - 10}px` }}
            className="absolute right-0.5 flex items-start gap-[1px]"
          >
            <div className="bg-[#9598a1] text-[#131722] px-1.5 py-[2px] rounded-l-[2px] text-[10.5px] font-semibold leading-tight tracking-tight whitespace-nowrap">
              {symbolInfo.contractCode}
            </div>
            <div className="bg-[#9598a1] text-[#131722] px-1.5 py-[2px] rounded-r-[2px] text-[11px] font-mono font-semibold leading-tight tabular-nums text-right min-w-[66px]">
              <div>{formatPrice(symbolInfo.price, symbolInfo.decimals)}</div>
              <div className="text-[9.5px] font-normal opacity-90">{countdownText}</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Trade Positions Overlay on Chart */}
      {positions
        .filter((pos) => pos.symbol === symbolInfo.symbol)
        .map((pos) => {
          const coord = toCoords(0, pos.entryPrice);
          if (coord.y === null || coord.y < 20 || coord.y > 800) return null;
          const pnl = calculatePositionPnL(pos, symbolInfo.price);
          const isProfit = pnl.dollarPnL >= 0;
          return (
            <div
              key={pos.id}
              style={{ top: `${coord.y - 12}px` }}
              className="absolute left-[260px] right-[72px] z-20 flex items-center pointer-events-auto"
            >
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-white shadow ${
                  pos.side === 'BUY' ? 'bg-[#2962ff]' : 'bg-[#f23645]'
                }`}
              >
                <span>
                  {pos.side} {pos.qty} @ {formatPrice(pos.entryPrice, symbolInfo.decimals)}
                </span>
                <span
                  className={`px-1 rounded text-[10px] ${
                    isProfit ? 'bg-[#089981]' : 'bg-[#b71c1c]'
                  }`}
                >
                  {isProfit ? '+' : ''}${pnl.dollarPnL.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => onClosePosition(pos.id)}
                  aria-label={`Close ${pos.side} position`}
                  className="hover:opacity-80 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div
                className={`flex-1 h-[1px] border-t border-dashed ${
                  pos.side === 'BUY' ? 'border-[#2962ff]' : 'border-[#f23645]'
                }`}
              />
            </div>
          );
        })}

      {/* Active Price Alerts Lines on Chart */}
      {alerts
        .filter((al) => al.symbol === symbolInfo.symbol && al.active)
        .map((al) => {
          const coord = toCoords(0, al.targetPrice);
          if (coord.y === null || coord.y < 20 || coord.y > 800) return null;
          return (
            <div
              key={al.id}
              style={{ top: `${coord.y - 9}px` }}
              className="absolute left-[420px] right-[72px] z-10 flex items-center pointer-events-none"
            >
              <span className="bg-[#f59e0b] text-[#0a0a0d] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-l">
                ALERT {formatPrice(al.targetPrice, symbolInfo.decimals)}
              </span>
              <div className="flex-1 h-[1px] border-t border-dotted border-[#f59e0b]" />
            </div>
          );
        })}

      {/* Top-Left Chart Legend Overlay — 1:1 Match with Screenshot 1 */}
      <div className="absolute top-2.5 left-3 z-20 flex flex-col gap-1.5 max-w-[78%] pointer-events-none">
        {/* Row 1: Symbol Full Name · Timeframe · Exchange + Market Badge + Live OHLC */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <h1
              className={`text-[15px] font-semibold tracking-tight ${
                isLight ? 'text-[#131722]' : 'text-[#e0e3eb]'
              }`}
            >
              {symbolInfo.name} · {formatTimeframeHeaderLabel(timeframe)} · {symbolInfo.exchange}
            </h1>
            {/* Small green/rose market session pill icon from Screenshot 1 */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#e8f5e9] border border-[#c8e6c9]">
              <span className="w-2 h-2 rounded-full bg-[#26a69a]" />
              <span className="text-[10px] font-bold text-[#e57373] leading-none">≈</span>
            </span>
          </div>

          {/* OHLC Values: O28,306.00 H28,309.25 L28,298.00 C28,304.00 -3.00 (-0.01%) */}
          <div
            className={`flex items-center gap-1.5 text-[12px] font-mono tabular-nums ${
              isLight ? 'text-[#434651]' : 'text-[#b2b5be]'
            }`}
          >
            <span>
              <span className="text-[#787b86]">O</span>
              {formatPrice(displayBar.open, symbolInfo.decimals)}
            </span>
            <span>
              <span className="text-[#787b86]">H</span>
              {formatPrice(displayBar.high, symbolInfo.decimals)}
            </span>
            <span>
              <span className="text-[#787b86]">L</span>
              {formatPrice(displayBar.low, symbolInfo.decimals)}
            </span>
            <span>
              <span className="text-[#787b86]">C</span>
              {formatPrice(displayBar.close, symbolInfo.decimals)}
            </span>
            <span
              className={
                displayBar.change >= 0 ? 'text-[#089981]' : isLight ? 'text-[#787b86]' : 'text-[#f23645]'
              }
            >
              {displayBar.change >= 0 ? '+' : ''}
              {formatPrice(displayBar.change, symbolInfo.decimals)} ({displayBar.change >= 0 ? '+' : ''}
              {displayBar.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Row 2: Red SELL / Spread / Blue BUY Quick Order Buttons matching Screenshot 1 */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => onQuickOrder('SELL')}
            aria-label={`Sell ${symbolInfo.symbol} at ${formatPrice(symbolInfo.bid, symbolInfo.decimals)}`}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded-[5px] border border-[#f23645] ${
              isLight ? 'bg-white/95 hover:bg-[#ffebee]' : 'bg-[#131722]/90 hover:bg-[#2a1820]'
            } text-[#f23645] transition-colors cursor-pointer min-w-[74px]`}
          >
            <span className="text-[12px] font-mono font-semibold leading-tight tabular-nums">
              {formatPrice(symbolInfo.bid, symbolInfo.decimals)}
            </span>
            <span className="text-[10px] font-semibold tracking-wide leading-tight">SELL</span>
          </button>

          <span
            className={`text-[11px] font-mono tabular-nums ${
              isLight ? 'text-[#434651]' : 'text-[#9598a1]'
            }`}
          >
            {symbolInfo.spread.toFixed(symbolInfo.decimals)}
          </span>

          <button
            type="button"
            onClick={() => onQuickOrder('BUY')}
            aria-label={`Buy ${symbolInfo.symbol} at ${formatPrice(symbolInfo.ask, symbolInfo.decimals)}`}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded-[5px] border border-[#2962ff] ${
              isLight ? 'bg-white/95 hover:bg-[#e3f2fd]' : 'bg-[#131722]/90 hover:bg-[#17233f]'
            } text-[#2962ff] transition-colors cursor-pointer min-w-[74px]`}
          >
            <span className="text-[12px] font-mono font-semibold leading-tight tabular-nums">
              {formatPrice(symbolInfo.ask, symbolInfo.decimals)}
            </span>
            <span className="text-[10px] font-semibold tracking-wide leading-tight">BUY</span>
          </button>
        </div>

        {/* Row 3+: Collapsible Indicator Status Rows matching Screenshot 1 */}
        {legendExpanded && (
          <div className="flex flex-col gap-1 pointer-events-auto">
            {indicators
              .filter((ind) => ind.category === 'institutional' || ind.visible)
              .map((ind) => (
                <div
                  key={ind.id}
                  className={`flex items-center gap-2 text-[12px] leading-snug ${
                    ind.visible
                      ? isLight
                        ? 'text-[#131722]'
                        : 'text-[#b2b5be]'
                      : 'text-[#9598a1]'
                  }`}
                >
                  <span className="truncate max-w-[680px]">
                    <span className={ind.visible ? 'font-medium' : ''}>{ind.shortTitle}</span>{' '}
                    {ind.paramsText && (
                      <span className="text-[#787b86] font-normal">{ind.paramsText}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleIndicatorVisibility(ind.id)}
                    aria-label={`Toggle ${ind.name} visibility`}
                    title={ind.visible ? `Hide ${ind.name}` : `Show ${ind.name}`}
                    className="text-[#434651] hover:text-[#131722] dark:text-[#9598a1] dark:hover:text-white transition-colors shrink-0"
                  >
                    {ind.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Collapse / Expand Legend Button "^" matching Screenshot 1 */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setLegendExpanded((v) => !v)}
            aria-label={legendExpanded ? 'Collapse Indicator Legend' : 'Expand Indicator Legend'}
            className={`w-6 h-5 rounded border flex items-center justify-center transition-colors ${
              isLight
                ? 'bg-white border-[#d1d4dc] text-[#434651] hover:bg-[#f0f3fa]'
                : 'bg-[#181b24] border-[#2a2e39] text-[#b2b5be] hover:bg-[#2a2e39]'
            }`}
          >
            {legendExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Top-Right Currency Unit Selector ("USD v") + Tooltip Toggle */}
      <div className="absolute top-2 right-[78px] z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFloatingTooltipEnabled((v) => !v)}
          aria-label="Toggle Floating Crosshair Tooltip"
          title={floatingTooltipEnabled ? 'Hide Floating Tooltip HUD' : 'Show Floating Tooltip HUD'}
          className={`h-6 px-2 rounded border text-[11px] flex items-center gap-1 transition-colors ${
            floatingTooltipEnabled
              ? 'bg-[#2962ff]/10 border-[#2962ff] text-[#2962ff] font-medium'
              : isLight
              ? 'bg-white border-[#e0e3eb] text-[#787b86]'
              : 'bg-[#181b24] border-[#2a2e39] text-[#9598a1]'
          }`}
        >
          <Info className="w-3 h-3" />
          <span>Tooltip</span>
        </button>

        <select
          value={currencyUnit}
          onChange={(e) => setCurrencyUnit(e.target.value)}
          aria-label="Chart Currency Unit"
          className={`h-6 px-2 rounded border text-[11px] font-medium focus:outline-none ${
            isLight
              ? 'bg-white border-[#e0e3eb] text-[#131722]'
              : 'bg-[#181b24] border-[#2a2e39] text-[#d1d4dc]'
          }`}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="PTS">PTS</option>
        </select>
      </div>

      {/* Floating Crosshair Tooltip HUD when Hovering Candles */}
      {floatingTooltipEnabled && hoverData && (
        <div
          style={{
            left: `${Math.min(Math.max(16, hoverData.x + 18), (containerRef.current?.clientWidth ?? 900) - 245)}px`,
            top: `${Math.min(Math.max(90, hoverData.y - 70), (containerRef.current?.clientHeight ?? 600) - 185)}px`,
          }}
          className="absolute z-30 w-52 bg-[#131722]/95 border border-[#2a2e39] rounded-md shadow-xl p-2.5 text-[11px] text-[#d1d4dc] pointer-events-none backdrop-blur-xs"
        >
          <div className="flex items-center justify-between border-b border-[#2a2e39] pb-1 mb-1.5 text-[10.5px] text-[#9598a1] font-mono">
            <span>{symbolInfo.symbol} · {timeframe}</span>
            <span>
              {new Date(hoverData.time * 1000).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC',
              })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-[11px] font-mono tabular-nums">
            <span className="text-[#787b86]">Open</span>
            <span className="text-right text-white">{formatPrice(hoverData.open, symbolInfo.decimals)}</span>
            <span className="text-[#787b86]">High</span>
            <span className="text-right text-white">{formatPrice(hoverData.high, symbolInfo.decimals)}</span>
            <span className="text-[#787b86]">Low</span>
            <span className="text-right text-white">{formatPrice(hoverData.low, symbolInfo.decimals)}</span>
            <span className="text-[#787b86]">Close</span>
            <span className="text-right font-semibold text-white">{formatPrice(hoverData.close, symbolInfo.decimals)}</span>
            <span className="text-[#787b86]">Change</span>
            <span
              className={`text-right font-semibold ${
                hoverData.change >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {hoverData.change >= 0 ? '+' : ''}
              {formatPrice(hoverData.change, symbolInfo.decimals)} ({hoverData.changePercent.toFixed(2)}%)
            </span>
            <span className="text-[#787b86]">Volume</span>
            <span className="text-right text-[#b2b5be]">{hoverData.volume.toLocaleString()}</span>
            {hoverData.vwap && (
              <>
                <span className="text-[#ff9800]">VWAP</span>
                <span className="text-right text-[#ff9800]">{formatPrice(hoverData.vwap, symbolInfo.decimals)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bar Replay Control Bar when Replay Mode is Active */}
      {replayActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#181b24] border border-[#2a2e39] rounded-md shadow-2xl px-3 py-1.5 text-xs text-white">
          <span className="text-[11px] font-semibold text-[#2962ff] uppercase tracking-wider mr-1">
            Bar Replay ({replayIndex}/{candles.length})
          </span>
          <button
            type="button"
            onClick={onReplayTogglePlay}
            aria-label={replayPlaying ? 'Pause Replay' : 'Play Replay'}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white font-medium"
          >
            {replayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{replayPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={onReplayStep}
            aria-label="Step Forward One Bar"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#2a2e39] hover:bg-[#363a45] text-[#d1d4dc]"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>+1 Bar</span>
          </button>
          <button
            type="button"
            onClick={onReplayExit}
            aria-label="Exit Bar Replay"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#2a2e39] text-[#9598a1] hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      )}

      {/* Bottom-Left "17 TradingView" Logo Watermark matching Screenshot 1 */}
      <div className="absolute bottom-[36px] left-3 z-20 flex items-center gap-1.5 pointer-events-none">
        <div
          className={`flex items-center gap-1.5 font-bold text-[15px] tracking-tight ${
            isLight ? 'text-[#131722]' : 'text-[#e0e3eb]'
          }`}
        >
          <svg viewBox="0 0 28 20" className="w-6 h-4 fill-current">
            <path d="M0 0H11V11H6V20H0V0ZM14 20L21 0H28L21 20H14Z" />
            <circle cx="14.5" cy="4.5" r="3" />
          </svg>
          <span>TradingView</span>
        </div>
      </div>

      {/* Floating Favorite Drawing Tools Toolbar (Screenshot 1 bottom-left & Screenshot 2) */}
      <FloatingFavoritesToolbar
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        onQuickPlaceTool={handleQuickPlaceTool}
        visible={favoritesBarVisible}
      />

      {/* Bottom-Right Purple Lightning Bolt (Latest News & Events) + Scale Settings Gear matching Screenshot 1 */}
      <button
        type="button"
        onClick={onOpenNewsDrawer}
        aria-label="Latest Market News and Economic Events"
        title="Latest News & Economic Events on Timeline"
        className="absolute bottom-[34px] right-[82px] z-20 w-6 h-6 rounded-full border border-[#9c27b0] bg-white dark:bg-[#181b24] text-[#9c27b0] flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer"
      >
        <Zap className="w-3.5 h-3.5 fill-current" />
      </button>

      <div className="absolute bottom-[4px] right-[26px] z-20 pointer-events-none">
        <Settings className={`w-3.5 h-3.5 ${isLight ? 'text-[#434651]' : 'text-[#787b86]'}`} />
      </div>
    </div>
  );
};
