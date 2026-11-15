import test from 'node:test';
import assert from 'node:assert/strict';
import { CandleBar, INITIAL_SYMBOLS } from './marketEngine';
import {
  getToolPointMode,
  snapPriceToCandle,
  computeVolumeProfile,
  computeFibLevels,
  computeFibTimeZones,
  computePositionStats,
  computeMeasureStats,
  hitTestDrawings,
  translateDrawing,
  moveDrawingHandle,
  createDrawingFromPoints,
} from './drawingEngine';

function makeTestCandles(count: number, startPrice: number = 25000): CandleBar[] {
  const baseTime = 1763000040;
  return Array.from({ length: count }, (_, idx) => {
    const open = startPrice + idx * 1.5;
    const close = open + (idx % 2 === 0 ? 2 : -1);
    const high = Math.max(open, close) + 1.25;
    const low = Math.min(open, close) - 1.25;
    return {
      time: baseTime + idx * 60,
      open,
      high,
      low,
      close,
      volume: 150 + idx * 10,
    };
  });
}

test('getToolPointMode categorizes 1-point, 2-point, 3-point, multi, and freehand tools', () => {
  assert.equal(getToolPointMode('horizontal-line'), 1);
  assert.equal(getToolPointMode('long-position'), 1);
  assert.equal(getToolPointMode('trend-line'), 2);
  assert.equal(getToolPointMode('pitchfork'), 3);
  assert.equal(getToolPointMode('wave-path'), 'multi');
  assert.equal(getToolPointMode('brush'), 'freehand');
});

test('snapPriceToCandle snaps to nearest OHLC when magnet is enabled', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(40, 25000);
  const last = candles[candles.length - 1];
  const snapped = snapPriceToCandle(candles, last.time, last.high + 0.1, true, nq.tickSize, nq.decimals);
  assert.equal(snapped, last.high);

  const unsnapped = snapPriceToCandle(candles, last.time, 25050.12, false, nq.tickSize, nq.decimals);
  assert.equal(unsnapped, 25050.00);
});

test('computeVolumeProfile aggregates real candle volume and finds POC', () => {
  const candles = makeTestCandles(60, 25000);
  const t1 = candles[10].time;
  const t2 = candles[40].time;
  const low = Math.min(...candles.slice(10, 41).map((c) => c.low));
  const high = Math.max(...candles.slice(10, 41).map((c) => c.high));

  const profile = computeVolumeProfile(candles, t1, t2, low, high, 10);
  assert.equal(profile.rows.length, 10);
  assert.ok(profile.totalVolume > 0);
  assert.equal(profile.rows.filter((r) => r.isPOC).length, 1);
  assert.ok(profile.pocPrice >= low && profile.pocPrice <= high);
});

test('computeFibLevels and computeFibTimeZones calculate accurate ratios', () => {
  const levels = computeFibLevels(25400, 25300, [0, 0.5, 1]);
  assert.equal(levels[0].price, 25300);
  assert.equal(levels[1].price, 25350);
  assert.equal(levels[2].price, 25400);

  const zones = computeFibTimeZones(1000, 1060, [0, 1, 2, 3, 5]);
  assert.deepEqual(
    zones.map((z) => z.time),
    [1000, 1060, 1120, 1180, 1300]
  );
});

test('computePositionStats calculates R:R ratio accurately for Long and Short', () => {
  const longStats = computePositionStats('long', 25300, 25360, 25280);
  assert.equal(longStats.rewardPoints, 60);
  assert.equal(longStats.riskPoints, 20);
  assert.equal(longStats.riskRewardRatio, 3);

  const shortStats = computePositionStats('short', 25300, 25240, 25330);
  assert.equal(shortStats.rewardPoints, 60);
  assert.equal(shortStats.riskPoints, 30);
  assert.equal(shortStats.riskRewardRatio, 2);
});

test('hitTestDrawings, translateDrawing, and moveDrawingHandle operate accurately', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const drawing = createDrawingFromPoints(
    'trend-line',
    'NASDAQ100',
    [
      { t: 100, p: 25300 },
      { t: 200, p: 25350 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );

  // Simple identity mapper for testing
  const toCoords = (t: number, p: number) => ({ x: t, y: 25400 - p });

  // Handle 0 hit at (100, 100)
  const h0 = hitTestDrawings([drawing], 101, 99, toCoords);
  assert.deepEqual(h0, { drawingId: drawing.id, handleIndex: 0 });

  // Body hit along midpoint (150, 75)
  const body = hitTestDrawings([drawing], 150, 75, toCoords);
  assert.deepEqual(body, { drawingId: drawing.id, handleIndex: null });

  // Miss far away
  const miss = hitTestDrawings([drawing], 500, 500, toCoords);
  assert.equal(miss, null);

  // Translate drawing
  const moved = translateDrawing(drawing, 60, 10);
  assert.equal(moved.t1, 160);
  assert.equal(moved.p1, 25310);
  assert.equal(moved.t2, 260);
  assert.equal(moved.p2, 25360);

  // Move single handle
  const reshaped = moveDrawingHandle(moved, 1, { t: 300, p: 25400 });
  assert.equal(reshaped.t2, 300);
  assert.equal(reshaped.p2, 25400);

  // Measure stats
  const m = computeMeasureStats(candles, candles[0].time, 25300, candles[9].time, 25350);
  assert.equal(m.barsCount, 10);
  assert.equal(m.priceDiff, 50);
});

test('right future whitespace does not snap Y to historical bar and keeps right-extending points valid', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const last = candles[candles.length - 1];
  const futureTime = last.time + 60 * 10; // 10 bars to the right of last bar

  // Magnet should NOT snap back to historical candle when >1.5 bars into right future margin
  const freePrice = snapPriceToCandle(candles, futureTime, 25200.25, true, nq.tickSize, nq.decimals);
  assert.equal(freePrice, 25200.25);

  const pos = createDrawingFromPoints(
    'long-position',
    'NASDAQ100',
    [{ t: last.time, p: last.close }],
    candles,
    nq.tickSize,
    nq.decimals
  );
  assert.ok(pos.points[1].t > pos.points[0].t, 'Long position target handle extends right of entry');
  assert.ok(pos.points[2].t > pos.points[0].t, 'Long position stop handle extends right of entry');
  assert.ok(pos.points[0].t > 0 && pos.points[1].t > 0, 'Timestamps are positive and never zero');
});

