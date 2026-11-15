import {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ITimeScaleApi,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import {
  CandleBar,
  IVWallLevel,
  SupplyDemandZone,
  SymbolInfo,
  formatPrice,
} from '../utils/marketEngine';
import { ChartDrawing } from '../types/trading';
import {
  computeFibLevels,
  computeFibTimeZones,
  computeMeasureStats,
  computePositionStats,
  computeVolumeProfile,
} from '../utils/drawingEngine';

export interface LiveDrawingPreviewState {
  drawing: ChartDrawing | null;
  isGhost?: boolean;
  snapPixel?: { x: number; y: number } | null;
}

export interface ChartOverlaysState {
  candles: CandleBar[];
  candleIntervalSec: number;
  symbolInfo: SymbolInfo;
  isLight: boolean;
  ssmtVisible: boolean;
  ivWallsVisible: boolean;
  supplyDemandZones: SupplyDemandZone[];
  ivWalls: IVWallLevel[];
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
}

/**
 * Converts any Unix timestamp (in-series, gap-interior, or future/past offset) into
 * an exact X coordinate using LightweightCharts' live timeScale transform.
 */
export function timeToChartX(
  ts: ITimeScaleApi<Time>,
  candles: CandleBar[],
  candleIntervalSec: number,
  timeSec: number
): number | null {
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;

  const direct = ts.timeToCoordinate(timeSec as Time);
  if (direct !== null && direct !== undefined && Number.isFinite(Number(direct))) {
    return Number(direct);
  }
  if (candles.length === 0) return null;

  const safeInterval = Math.max(1, candleIntervalSec);
  const lastIdx = candles.length - 1;
  const firstTime = candles[0].time;
  const lastTime = candles[lastIdx].time;

  let logical: number;
  if (candles.length === 1 || timeSec <= firstTime) {
    logical = (timeSec - firstTime) / safeInterval;
  } else if (timeSec >= lastTime) {
    logical = lastIdx + (timeSec - lastTime) / safeInterval;
  } else {
    // Binary search for surrounding candles [lo, lo + 1]
    let lo = 0;
    let hi = lastIdx - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (candles[mid].time <= timeSec) lo = mid;
      else hi = mid - 1;
    }
    const t0 = candles[lo].time;
    const t1 = candles[lo + 1]?.time ?? t0 + safeInterval;
    const span = Math.max(1, t1 - t0);
    logical = lo + (timeSec - t0) / span;
  }

  const coord = ts.logicalToCoordinate(logical as Logical);
  if (coord !== null && coord !== undefined && Number.isFinite(Number(coord))) {
    return Number(coord);
  }

  // Fallback linear extrapolation using visible logical range so points far right/left stay positioned properly
  const visRange = ts.getVisibleLogicalRange();
  const chartW = ts.width();
  if (visRange && chartW > 0 && visRange.to > visRange.from) {
    const pxPerBar = chartW / (visRange.to - visRange.from);
    return (logical - visRange.from) * pxPerBar;
  }
  return null;
}

function getDashPattern(style?: 'solid' | 'dashed' | 'dotted'): number[] {
  if (style === 'dashed') return [6, 4];
  if (style === 'dotted') return [2, 3];
  return [];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawHandlesCanvas(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  isSelected: boolean,
  color: string
) {
  const r = isSelected ? 5 : 4;
  for (const pt of points) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelected ? '#2962ff' : color;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
  }
}

function renderSingleDrawingCanvas(
  ctx: CanvasRenderingContext2D,
  paneWidth: number,
  paneHeight: number,
  d: ChartDrawing,
  state: ChartOverlaysState,
  toCoords: (t: number, p: number) => { x: number | null; y: number | null }
) {
  if (d.visible === false || d.points.length === 0) return;

  const pixelPts = d.points.map((pt) => toCoords(pt.t, pt.p));
  if (pixelPts[0].x === null || pixelPts[0].y === null) return;

  const p0 = { x: pixelPts[0].x, y: pixelPts[0].y };
  const p1 = {
    x: pixelPts[1]?.x ?? p0.x + 140,
    y: pixelPts[1]?.y ?? p0.y,
  };
  const p2 =
    pixelPts[2] && pixelPts[2].x !== null && pixelPts[2].y !== null
      ? { x: pixelPts[2].x, y: pixelPts[2].y }
      : null;

  const rx = Math.min(p0.x, p1.x);
  const ry = Math.min(p0.y, p1.y);
  const rw = Math.max(16, Math.abs(p1.x - p0.x));
  const rh = Math.max(12, Math.abs(p1.y - p0.y));

  const isSelected = d.id === state.selectedDrawingId;
  const isHovered = d.id === state.hoveredDrawingId;
  const showHandles =
    (isSelected || isHovered || d.id === 'draft-preview') &&
    d.tool !== 'brush' &&
    d.tool !== 'highlighter';
  const strokeWidth = d.lineWidth ?? 1.8;
  const dash = getDashPattern(d.lineStyle);
  const { candles, symbolInfo, isLight } = state;
  const maxW = Math.max(paneWidth, 3000);
  const maxH = Math.max(paneHeight, 2000);

  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.setLineDash(dash);

  // 1. Horizontal Line
  if (d.tool === 'horizontal-line') {
    ctx.beginPath();
    ctx.moveTo(0, p0.y);
    ctx.lineTo(maxW, p0.y);
    ctx.stroke();
    if (d.text) {
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(d.text, p0.x + 8, p0.y - 6);
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 2. Horizontal Ray
  if (d.tool === 'horizontal-ray') {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(maxW, p0.y);
    ctx.stroke();
    if (d.text) {
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(d.text, p0.x + 10, p0.y - 6);
    }
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 3. Vertical Line
  if (d.tool === 'vertical-line') {
    ctx.setLineDash(dash.length ? dash : [5, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, 0);
    ctx.lineTo(p0.x, maxH);
    ctx.stroke();
    if (d.text) {
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(d.text, p0.x + 6, 32);
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 4. Cross Line
  if (d.tool === 'cross-line') {
    ctx.setLineDash(dash.length ? dash : [4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, p0.y);
    ctx.lineTo(maxW, p0.y);
    ctx.moveTo(p0.x, 0);
    ctx.lineTo(p0.x, maxH);
    ctx.stroke();
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 5. Text Note / Callout / Price Label
  if (d.tool === 'text-note' || d.tool === 'callout' || d.tool === 'price-label') {
    const label =
      d.text ||
      (d.tool === 'price-label'
        ? formatPrice(d.points[0].p, symbolInfo.decimals)
        : 'Annotation');
    const boxW = Math.max(96, label.length * 7.2 + 20);

    if (d.tool === 'price-label') {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + 10, p0.y - 11);
      ctx.lineTo(p0.x + 10 + boxW, p0.y - 11);
      ctx.lineTo(p0.x + 10 + boxW, p0.y + 11);
      ctx.lineTo(p0.x + 10, p0.y + 11);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 11px monospace';
      ctx.fillText(label, p0.x + 16, p0.y + 4);
      if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
      ctx.restore();
      return;
    }

    if (d.tool === 'callout') {
      ctx.setLineDash([]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      drawRoundedRect(ctx, p1.x - 10, p1.y - 24, boxW, 24, 4);
      ctx.fillStyle = '#131722';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${d.fontSize ?? 11}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(label, p1.x, p1.y - 8);
      if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
      ctx.restore();
      return;
    }

    drawRoundedRect(ctx, p0.x, p0.y - 24, boxW, 24, 4);
    ctx.fillStyle = isSelected ? '#1c2333' : '#131722';
    ctx.fill();
    ctx.lineWidth = isSelected ? 1.8 : 1.1;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${d.fontSize ?? 11.5}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(label, p0.x + 9, p0.y - 8);
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 6. Trend Line / Ray / Extended Line / Info Line
  if (
    d.tool === 'trend-line' ||
    d.tool === 'ray' ||
    d.tool === 'extended-line' ||
    d.tool === 'info-line'
  ) {
    let sx = p0.x;
    let sy = p0.y;
    let ex = p1.x;
    let ey = p1.y;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);

    if ((d.tool === 'ray' || d.tool === 'extended-line') && len > 1) {
      const ux = dx / len;
      const uy = dy / len;
      ex = p0.x + ux * 2800;
      ey = p0.y + uy * 2800;
      if (d.tool === 'extended-line') {
        sx = p0.x - ux * 2800;
        sy = p0.y - uy * 2800;
      }
    }

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    if (d.tool === 'info-line') {
      const stats = computeMeasureStats(
        candles,
        d.points[0].t,
        d.points[0].p,
        d.points[1]?.t ?? d.points[0].t,
        d.points[1]?.p ?? d.points[0].p,
        dx,
        dy
      );
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.setLineDash([]);
      drawRoundedRect(ctx, midX - 78, midY - 28, 156, 22, 4);
      ctx.fillStyle = '#131722';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${stats.priceDiff >= 0 ? '+' : ''}${formatPrice(stats.priceDiff, symbolInfo.decimals)} (${stats.percentDiff.toFixed(2)}%) · ${stats.barsCount}b`,
        midX,
        midY - 13
      );
    }

    if (d.text) {
      ctx.fillStyle = d.color;
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.text, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2 - 8);
    }

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 7. Parallel Channel / Liquidity Pool / Settlement Stop Channel
  if (
    d.tool === 'parallel-channel' ||
    d.tool === 'liquidity-box' ||
    d.tool === 'stop-channel'
  ) {
    const tag = d.tool === 'liquidity-box' ? 'L' : d.tool === 'stop-channel' ? 'S' : 'CH';
    const midY = (p0.y + p1.y) / 2;

    ctx.fillStyle =
      d.tool === 'stop-channel' ? 'rgba(242, 54, 69, 0.12)' : 'rgba(41, 98, 255, 0.10)';
    ctx.fillRect(rx, ry, rw, rh);

    ctx.beginPath();
    ctx.moveTo(rx, p0.y);
    ctx.lineTo(rx + rw, p0.y);
    ctx.moveTo(rx, p1.y);
    ctx.lineTo(rx + rw, p1.y);
    ctx.stroke();

    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, midY);
    ctx.lineTo(rx + rw, midY);
    ctx.stroke();

    ctx.fillStyle = d.color;
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      d.text || `${tag} · ${formatPrice(Math.abs(d.p1 - d.p2), symbolInfo.decimals)} pts`,
      rx + rw / 2,
      midY - 4
    );

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 8. Rectangle / Circle / Triangle
  if (d.tool === 'rectangle') {
    ctx.fillStyle =
      d.color === '#089981' ? 'rgba(8, 153, 129, 0.15)' : `${d.color}26`;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    if (d.text) {
      ctx.fillStyle = d.color;
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(d.text, rx + 6, ry + 16);
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  if (d.tool === 'circle') {
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(10, rw / 2), Math.max(10, rh / 2), 0, 0, Math.PI * 2);
    ctx.fillStyle = `${d.color}22`;
    ctx.fill();
    ctx.stroke();
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  if (d.tool === 'triangle') {
    const topX = (p0.x + p1.x) / 2;
    ctx.beginPath();
    ctx.moveTo(topX, p0.y);
    ctx.lineTo(p0.x, p1.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fillStyle = `${d.color}22`;
    ctx.fill();
    ctx.stroke();
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 9. Measure / Price Range / Date Range
  if (d.tool === 'measure' || d.tool === 'price-range' || d.tool === 'date-range') {
    const stats = computeMeasureStats(
      candles,
      d.points[0].t,
      d.points[0].p,
      d.points[1]?.t ?? d.points[0].t,
      d.points[1]?.p ?? d.points[0].p
    );
    const isPositive = stats.priceDiff >= 0;
    const boxColor = isPositive ? '#2962ff' : '#f23645';

    ctx.fillStyle = isPositive ? 'rgba(41, 98, 255, 0.16)' : 'rgba(242, 54, 69, 0.16)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry);
    ctx.lineTo(rx + rw / 2, ry + rh);
    ctx.moveTo(rx, ry + rh / 2);
    ctx.lineTo(rx + rw, ry + rh / 2);
    ctx.stroke();

    ctx.setLineDash([]);
    drawRoundedRect(ctx, rx + rw / 2 - 84, ry + rh + 6, 168, 34, 4);
    ctx.fillStyle = boxColor;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10.5px monospace';
    ctx.fillText(
      `${isPositive ? '+' : ''}${formatPrice(stats.priceDiff, symbolInfo.decimals)} (${stats.percentDiff.toFixed(2)}%)`,
      rx + rw / 2,
      ry + rh + 20
    );
    ctx.fillStyle = '#e3f2fd';
    ctx.font = '9.5px monospace';
    ctx.fillText(
      `${stats.barsCount} bars · ${stats.durationLabel}`,
      rx + rw / 2,
      ry + rh + 34
    );

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 10. Fib Retracement
  if (d.tool === 'fib-levels') {
    const levels = computeFibLevels(d.points[0].p, d.points[1]?.p ?? d.points[0].p);
    const bandColors = [
      'rgba(120, 123, 134, 0.08)',
      'rgba(244, 67, 54, 0.09)',
      'rgba(255, 152, 0, 0.09)',
      'rgba(76, 175, 80, 0.11)',
      'rgba(33, 150, 243, 0.11)',
      'rgba(156, 39, 176, 0.09)',
    ];
    const fibW = Math.max(120, rw);

    ctx.save();
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();

    for (let idx = 0; idx < levels.length; idx++) {
      const lvl = levels[idx];
      const coord = toCoords(d.points[0].t, lvl.price);
      if (coord.y === null) continue;
      const nextLvl = levels[idx + 1];
      const nextCoord = nextLvl ? toCoords(d.points[0].t, nextLvl.price) : null;
      if (nextCoord && nextCoord.y !== null) {
        ctx.fillStyle = bandColors[idx % bandColors.length];
        ctx.fillRect(rx, Math.min(coord.y, nextCoord.y), fibW, Math.abs(nextCoord.y - coord.y));
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = lvl.ratio === 0.618 || lvl.ratio === 0.5 ? '#2962ff' : d.color;
      ctx.lineWidth = lvl.ratio === 0.618 ? 1.6 : 1.1;
      ctx.beginPath();
      ctx.moveTo(rx, coord.y);
      ctx.lineTo(rx + fibW, coord.y);
      ctx.stroke();

      ctx.fillStyle = isLight ? '#131722' : '#d1d4dc';
      ctx.font = '600 9.5px monospace';
      ctx.fillText(
        `${lvl.ratio.toFixed(3)} (${formatPrice(lvl.price, symbolInfo.decimals)})`,
        rx + 4,
        coord.y - 3
      );
    }

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 11. 3-Point Pitchfork & Fib Extension
  if (d.tool === 'pitchfork' || d.tool === 'fib-extension') {
    const third = p2 ?? { x: p1.x + 80, y: p0.y };
    const midX = (p1.x + third.x) / 2;
    const midY = (p1.y + third.y) / 2;
    const dx = midX - p0.x;
    const dy = midY - p0.y;

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p0.x + dx * 2.5, p0.y + dy * 2.5);
    ctx.stroke();

    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + dx * 2.2, p1.y + dy * 2.2);
    ctx.moveTo(third.x, third.y);
    ctx.lineTo(third.x + dx * 2.2, third.y + dy * 2.2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(third.x, third.y);
    ctx.stroke();

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1, third], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 12. Fixed Range Volume Profile
  if (d.tool === 'volume-profile') {
    const tMin = Math.min(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const tMax = Math.max(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const lowP = Math.min(d.points[0].p, d.points[1]?.p ?? d.points[0].p);
    const highP = Math.max(d.points[0].p, d.points[1]?.p ?? d.points[0].p);
    const profile = computeVolumeProfile(candles, tMin, tMax, lowP, highP, 14);
    const rowH = rh / profile.rows.length;

    ctx.fillStyle = 'rgba(41, 98, 255, 0.04)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(rx, ry, rw, rh);

    for (let idx = 0; idx < profile.rows.length; idx++) {
      const row = profile.rows[idx];
      const svgIdx = profile.rows.length - 1 - idx;
      const barW = Math.max(6, rw * 0.85 * row.ratio);
      ctx.fillStyle = row.isPOC ? 'rgba(242, 54, 69, 0.68)' : 'rgba(41, 98, 255, 0.36)';
      ctx.fillRect(rx, ry + svgIdx * rowH + 1, barW, Math.max(2, rowH - 2));
      if (row.isPOC) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#f23645';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, ry + svgIdx * rowH + rowH / 2);
        ctx.lineTo(rx + rw, ry + svgIdx * rowH + rowH / 2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#2962ff';
    ctx.font = '700 10px monospace';
    ctx.fillText(
      `POC: ${formatPrice(profile.pocPrice, symbolInfo.decimals)} · Vol: ${Math.round(profile.totalVolume).toLocaleString()}`,
      rx + 4,
      ry - 5
    );
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 13. Long Position & Short Position
  if (d.tool === 'long-position' || d.tool === 'short-position') {
    const isLong = d.tool === 'long-position';
    const entryP = d.points[0].p;
    const tpP = d.points[1]?.p ?? (isLong ? entryP + 40 : entryP - 40);
    const slP = d.points[2]?.p ?? (isLong ? entryP - 20 : entryP + 20);
    const tpHandle = p1;
    const slHandle = p2 ?? { x: p1.x, y: p0.y + (p0.y - p1.y) };

    const boxRight = Math.max(p0.x + 128, tpHandle.x, slHandle.x);
    const boxW = Math.max(128, boxRight - p0.x);
    const stats = computePositionStats(isLong ? 'long' : 'short', entryP, tpP, slP);

    const tpTop = Math.min(p0.y, tpHandle.y);
    const tpHeight = Math.max(10, Math.abs(tpHandle.y - p0.y));
    const slTop = Math.min(p0.y, slHandle.y);
    const slHeight = Math.max(10, Math.abs(slHandle.y - p0.y));

    const tpText =
      boxW >= 165
        ? `Target: ${formatPrice(stats.rewardPoints, symbolInfo.decimals)} (${stats.rewardPercent.toFixed(2)}%)`
        : `TP: ${formatPrice(stats.rewardPoints, symbolInfo.decimals)}`;
    const slText =
      boxW >= 165
        ? `Stop: ${formatPrice(stats.riskPoints, symbolInfo.decimals)} (${stats.riskPercent.toFixed(2)}%)`
        : `SL: ${formatPrice(stats.riskPoints, symbolInfo.decimals)}`;

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(8, 153, 129, 0.22)';
    ctx.fillRect(p0.x, tpTop, boxW, tpHeight);
    ctx.strokeStyle = '#089981';
    ctx.lineWidth = 1;
    ctx.strokeRect(p0.x, tpTop, boxW, tpHeight);

    ctx.fillStyle = 'rgba(242, 54, 69, 0.22)';
    ctx.fillRect(p0.x, slTop, boxW, slHeight);
    ctx.strokeStyle = '#f23645';
    ctx.strokeRect(p0.x, slTop, boxW, slHeight);

    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p0.x + boxW, p0.y);
    ctx.stroke();

    const tpLabelY = isLong ? tpTop + 4 : tpTop + tpHeight - 20;
    drawRoundedRect(ctx, p0.x + 4, tpLabelY, boxW - 8, 16, 2);
    ctx.fillStyle = '#089981';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9.5px monospace';
    ctx.fillText(tpText, p0.x + 8, tpLabelY + 11);

    drawRoundedRect(ctx, p0.x + boxW / 2 - 48, p0.y - 10, 96, 20, 3);
    ctx.fillStyle = '#131722';
    ctx.fill();
    ctx.strokeStyle = '#434651';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`R/R: ${stats.riskRewardRatio.toFixed(2)}`, p0.x + boxW / 2, p0.y + 4);
    ctx.textAlign = 'left';

    const slLabelY = isLong ? slTop + slHeight - 20 : slTop + 4;
    drawRoundedRect(ctx, p0.x + 4, slLabelY, boxW - 8, 16, 2);
    ctx.fillStyle = '#f23645';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9.5px monospace';
    ctx.fillText(slText, p0.x + 8, slLabelY + 11);

    if (showHandles) drawHandlesCanvas(ctx, [p0, tpHandle, slHandle], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 14. Fib Time Zones / Cycles
  if (d.tool === 'time-cycles') {
    const zones = computeFibTimeZones(d.points[0].t, d.points[1]?.t ?? d.points[0].t + 600);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 1.2;
    ctx.font = '700 10px monospace';
    for (const z of zones) {
      const c = toCoords(z.time, d.points[0].p);
      if (c.x === null) continue;
      ctx.beginPath();
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, maxH);
      ctx.stroke();
      ctx.fillText(String(z.fib), c.x + 3, 24);
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 15. Bars Pattern Projection
  if (d.tool === 'candle-pattern') {
    const bars =
      d.clonedBars && d.clonedBars.length > 0
        ? d.clonedBars
        : [
            { openOffset: 0, highOffset: 12, lowOffset: -4, closeOffset: 9 },
            { openOffset: 9, highOffset: 18, lowOffset: 5, closeOffset: 15 },
            { openOffset: 15, highOffset: 22, lowOffset: 11, closeOffset: 12 },
            { openOffset: 12, highOffset: 28, lowOffset: 10, closeOffset: 25 },
            { openOffset: 25, highOffset: 34, lowOffset: 20, closeOffset: 31 },
          ];
    const barW = Math.max(4, Math.min(12, rw / Math.max(bars.length, 4)));
    ctx.fillStyle = 'rgba(41, 98, 255, 0.05)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    for (let idx = 0; idx < bars.length; idx++) {
      const b = bars[idx];
      const bx = p0.x + idx * (barW + 2);
      const cO = toCoords(d.points[0].t, d.points[0].p + b.openOffset);
      const cC = toCoords(d.points[0].t, d.points[0].p + b.closeOffset);
      const cH = toCoords(d.points[0].t, d.points[0].p + b.highOffset);
      const cL = toCoords(d.points[0].t, d.points[0].p + b.lowOffset);
      if (cO.y === null || cC.y === null || cH.y === null || cL.y === null) continue;
      const bull = b.closeOffset >= b.openOffset;
      const col = bull ? 'rgba(8, 153, 129, 0.65)' : 'rgba(242, 54, 69, 0.65)';
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + barW / 2, cH.y);
      ctx.lineTo(bx + barW / 2, cL.y);
      ctx.stroke();
      ctx.fillRect(bx, Math.min(cO.y, cC.y), barW, Math.max(2, Math.abs(cC.y - cO.y)));
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 16. Multi-point Polyline / Wave Path / Elliott Impulse Wave / Freehand Brush & Highlighter
  const validPts = pixelPts.filter(
    (pt): pt is { x: number; y: number } => pt.x !== null && pt.y !== null
  );
  if (validPts.length >= 2) {
    const isHighlighter = d.tool === 'highlighter';
    const isElliott = d.tool === 'elliott-wave';

    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = isHighlighter ? 12 : strokeWidth;
    ctx.globalAlpha = isHighlighter ? 0.35 : ctx.globalAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);

    ctx.beginPath();
    ctx.moveTo(validPts[0].x, validPts[0].y);
    for (let i = 1; i < validPts.length; i++) {
      ctx.lineTo(validPts[i].x, validPts[i].y);
    }
    ctx.stroke();
    ctx.restore();

    if (isElliott) {
      for (let idx = 0; idx < validPts.length; idx++) {
        const pt = validPts[idx];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - 14, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#131722';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = d.color;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(idx === 0 ? '0' : String(idx), pt.x, pt.y - 10);
      }
    }

    if (showHandles) drawHandlesCanvas(ctx, validPts, isSelected, d.color);
    ctx.restore();
    return;
  }

  if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
  ctx.restore();
}

export class ChartOverlaysPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;

  private _state: ChartOverlaysState | null = null;
  private _livePreview: LiveDrawingPreviewState = {
    drawing: null,
    isGhost: false,
    snapPixel: null,
  };

  private readonly _bottomView: IPrimitivePaneView;
  private readonly _topView: IPrimitivePaneView;

  constructor() {
    this._bottomView = {
      zOrder: (): PrimitivePaneViewZOrder => 'bottom',
      renderer: (): IPrimitivePaneRenderer | null => {
        const state = this._state;
        const chart = this._chart;
        const series = this._series;
        if (!state || !chart || !series || state.candles.length === 0) return null;
        if (!state.ssmtVisible && !state.ivWallsVisible) return null;

        return {
          draw: (target) => {
            target.useMediaCoordinateSpace(({ context: ctx }) => {
              const ts = chart.timeScale();
              const toCoords = (t: number, p: number) => ({
                x: timeToChartX(ts, state.candles, state.candleIntervalSec, t),
                y: (() => {
                  const py = series.priceToCoordinate(p);
                  return py !== null ? Number(py) : null;
                })(),
              });

              if (state.ssmtVisible) {
                for (const zone of state.supplyDemandZones) {
                  const sIdx = Math.max(0, Math.min(state.candles.length - 1, zone.startTimeIndex));
                  const eIdx = Math.max(0, Math.min(state.candles.length - 1, zone.endTimeIndex));
                  const c1 = toCoords(state.candles[sIdx].time, zone.topPrice);
                  const c2 = toCoords(state.candles[eIdx].time, zone.bottomPrice);
                  if (c1.x === null || c1.y === null || c2.x === null || c2.y === null) continue;
                  const x = Math.min(c1.x, c2.x);
                  const y = Math.min(c1.y, c2.y);
                  const width = Math.max(12, Math.abs(c2.x - c1.x));
                  const height = Math.max(2, Math.abs(c2.y - c1.y));

                  ctx.save();
                  ctx.fillStyle = zone.color;
                  ctx.fillRect(x, y, width, height);
                  ctx.strokeStyle = zone.borderColor;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(x, y + height);
                  ctx.lineTo(x + width, y + height);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              if (state.ivWallsVisible && state.candles.length > 40 && state.ivWalls.length >= 6) {
                const leftBar = state.candles[Math.floor(state.candles.length * 0.25)];
                const midBar = state.candles[Math.floor(state.candles.length * 0.55)];
                const step1 = toCoords(leftBar.time, state.ivWalls[2].price);
                const step2 = toCoords(midBar.time, state.ivWalls[2].price);
                const lowStep1 = toCoords(state.candles[0].time, state.ivWalls[5].price);
                const lowStep2 = toCoords(leftBar.time, state.ivWalls[5].price);

                ctx.save();
                if (step1.x !== null && step2.x !== null && step1.y !== null) {
                  ctx.strokeStyle = state.isLight ? '#d1d4dc' : '#2a2e39';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(step1.x, step1.y);
                  ctx.lineTo(step2.x, step1.y);
                  ctx.stroke();
                }
                if (lowStep1.x !== null && lowStep2.x !== null && lowStep1.y !== null) {
                  ctx.strokeStyle = state.isLight ? '#e0e3eb' : '#2a2e39';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath();
                  ctx.moveTo(lowStep1.x, lowStep1.y);
                  ctx.lineTo(lowStep2.x, lowStep1.y);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });
          },
        };
      },
    };

    this._topView = {
      zOrder: (): PrimitivePaneViewZOrder => 'top',
      renderer: (): IPrimitivePaneRenderer | null => {
        const state = this._state;
        const chart = this._chart;
        const series = this._series;
        const preview = this._livePreview;
        if (!state || !chart || !series) return null;
        if (state.drawings.length === 0 && !preview.drawing && !preview.snapPixel) return null;

        return {
          draw: (target) => {
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
              const ts = chart.timeScale();
              const toCoords = (t: number, p: number) => ({
                x: timeToChartX(ts, state.candles, state.candleIntervalSec, t),
                y: (() => {
                  const py = series.priceToCoordinate(p);
                  return py !== null ? Number(py) : null;
                })(),
              });

              for (const d of state.drawings) {
                renderSingleDrawingCanvas(
                  ctx,
                  mediaSize.width,
                  mediaSize.height,
                  d,
                  state,
                  toCoords
                );
              }

              if (preview.drawing) {
                ctx.save();
                if (preview.isGhost) {
                  ctx.globalAlpha = 0.55;
                }
                renderSingleDrawingCanvas(
                  ctx,
                  mediaSize.width,
                  mediaSize.height,
                  preview.drawing,
                  state,
                  toCoords
                );
                ctx.restore();
              }

              if (preview.snapPixel) {
                const { x, y } = preview.snapPixel;
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(41, 98, 255, 0.16)';
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#2962ff';
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#2962ff';
                ctx.fill();
                ctx.restore();
              }
            });
          },
        };
      },
    };
  }

  public attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
    this._requestUpdate();
  }

  public detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  public paneViews(): readonly IPrimitivePaneView[] {
    return [this._bottomView, this._topView];
  }

  public setState(next: ChartOverlaysState): void {
    this._state = next;
    this._requestUpdate?.();
  }

  public setLivePreview(preview: LiveDrawingPreviewState): void {
    this._livePreview = preview;
    this._requestUpdate?.();
  }

  public clearLivePreview(): void {
    if (!this._livePreview.drawing && !this._livePreview.snapPixel) return;
    this._livePreview = { drawing: null, isGhost: false, snapPixel: null };
    this._requestUpdate?.();
  }
}
