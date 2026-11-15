import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CandleBar,
  INITIAL_SYMBOLS,
  formatPrice,
  parseTimeframeToSeconds,
  formatTimeframeHeaderLabel,
  buildCustomTimeframe,
  toHeikinAshiCandles,
  resampleCandles,
  resampleCandlesByTime,
  mergeTickIntoCandles,
  mergeCandleStreams,
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  calculateBollingerBands,
  getInstitutionalIVWalls,
  calculatePositionPnL,
  evaluateAlertTrigger,
  parseLseTimeToUnix,
  mapTimeframeToLse,
  filterCandlesBySession,
} from './marketEngine';
import { buildGexDashboardData } from './gexEngine';
import { OptionChainContract, OptionFlowPrint } from '../types/trading';

function makeTestCandles(count: number, startPrice: number = 25000): CandleBar[] {
  const baseTime = 1763000040; // aligned on minute
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
      volume: 100 + idx * 5,
    };
  });
}

test('formatPrice formats thousands and decimals accurately', () => {
  assert.equal(formatPrice(25042.75, 2), '25,042.75');
  assert.equal(formatPrice(47451, 0), '47,451');
  assert.equal(formatPrice(4120.5, 1), '4,120.5');
});

test('parseTimeframeToSeconds and formatTimeframeHeaderLabel handle standard and custom timeframes', () => {
  assert.equal(parseTimeframeToSeconds('1m'), 60);
  assert.equal(parseTimeframeToSeconds('15m'), 900);
  assert.equal(parseTimeframeToSeconds('4h'), 14400);
  assert.equal(parseTimeframeToSeconds('D'), 86400);
  assert.equal(parseTimeframeToSeconds('7m'), 420);
  assert.equal(formatTimeframeHeaderLabel('1m'), '1');
  assert.equal(formatTimeframeHeaderLabel('15m'), '15');
  assert.equal(formatTimeframeHeaderLabel('1h'), '60');
  assert.equal(formatTimeframeHeaderLabel('D'), 'D');
  assert.equal(buildCustomTimeframe(7, 'm'), '7m');
  assert.equal(buildCustomTimeframe(1, 'D'), 'D');
  assert.equal(buildCustomTimeframe(-5, 'm'), null);
});

test('parseLseTimeToUnix and mapTimeframeToLse convert LSE timestamps & timeframes cleanly', () => {
  assert.equal(
    parseLseTimeToUnix('2026-11-13 21:59:00'),
    Math.floor(Date.parse('2026-11-13T21:59:00Z') / 1000)
  );
  assert.equal(
    parseLseTimeToUnix('2026-11-15T08:36:58.029000000Z'),
    Math.floor(Date.parse('2026-11-15T08:36:58.029Z') / 1000)
  );

  const m7 = mapTimeframeToLse('7m');
  assert.equal(m7.lseTimeframe, '1m');
  assert.equal(m7.resampleMinutes, 7);

  const d1 = mapTimeframeToLse('D');
  assert.equal(d1.lseTimeframe, '1d');
  assert.equal(d1.resampleMinutes, 1);

  const m3 = mapTimeframeToLse('3M');
  assert.equal(m3.lseTimeframe, '1mo');
  assert.equal(m3.resampleMonths, 3);
});

test('mergeTickIntoCandles prevents REST-to-WS gap giant candles and handles stale/same-bucket ticks', () => {
  const t0 = Math.floor(Date.parse('2026-11-14T23:59:00Z') / 1000);
  const restBars: CandleBar[] = [
    { time: t0 - 60, open: 64120, high: 64160, low: 64100, close: 64145, volume: 12 },
    { time: t0, open: 64145, high: 64165, low: 64140, close: 64150, volume: 10 },
  ];

  // 1. Stale tick before last REST bar -> ignored
  const afterStale = mergeTickIntoCandles(restBars, 63999, t0 - 120, 5, 60);
  assert.equal(afterStale.length, 2);
  assert.equal(afterStale[1].close, 64150);

  // 2. Tick inside same bucket -> updates OHLCV in-place
  const afterSame = mergeTickIntoCandles(restBars, 64170, t0 + 18, 4, 60);
  assert.equal(afterSame.length, 2);
  assert.equal(afterSame[1].high, 64170);
  assert.equal(afterSame[1].close, 64170);
  assert.equal(afterSame[1].volume, 14);

  // 3. Adjacent minute tick (+60s, small move) -> opens smoothly from previous close
  const afterAdjacent = mergeTickIntoCandles(afterSame, 64175, t0 + 65, 2, 60);
  assert.equal(afterAdjacent.length, 3);
  assert.equal(afterAdjacent[2].open, 64170);
  assert.equal(afterAdjacent[2].close, 64175);

  // 4. Overnight / REST-to-WS gap (~9 hours later at 65,899) -> opens at real tick price, NOT giant 1,700-pt candle
  const tGap = Math.floor(Date.parse('2026-11-15T09:15:08Z') / 1000);
  const afterGap = mergeTickIntoCandles(restBars, 65899.35, tGap, 1.5, 60);
  assert.equal(afterGap.length, 3);
  assert.equal(afterGap[2].time, Math.floor(tGap / 60) * 60);
  assert.equal(afterGap[2].open, 65899.35);
  assert.equal(afterGap[2].high, 65899.35);
  assert.equal(afterGap[2].low, 65899.35);
  assert.equal(afterGap[2].close, 65899.35);
});

test('resampleCandlesByTime and mergeCandleStreams align UTC buckets cleanly without overlap', () => {
  const base = Math.floor(Date.parse('2026-11-14T10:00:00Z') / 1000);
  const oneMinBars: CandleBar[] = Array.from({ length: 10 }, (_, idx) => ({
    time: base + idx * 60,
    open: 100 + idx,
    high: 105 + idx,
    low: 95 + idx,
    close: 101 + idx,
    volume: 10,
  }));

  const fiveMin = resampleCandlesByTime(oneMinBars, 300);
  assert.equal(fiveMin.length, 2);
  assert.equal(fiveMin[0].time, base);
  assert.equal(fiveMin[0].open, 100);
  assert.equal(fiveMin[0].close, 105);
  assert.equal(fiveMin[0].volume, 50);

  const liveTail: CandleBar[] = [
    { time: base + 240, open: 104, high: 109, low: 99, close: 105, volume: 10 },
    { time: base + 600, open: 112, high: 115, low: 111, close: 114, volume: 7 },
  ];
  const merged = mergeCandleStreams(oneMinBars, liveTail);
  assert.equal(merged.length, 11);
  assert.equal(merged[merged.length - 1].time, base + 600);
});

test('filterCandlesBySession retains RTH window (14:30-21:00 UTC) for intraday candles', () => {
  const rthBase = Math.floor(Date.parse('2026-11-13T14:00:00Z') / 1000);
  const bars = Array.from({ length: 30 }, (_, idx) => ({
    time: rthBase + idx * 1800, // 30-min bars from 14:00 UTC across RTH + ETH
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
  }));
  const eth = filterCandlesBySession(bars, 'ETH');
  assert.equal(eth.length, 30);
  const rth = filterCandlesBySession(bars, 'RTH');
  assert.ok(rth.length < bars.length);
  for (const b of rth) {
    const d = new Date(b.time * 1000);
    const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
    assert.ok(mins >= 14 * 60 + 30 && mins <= 21 * 60);
  }
});

test('toHeikinAshiCandles and resampleCandles preserve valid OHLC invariants', () => {
  const raw = makeTestCandles(30, 25000);
  const ha = toHeikinAshiCandles(raw);
  assert.equal(ha.length, 30);
  for (const bar of ha) {
    assert.ok(bar.high >= Math.max(bar.open, bar.close));
    assert.ok(bar.low <= Math.min(bar.open, bar.close));
  }

  const resampled = resampleCandles(raw, 5);
  assert.equal(resampled.length, 6);
  assert.equal(resampled[0].open, raw[0].open);
  assert.equal(resampled[0].close, raw[4].close);
});

test('technical indicators (SMA, EMA, VWAP, Bollinger Bands) and dynamic IV walls return valid series', () => {
  const nq = INITIAL_SYMBOLS.find((s) => s.symbol === 'NASDAQ100')!;
  const candles = makeTestCandles(50, 25000);
  const sma20 = calculateSMA(candles, 20);
  const ema20 = calculateEMA(candles, 20);
  const vwap = calculateVWAP(candles);
  const bb = calculateBollingerBands(candles, 20, 2);

  assert.equal(sma20.length, 31);
  assert.equal(ema20.length, 31);
  assert.equal(vwap.length, 50);
  assert.equal(bb.middle.length, 31);
  assert.ok(bb.upper[0].value > bb.middle[0].value);
  assert.ok(bb.lower[0].value < bb.middle[0].value);

  // Without real candles, IV walls return empty (no synthetic placeholder prices)
  assert.deepEqual(getInstitutionalIVWalls(nq), []);
  assert.deepEqual(getInstitutionalIVWalls(nq, candles.slice(0, 10)), []);

  const dynamicWalls = getInstitutionalIVWalls(nq, candles);
  assert.equal(dynamicWalls.length, 7);
  assert.ok(dynamicWalls[1].price > dynamicWalls[5].price);
});

test('calculatePositionPnL and evaluateAlertTrigger compute accurately', () => {
  const pnl = calculatePositionPnL(
    {
      id: 'pos-1',
      symbol: 'NASDAQ100',
      side: 'BUY',
      qty: 2,
      entryPrice: 25000.00,
      timestamp: '01:25:00',
    },
    25010.00
  );
  assert.equal(pnl.pointsDiff, 10);
  assert.equal(pnl.dollarPnL, 400);

  const triggered = evaluateAlertTrigger(
    {
      id: 'al-1',
      symbol: 'NASDAQ100',
      condition: 'Crossing Up',
      targetPrice: 25010.00,
      note: 'Breakout',
      active: true,
      triggered: false,
      createdAt: '01:00:00',
    },
    25004.00,
    25011.25
  );
  assert.equal(triggered, true);
});

test('mergeCandleStreams stitches yesterday export + today intraday vault + live WS with zero gap', () => {
  const dayEnd = Math.floor(Date.parse('2026-11-14T23:58:00Z') / 1000);
  const archiveExport: CandleBar[] = [
    { time: dayEnd, open: 64199, high: 64200, low: 64160, close: 64178, volume: 964000000 },
    { time: dayEnd + 60, open: 64178, high: 64180, low: 64146, close: 64150, volume: 958000000 },
  ];
  const vaultIntraday: CandleBar[] = [
    { time: dayEnd + 60, open: 64178, high: 64181, low: 64146, close: 64150.02, volume: 8.2 },
    { time: dayEnd + 120, open: 64150.02, high: 64155, low: 64098, close: 64110.77, volume: 6.8 },
    { time: dayEnd + 180, open: 64110.77, high: 64138, low: 64072, close: 64084.01, volume: 6.9 },
  ];
  const wsLive: CandleBar[] = [
    { time: dayEnd + 180, open: 64110.77, high: 64142, low: 64072, close: 64120.5, volume: 1.4 },
    { time: dayEnd + 240, open: 64120.5, high: 64130, low: 64115, close: 64125.0, volume: 0.9 },
  ];

  const withVault = mergeCandleStreams(archiveExport, vaultIntraday);
  const stitched = mergeCandleStreams(withVault, wsLive);
  assert.equal(stitched.length, 5);
  for (let i = 1; i < stitched.length; i++) {
    assert.equal(stitched[i].time - stitched[i - 1].time, 60);
  }
  assert.equal(stitched[stitched.length - 1].close, 64125.0);
});

test('mapTimeframeToLse and resampleCandlesByTime support native and custom seconds intervals', () => {
  assert.equal(parseTimeframeToSeconds('1s'), 1);
  assert.equal(parseTimeframeToSeconds('5s'), 5);
  assert.equal(parseTimeframeToSeconds('10s'), 10);
  assert.equal(parseTimeframeToSeconds('45s'), 45);

  const s1 = mapTimeframeToLse('1s');
  assert.equal(s1.lseTimeframe, '1s');
  assert.equal(s1.bucketSeconds, 1);

  const s5 = mapTimeframeToLse('5s');
  assert.equal(s5.lseTimeframe, '5s');
  assert.equal(s5.bucketSeconds, 5);

  const s10 = mapTimeframeToLse('10s');
  assert.equal(s10.lseTimeframe, '5s');
  assert.equal(s10.bucketSeconds, 10);

  const s45 = mapTimeframeToLse('45s');
  assert.equal(s45.lseTimeframe, '15s');
  assert.equal(s45.bucketSeconds, 45);

  const base = Math.floor(Date.parse('2026-11-15T12:00:00Z') / 1000);
  const fiveSecBars: CandleBar[] = [
    { time: base, open: 100, high: 102, low: 99, close: 101, volume: 3 },
    { time: base + 5, open: 101, high: 103, low: 100, close: 102.5, volume: 4 },
    { time: base + 10, open: 102.5, high: 104, low: 102, close: 103, volume: 5 },
    { time: base + 15, open: 103, high: 103.5, low: 101.5, close: 102, volume: 2 },
  ];
  const tenSecBars = resampleCandlesByTime(fiveSecBars, 10);
  assert.equal(tenSecBars.length, 2);
  assert.equal(tenSecBars[0].open, 100);
  assert.equal(tenSecBars[0].high, 103);
  assert.equal(tenSecBars[0].close, 102.5);
  assert.equal(tenSecBars[0].volume, 7);
});

test('buildGexDashboardData computes Call Wall, Put Wall, Zero Gamma Flip, and orderflow buckets', () => {
  const contracts: OptionChainContract[] = [
    {
      ticker: 'O:SPY261116C00600000',
      occSymbol: 'O:SPY261116C00600000',
      underlying: 'SPY',
      contract_type: 'call',
      strike: 600,
      expiry: '2026-11-16',
      dte: 0,
      last_price: 2.1,
      volume_today: 18500,
      premium_today: 3885000,
      iv: 0.16,
      delta: 0.42,
      gamma: 0.048,
      theta: -0.35,
      vega: 0.09,
      rho: 0.02,
      underlying_price: 595,
      last_trade_at: '2026-11-16T14:35:00Z',
      updated_at: '2026-11-16T14:35:00Z',
    },
    {
      ticker: 'O:SPY261116P00590000',
      occSymbol: 'O:SPY261116P00590000',
      underlying: 'SPY',
      contract_type: 'put',
      strike: 590,
      expiry: '2026-11-16',
      dte: 0,
      last_price: 1.95,
      volume_today: 16200,
      premium_today: 3159000,
      iv: 0.19,
      delta: -0.38,
      gamma: 0.044,
      theta: -0.31,
      vega: 0.08,
      rho: -0.02,
      underlying_price: 595,
      last_trade_at: '2026-11-16T14:35:00Z',
      updated_at: '2026-11-16T14:35:00Z',
    },
  ];

  const prints: OptionFlowPrint[] = [
    {
      id: 'fl-1',
      ticker: 'O:SPY261116C00600000',
      occSymbol: 'O:SPY261116C00600000',
      underlying: 'SPY',
      contract_type: 'call',
      strike: 600,
      expiry: '2026-11-16',
      dte: 0,
      last_price: 2.1,
      volume: 250,
      premium: 52500,
      iv: 0.16,
      delta: 0.42,
      gamma: 0.048,
      theta: -0.35,
      vega: 0.09,
      rho: 0.02,
      underlying_price: 595.2,
      ts: '2026-11-16T14:35:00Z',
    },
    {
      id: 'fl-2',
      ticker: 'O:SPY261116P00590000',
      occSymbol: 'O:SPY261116P00590000',
      underlying: 'SPY',
      contract_type: 'put',
      strike: 590,
      expiry: '2026-11-16',
      dte: 0,
      last_price: 1.95,
      volume: 120,
      premium: 23400,
      iv: 0.19,
      delta: -0.38,
      gamma: 0.044,
      theta: -0.31,
      vega: 0.08,
      rho: -0.02,
      underlying_price: 594.9,
      ts: '2026-11-16T14:40:00Z',
    },
  ];

  const gex = buildGexDashboardData({
    underlying: 'SPY',
    selectedExpiry: '2026-11-16',
    selectedDte: 0,
    expiries: [{ expiry: '2026-11-16', dte: 0 }],
    chainContracts: contracts,
    flowPrints: prints,
    flowScope: '0dte',
  });

  assert.equal(gex.underlying, 'SPY');
  assert.equal(gex.spotPrice, 595);
  assert.equal(gex.metrics.callWall, 600);
  assert.equal(gex.metrics.putWall, 590);
  assert.ok(gex.metrics.zeroGammaFlip !== null && gex.metrics.zeroGammaFlip > 588 && gex.metrics.zeroGammaFlip < 602);
  assert.equal(gex.gexCurve.length, 41);
  assert.equal(gex.flowBuckets.length, 2);
  assert.equal(gex.metrics.netFlowPremium, 52500 - 23400);
});

