import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_SYMBOLS,
  formatPrice,
  parseTimeframeToSeconds,
  formatTimeframeHeaderLabel,
  buildCustomTimeframe,
  generateHistoricalCandles,
  toHeikinAshiCandles,
  resampleCandles,
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  getInstitutionalIVWalls,
  calculatePositionPnL,
  evaluateAlertTrigger,
} from './marketEngine';

test('formatPrice formats thousands and decimals accurately', () => {
  assert.equal(formatPrice(28304, 2), '28,304.00');
  assert.equal(formatPrice(52342, 0), '52,342');
  assert.equal(formatPrice(3898.3, 1), '3,898.3');
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

test('generateHistoricalCandles ends on exact NQ1! reference bar from screenshot', () => {
  const nq = INITIAL_SYMBOLS.find((s) => s.symbol === 'NQ1!')!;
  const candles = generateHistoricalCandles(nq, '1m', 120);
  assert.equal(candles.length, 120);
  const last = candles[candles.length - 1];
  assert.equal(last.open, 28306.00);
  assert.equal(last.high, 28309.25);
  assert.equal(last.low, 28298.00);
  assert.equal(last.close, 28304.00);
});

test('toHeikinAshiCandles and resampleCandles preserve valid OHLC invariants', () => {
  const nq = INITIAL_SYMBOLS[0];
  const raw = generateHistoricalCandles(nq, '1m', 30);
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

test('technical indicators (SMA, EMA, VWAP) and IV walls return valid series', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = generateHistoricalCandles(nq, '1m', 50);
  const sma20 = calculateSMA(candles, 20);
  const ema20 = calculateEMA(candles, 20);
  const vwap = calculateVWAP(candles);

  assert.equal(sma20.length, 31);
  assert.equal(ema20.length, 31);
  assert.equal(vwap.length, 50);

  const walls = getInstitutionalIVWalls(nq);
  assert.equal(walls.length, 7);
  assert.equal(walls[0].price, 28399.25);
  assert.equal(walls[1].price, 28365.56);
});

test('calculatePositionPnL and evaluateAlertTrigger compute accurately', () => {
  const pnl = calculatePositionPnL(
    {
      id: 'pos-1',
      symbol: 'NQ1!',
      side: 'BUY',
      qty: 2,
      entryPrice: 28300.00,
      timestamp: '01:25:00',
    },
    28310.00
  );
  assert.equal(pnl.pointsDiff, 10);
  assert.equal(pnl.dollarPnL, 400);

  const triggered = evaluateAlertTrigger(
    {
      id: 'al-1',
      symbol: 'NQ1!',
      condition: 'Crossing Up',
      targetPrice: 28310.00,
      note: 'Breakout',
      active: true,
      triggered: false,
      createdAt: '01:00:00',
    },
    28304.00,
    28311.25
  );
  assert.equal(triggered, true);
});
