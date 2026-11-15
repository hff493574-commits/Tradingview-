import { CandleBar, roundToTick } from './marketEngine';
import { ChartDrawing, DrawingPoint, DrawingToolId } from '../types/trading';

export interface PixelPoint {
  x: number;
  y: number;
}

export type CoordToPixelFn = (t: number, p: number) => { x: number | null; y: number | null };

export interface HitTestResult {
  drawingId: string;
  handleIndex: number | null; // null means body hit, >= 0 means specific anchor handle index
}

export interface VolumeProfileRow {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  ratio: number; // 0..1 normalized to max row volume
  isPOC: boolean;
}

export interface PositionStats {
  entry: number;
  target: number;
  stop: number;
  rewardPoints: number;
  riskPoints: number;
  rewardPercent: number;
  riskPercent: number;
  riskRewardRatio: number;
}

export interface MeasureStats {
  priceDiff: number;
  percentDiff: number;
  barsCount: number;
  durationLabel: string;
  angleDeg: number;
}

/**
 * Returns how many anchor clicks/points a drawing tool expects before auto-completing.
 * Returns 'multi' for polylines/Elliott waves, 'freehand' for brush/highlighter.
 */
export function getToolPointMode(tool: DrawingToolId): 1 | 2 | 3 | 'multi' | 'freehand' {
  switch (tool) {
    case 'horizontal-line':
    case 'horizontal-ray':
    case 'vertical-line':
    case 'cross-line':
    case 'text-note':
    case 'price-label':
    case 'long-position':
    case 'short-position':
      return 1;
    case 'pitchfork':
    case 'fib-extension':
      return 3;
    case 'wave-path':
    case 'elliott-wave':
      return 'multi';
    case 'brush':
    case 'highlighter':
      return 'freehand';
    default:
      return 2;
  }
}

/**
 * Human-friendly label for every drawing tool
 */
export function getToolDisplayName(tool: DrawingToolId): string {
  const names: Record<DrawingToolId, string> = {
    cursor: 'Crosshair',
    'trend-line': 'Trend Line',
    ray: 'Ray',
    'info-line': 'Info Line',
    'extended-line': 'Extended Line',
    'horizontal-line': 'Horizontal Line',
    'horizontal-ray': 'Horizontal Ray',
    'vertical-line': 'Vertical Line',
    'cross-line': 'Cross Line',
    'parallel-channel': 'Parallel Channel',
    'fib-levels': 'Fib Retracement',
    'fib-extension': 'Trend-Based Fib Extension',
    pitchfork: 'Andrews Pitchfork',
    'liquidity-box': 'Liquidity Pool Channel (L)',
    'stop-channel': 'Settlement / Stop Zone (S)',
    brush: 'Brush',
    highlighter: 'Highlighter',
    rectangle: 'Rectangle',
    circle: 'Circle / Ellipse',
    triangle: 'Triangle',
    'text-note': 'Text',
    callout: 'Callout',
    'price-label': 'Price Note',
    'long-position': 'Long Position',
    'short-position': 'Short Position',
    'price-range': 'Price Range',
    'date-range': 'Date Range',
    'volume-profile': 'Fixed Range Volume Profile',
    'candle-pattern': 'Bars Pattern',
    'wave-path': 'Polyline / Path',
    'elliott-wave': 'Elliott Impulse Wave (12345)',
    'time-cycles': 'Fib Time Zones',
    measure: 'Measure',
  };
  return names[tool] || tool;
}

/**
 * Snaps a raw price to the nearest OHLC value of the candle at `timeSec` when magnet mode is active.
 * Uses O(log N) binary search and optional vertical proximity cap (`maxPriceDelta`) for TradingView-style weak magnet feel.
 */
export function snapPriceToCandle(
  candles: CandleBar[],
  timeSec: number,
  rawPrice: number,
  magnetMode: boolean,
  tickSize: number,
  decimals: number,
  maxPriceDelta?: number
): number {
  if (!magnetMode || candles.length === 0) {
    return roundToTick(rawPrice, tickSize, decimals);
  }

  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < timeSec) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  let nearest = candles[lo];
  if (lo > 0 && Math.abs(candles[lo - 1].time - timeSec) < Math.abs(nearest.time - timeSec)) {
    nearest = candles[lo - 1];
  }

  const step =
    candles.length >= 2
      ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
      : 60;
  // Do not snap horizontally/OHLC when cursor is beyond 1.5 bars into right future whitespace
  if (Math.abs(nearest.time - timeSec) > step * 1.5) {
    return roundToTick(rawPrice, tickSize, decimals);
  }

  let bestOhlc = nearest.open;
  let bestDiff = Math.abs(nearest.open - rawPrice);
  const ohlc = [nearest.high, nearest.low, nearest.close];
  for (let i = 0; i < ohlc.length; i++) {
    const d = Math.abs(ohlc[i] - rawPrice);
    if (d < bestDiff) {
      bestDiff = d;
      bestOhlc = ohlc[i];
    }
  }

  if (maxPriceDelta !== undefined && bestDiff > maxPriceDelta) {
    return roundToTick(rawPrice, tickSize, decimals);
  }
  return bestOhlc;
}

/**
 * Computes real Volume-by-Price Profile from candles within [t1, t2] and price range [lowPrice, highPrice].
 */
export function computeVolumeProfile(
  candles: CandleBar[],
  t1: number,
  t2: number,
  p1: number,
  p2: number,
  rowCount: number = 14
): { rows: VolumeProfileRow[]; pocPrice: number; totalVolume: number } {
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const slice = candles.filter((c) => c.time >= tMin && c.time <= tMax);

  let low = Math.min(p1, p2);
  let high = Math.max(p1, p2);

  if (slice.length > 0 && Math.abs(high - low) < 1e-9) {
    low = Math.min(...slice.map((c) => c.low));
    high = Math.max(...slice.map((c) => c.high));
  }

  const span = Math.max(0.0001, high - low);
  const step = span / rowCount;

  const buckets = Array.from({ length: rowCount }, (_, idx) => ({
    priceLow: low + idx * step,
    priceHigh: low + (idx + 1) * step,
    priceMid: low + (idx + 0.5) * step,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
  }));

  let totalVolume = 0;
  for (const bar of slice) {
    const isBull = bar.close >= bar.open;
    // Distribute bar volume across buckets touched by [bar.low, bar.high]
    const touched: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      if (bar.high >= buckets[i].priceLow && bar.low <= buckets[i].priceHigh) {
        touched.push(i);
      }
    }
    if (touched.length === 0) {
      const clampedIdx = Math.max(
        0,
        Math.min(rowCount - 1, Math.floor((bar.close - low) / step))
      );
      touched.push(clampedIdx);
    }
    const volPerBucket = bar.volume / touched.length;
    for (const idx of touched) {
      buckets[idx].volume += volPerBucket;
      if (isBull) buckets[idx].buyVolume += volPerBucket;
      else buckets[idx].sellVolume += volPerBucket;
    }
    totalVolume += bar.volume;
  }

  let maxVol = 0;
  let pocIdx = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].volume > maxVol) {
      maxVol = buckets[i].volume;
      pocIdx = i;
    }
  }

  const rows: VolumeProfileRow[] = buckets.map((b, i) => ({
    ...b,
    ratio: maxVol > 0 ? b.volume / maxVol : 0.1,
    isPOC: i === pocIdx,
  }));

  return {
    rows,
    pocPrice: buckets[pocIdx]?.priceMid ?? (low + high) / 2,
    totalVolume,
  };
}

/**
 * Computes Fibonacci Retracement levels between anchor points p1 (100% start) and p2 (0% end)
 */
export function computeFibLevels(
  p1: number,
  p2: number,
  ratios: number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
): Array<{ ratio: number; price: number }> {
  return ratios.map((ratio) => ({
    ratio,
    price: p2 + (p1 - p2) * ratio,
  }));
}

/**
 * Computes Fibonacci Time Zone timestamps starting at t1 with unit interval (t2 - t1)
 */
export function computeFibTimeZones(
  t1: number,
  t2: number,
  fibSeq: number[] = [0, 1, 2, 3, 5, 8, 13, 21]
): Array<{ fib: number; time: number }> {
  const unit = Math.max(60, Math.abs(t2 - t1));
  const dir = t2 >= t1 ? 1 : -1;
  return fibSeq.map((fib) => ({
    fib,
    time: t1 + dir * fib * unit,
  }));
}

/**
 * Computes Long/Short Position Risk-Reward metrics
 */
export function computePositionStats(
  side: 'long' | 'short',
  entry: number,
  target: number,
  stop: number
): PositionStats {
  const rewardPoints = side === 'long' ? target - entry : entry - target;
  const riskPoints = side === 'long' ? entry - stop : stop - entry;
  const safeRisk = Math.max(0.0001, Math.abs(riskPoints));
  const rewardPercent = (rewardPoints / entry) * 100;
  const riskPercent = (Math.abs(riskPoints) / entry) * 100;
  const riskRewardRatio = rewardPoints / safeRisk;
  return {
    entry,
    target,
    stop,
    rewardPoints,
    riskPoints: Math.abs(riskPoints),
    rewardPercent,
    riskPercent,
    riskRewardRatio,
  };
}

/**
 * Computes bar count, price delta, %, and duration for Info Line / Measure / Price Range
 */
export function computeMeasureStats(
  candles: CandleBar[],
  t1: number,
  p1: number,
  t2: number,
  p2: number,
  dxPx: number = 100,
  dyPx: number = 0
): MeasureStats {
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const barsCount = candles.filter((c) => c.time >= tMin && c.time <= tMax).length;
  const diffSec = Math.abs(t2 - t1);
  let durationLabel = `${diffSec}s`;
  if (diffSec >= 86400) {
    durationLabel = `${Math.floor(diffSec / 86400)}d ${Math.floor((diffSec % 86400) / 3600)}h`;
  } else if (diffSec >= 3600) {
    durationLabel = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
  } else if (diffSec >= 60) {
    durationLabel = `${Math.round(diffSec / 60)}m`;
  }
  const priceDiff = p2 - p1;
  const percentDiff = p1 !== 0 ? (priceDiff / p1) * 100 : 0;
  const angleDeg = (Math.atan2(-dyPx, dxPx) * 180) / Math.PI;
  return {
    priceDiff,
    percentDiff,
    barsCount,
    durationLabel,
    angleDeg,
  };
}

/**
 * Distance from point (px, py) to segment (x1, y1)-(x2, y2)
 */
export function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Translates an entire drawing by (dt, dp) in data space
 */
export function translateDrawing(drawing: ChartDrawing, dt: number, dp: number): ChartDrawing {
  const nextPoints = drawing.points.map((pt) => ({
    t: Math.round(pt.t + dt),
    p: pt.p + dp,
  }));
  return {
    ...drawing,
    points: nextPoints,
    t1: nextPoints[0]?.t ?? drawing.t1 + dt,
    p1: nextPoints[0]?.p ?? drawing.p1 + dp,
    t2: nextPoints[1]?.t ?? drawing.t2 + dt,
    p2: nextPoints[1]?.p ?? drawing.p2 + dp,
  };
}

/**
 * Updates a single handle vertex of a drawing
 */
export function moveDrawingHandle(
  drawing: ChartDrawing,
  handleIndex: number,
  newPoint: DrawingPoint
): ChartDrawing {
  const nextPoints = drawing.points.map((pt, idx) =>
    idx === handleIndex ? { t: newPoint.t, p: newPoint.p } : pt
  );
  // For Long/Short position: handle 0 = entry (t1, p1), handle 1 = TP (p2), handle 2 = SL (p3)
  return {
    ...drawing,
    points: nextPoints,
    t1: nextPoints[0]?.t ?? drawing.t1,
    p1: nextPoints[0]?.p ?? drawing.p1,
    t2: nextPoints[1]?.t ?? drawing.t2,
    p2: nextPoints[1]?.p ?? drawing.p2,
  };
}

/**
 * Hit-tests all visible drawings in reverse render order (top-most first).
 * Returns the matched drawing ID and optional handle index.
 */
export function hitTestDrawings(
  drawings: ChartDrawing[],
  px: number,
  py: number,
  toCoords: CoordToPixelFn,
  canvasWidth: number = 1200,
  canvasHeight: number = 800,
  tolerance: number = 9
): HitTestResult | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (d.visible === false) continue;

    const pixelPts: PixelPoint[] = [];
    let valid = true;
    for (const pt of d.points) {
      const c = toCoords(pt.t, pt.p);
      if (c.x === null || c.y === null) {
        valid = false;
        break;
      }
      pixelPts.push({ x: c.x, y: c.y });
    }
    if (!valid || pixelPts.length === 0) continue;

    // 1. Check anchor handles first (for non-freehand tools)
    if (d.tool !== 'brush' && d.tool !== 'highlighter') {
      for (let h = 0; h < pixelPts.length; h++) {
        const dist = Math.hypot(px - pixelPts[h].x, py - pixelPts[h].y);
        if (dist <= tolerance + 5) {
          return { drawingId: d.id, handleIndex: h };
        }
      }
    }

    const p0 = pixelPts[0];
    const p1 = pixelPts[1] ?? { x: p0.x + 140, y: p0.y };

    // 2. Check body hit per tool geometry
    if (d.tool === 'horizontal-line') {
      if (Math.abs(py - p0.y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'horizontal-ray') {
      if (Math.abs(py - p0.y) <= tolerance && px >= p0.x - tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'vertical-line') {
      if (Math.abs(px - p0.x) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'cross-line') {
      if (Math.abs(px - p0.x) <= tolerance || Math.abs(py - p0.y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'text-note' || d.tool === 'callout' || d.tool === 'price-label') {
      const boxW = Math.max(120, (d.text?.length ?? 12) * 7.2 + 20);
      if (px >= p0.x - 8 && px <= p0.x + boxW && py >= p0.y - 28 && py <= p0.y + 10) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (
      d.tool === 'rectangle' ||
      d.tool === 'circle' ||
      d.tool === 'liquidity-box' ||
      d.tool === 'stop-channel' ||
      d.tool === 'fib-levels' ||
      d.tool === 'volume-profile' ||
      d.tool === 'measure' ||
      d.tool === 'price-range' ||
      d.tool === 'date-range' ||
      d.tool === 'candle-pattern'
    ) {
      const rx = Math.min(p0.x, p1.x);
      const ry = Math.min(p0.y, p1.y);
      const rw = Math.max(20, Math.abs(p1.x - p0.x));
      const rh = Math.max(14, Math.abs(p1.y - p0.y));
      if (px >= rx - tolerance && px <= rx + rw + tolerance && py >= ry - tolerance && py <= ry + rh + tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'long-position' || d.tool === 'short-position') {
      const p2 = pixelPts[2] ?? { x: p1.x, y: p0.y + (p0.y - p1.y) };
      const rx = Math.min(p0.x, p1.x);
      const rw = Math.max(60, Math.abs(p1.x - p0.x));
      const topY = Math.min(p0.y, p1.y, p2.y);
      const botY = Math.max(p0.y, p1.y, p2.y);
      if (px >= rx - tolerance && px <= rx + rw + tolerance && py >= topY - tolerance && py <= botY + tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'ray' || d.tool === 'extended-line') {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const startX = d.tool === 'extended-line' ? p0.x - ux * canvasWidth : p0.x;
      const startY = d.tool === 'extended-line' ? p0.y - uy * canvasHeight : p0.y;
      const endX = p0.x + ux * (canvasWidth * 2);
      const endY = p0.y + uy * (canvasWidth * 2);
      if (distPointToSegment(px, py, startX, startY, endX, endY) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'time-cycles') {
      if (px >= Math.min(p0.x, p1.x) - tolerance && px <= Math.max(p0.x, p1.x) + 180) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    // Multi-point segments (trend-line, info-line, wave-path, elliott-wave, brush, highlighter, triangle, pitchfork, fib-extension, parallel-channel)
    for (let j = 0; j < pixelPts.length - 1; j++) {
      if (distPointToSegment(px, py, pixelPts[j].x, pixelPts[j].y, pixelPts[j + 1].x, pixelPts[j + 1].y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
    }
    if (d.tool === 'triangle' && pixelPts.length >= 2) {
      // Check triangle perimeter
      const pTop = { x: (p0.x + p1.x) / 2, y: p0.y };
      const pBL = { x: p0.x, y: p1.y };
      const pBR = { x: p1.x, y: p1.y };
      if (
        distPointToSegment(px, py, pTop.x, pTop.y, pBL.x, pBL.y) <= tolerance ||
        distPointToSegment(px, py, pBL.x, pBL.y, pBR.x, pBR.y) <= tolerance ||
        distPointToSegment(px, py, pBR.x, pBR.y, pTop.x, pTop.y) <= tolerance
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
    }
  }

  return null;
}

/**
 * Builds a complete default or click-placed ChartDrawing for any tool
 */
export function createDrawingFromPoints(
  tool: DrawingToolId,
  symbol: string,
  points: DrawingPoint[],
  candles: CandleBar[],
  tickSize: number,
  decimals: number,
  color: string = '#2962ff'
): ChartDrawing {
  const p0 = points[0];
  let finalPoints = [...points];
  const barStepSec =
    candles.length >= 2
      ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
      : 60;

  if (tool === 'long-position' || tool === 'short-position') {
    const step = Math.max(tickSize * 40, p0.p * 0.0009);
    const tWidth = Math.max(barStepSec * 14, 600);
    const tp = tool === 'long-position' ? roundToTick(p0.p + step * 2, tickSize, decimals) : roundToTick(p0.p - step * 2, tickSize, decimals);
    const sl = tool === 'long-position' ? roundToTick(p0.p - step, tickSize, decimals) : roundToTick(p0.p + step, tickSize, decimals);
    finalPoints = [
      { t: p0.t, p: p0.p },
      { t: p0.t + tWidth, p: tp },
      { t: p0.t + tWidth, p: sl },
    ];
  } else if (tool === 'horizontal-line' || tool === 'horizontal-ray' || tool === 'vertical-line' || tool === 'cross-line' || tool === 'text-note' || tool === 'price-label') {
    const lastT = candles[candles.length - 1]?.time ?? p0.t + barStepSec * 20;
    finalPoints = [p0, { t: Math.max(p0.t + barStepSec * 10, lastT), p: p0.p }];
  } else if (finalPoints.length >= 2) {
    // Ensure non-zero span if user clicked twice in same pixel
    if (finalPoints[1].t === finalPoints[0].t && finalPoints[1].p === finalPoints[0].p) {
      finalPoints[1] = {
        t: finalPoints[0].t + barStepSec * 12,
        p: roundToTick(finalPoints[0].p - tickSize * 20, tickSize, decimals),
      };
    }
  }

  let clonedBars: ChartDrawing['clonedBars'];
  if (tool === 'candle-pattern' && finalPoints.length >= 2) {
    const tMin = Math.min(finalPoints[0].t, finalPoints[1].t);
    const tMax = Math.max(finalPoints[0].t, finalPoints[1].t);
    const slice = candles.filter((c) => c.time >= tMin && c.time <= tMax).slice(0, 24);
    if (slice.length > 0) {
      const baseOpen = slice[0].open;
      clonedBars = slice.map((b) => ({
        openOffset: b.open - baseOpen,
        highOffset: b.high - baseOpen,
        lowOffset: b.low - baseOpen,
        closeOffset: b.close - baseOpen,
      }));
    }
  }

  const defaultColor =
    tool === 'stop-channel'
      ? '#f23645'
      : tool === 'rectangle'
      ? '#089981'
      : tool === 'highlighter'
      ? '#ffeb3b'
      : color;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol,
    tool,
    points: finalPoints,
    t1: finalPoints[0].t,
    p1: finalPoints[0].p,
    t2: finalPoints[1]?.t ?? finalPoints[0].t + 900,
    p2: finalPoints[1]?.p ?? finalPoints[0].p,
    text:
      tool === 'text-note'
        ? 'Institutional Note'
        : tool === 'callout'
        ? 'Liquidity Sweep'
        : tool === 'price-label'
        ? `${p0.p.toFixed(decimals)}`
        : undefined,
    color: defaultColor,
    lineWidth: tool === 'highlighter' ? 10 : 1.8,
    lineStyle: tool === 'vertical-line' ? 'dashed' : 'solid',
    fontSize: 12,
    locked: false,
    visible: true,
    clonedBars,
  };
}
