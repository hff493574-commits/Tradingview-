export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  type: 'Futures' | 'Stock' | 'Crypto' | 'Forex' | 'Index';
  contractCode: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  spread: number;
  tickSize: number;
  decimals: number;
  badgeText: string;
  badgeBg: string;
  badgeColor?: string;
  flagColor?: 'red' | 'orange' | 'blue' | 'green' | null;
  volume24h: number;
  openInterest?: string;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
}

export interface CandleBar {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IVWallLevel {
  id: string;
  price: number;
  label: string;
  sigma: string;
  color: string;
  bgColor: string;
  textColor: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  category: 'pivot' | 'upper_1sigma' | 'lower_1sigma' | 'custom';
}

export interface SupplyDemandZone {
  id: string;
  startTimeIndex: number; // Index relative to candle array or unix timestamp
  endTimeIndex: number;   // Index relative to candle array (-1 means extends to right edge)
  topPrice: number;
  bottomPrice: number;
  color: string;
  borderColor: string;
  label?: string;
}

export interface NewsItem {
  id: string;
  symbol: string;
  source: string;
  timeAgo: string;
  headline: string;
  summary: string;
  sentiment: 'bearish' | 'bullish' | 'neutral';
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'Crossing' | 'Crossing Up' | 'Crossing Down' | 'Greater Than' | 'Less Than';
  targetPrice: number;
  note: string;
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface TradePosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: string;
}

export interface ForwardCurvePoint {
  contract: string;
  monthLabel: string;
  price: number;
}

export const INITIAL_SYMBOLS: SymbolInfo[] = [
  {
    symbol: 'NQ1!',
    name: 'NASDAQ 100 E-mini Futures',
    exchange: 'CME',
    type: 'Futures',
    contractCode: 'NQZ2026',
    currency: 'USD',
    price: 28304.00,
    change: -80.50,
    changePercent: -0.28,
    bid: 28303.75,
    ask: 28304.50,
    spread: 0.75,
    tickSize: 0.25,
    decimals: 2,
    badgeText: '100',
    badgeBg: '#0097a7',
    flagColor: 'red',
    volume24h: 342890,
    openInterest: '284.1K',
    dayHigh: 28492.50,
    dayLow: 28261.25,
    dayOpen: 28384.50,
  },
  {
    symbol: 'YM1!',
    name: 'Dow Jones E-mini Futures',
    exchange: 'CBOT',
    type: 'Futures',
    contractCode: 'YMZ2026',
    currency: 'USD',
    price: 52342,
    change: -48,
    changePercent: -0.09,
    bid: 52341,
    ask: 52343,
    spread: 2,
    tickSize: 1,
    decimals: 0,
    badgeText: '30',
    badgeBg: '#00acc1',
    flagColor: 'red',
    volume24h: 128450,
    openInterest: '112.4K',
    dayHigh: 52480,
    dayLow: 52210,
    dayOpen: 52390,
  },
  {
    symbol: 'ES1!',
    name: 'S&P 500 E-mini Futures',
    exchange: 'CME',
    type: 'Futures',
    contractCode: 'ESZ2026',
    currency: 'USD',
    price: 7606.50,
    change: -8.75,
    changePercent: -0.11,
    bid: 7606.25,
    ask: 7606.75,
    spread: 0.50,
    tickSize: 0.25,
    decimals: 2,
    badgeText: '500',
    badgeBg: '#e53935',
    flagColor: 'red',
    volume24h: 894120,
    openInterest: '1.82M',
    dayHigh: 7634.00,
    dayLow: 7588.25,
    dayOpen: 7615.25,
  },
  {
    symbol: 'GC1!',
    name: 'Gold Futures',
    exchange: 'COMEX',
    type: 'Futures',
    contractCode: 'GCZ2026',
    currency: 'USD',
    price: 3898.3,
    change: 13.0,
    changePercent: 0.33,
    bid: 3898.1,
    ask: 3898.5,
    spread: 0.4,
    tickSize: 0.1,
    decimals: 1,
    badgeText: 'GC',
    badgeBg: '#fbc02d',
    badgeColor: '#131722',
    flagColor: 'orange',
    volume24h: 215600,
    openInterest: '495.2K',
    dayHigh: 3912.4,
    dayLow: 3879.0,
    dayOpen: 3885.3,
  },
  {
    symbol: 'CL1!',
    name: 'Light Sweet Crude Oil Futures',
    exchange: 'NYMEX',
    type: 'Futures',
    contractCode: 'CLZ2026',
    currency: 'USD',
    price: 71.45,
    change: 0.82,
    changePercent: 1.16,
    bid: 71.44,
    ask: 71.46,
    spread: 0.02,
    tickSize: 0.01,
    decimals: 2,
    badgeText: 'CL',
    badgeBg: '#ff8f00',
    flagColor: null,
    volume24h: 412300,
    openInterest: '1.31M',
    dayHigh: 72.10,
    dayLow: 70.35,
    dayOpen: 70.63,
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / U.S. Dollar',
    exchange: 'COINBASE',
    type: 'Crypto',
    contractCode: 'SPOT',
    currency: 'USD',
    price: 98420.00,
    change: 1450.00,
    changePercent: 1.49,
    bid: 98418.50,
    ask: 98421.50,
    spread: 3.00,
    tickSize: 0.50,
    decimals: 2,
    badgeText: '₿',
    badgeBg: '#f7931a',
    flagColor: 'blue',
    volume24h: 48920,
    dayHigh: 99150.00,
    dayLow: 96580.00,
    dayOpen: 96970.00,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    type: 'Stock',
    contractCode: 'EQ',
    currency: 'USD',
    price: 164.80,
    change: -2.15,
    changePercent: -1.29,
    bid: 164.78,
    ask: 164.82,
    spread: 0.04,
    tickSize: 0.01,
    decimals: 2,
    badgeText: 'NV',
    badgeBg: '#76b900',
    flagColor: null,
    volume24h: 64120000,
    dayHigh: 168.40,
    dayLow: 163.50,
    dayOpen: 166.95,
  },
  {
    symbol: 'EURUSD',
    name: 'Euro / U.S. Dollar',
    exchange: 'CME',
    type: 'Forex',
    contractCode: '6EZ2026',
    currency: 'USD',
    price: 1.0842,
    change: 0.0018,
    changePercent: 0.17,
    bid: 1.0841,
    ask: 1.0843,
    spread: 0.0002,
    tickSize: 0.0001,
    decimals: 4,
    badgeText: 'EU',
    badgeBg: '#3949ab',
    flagColor: null,
    volume24h: 195400,
    dayHigh: 1.0868,
    dayLow: 1.0815,
    dayOpen: 1.0824,
  },
];

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    symbol: 'NQ1!',
    source: 'Reuters · MarketWatch',
    timeAgo: '2 hours ago',
    headline: 'Burry doubles down on Nasdaq 100 puts, increases bearish SMH position amid Nvidia leadership turmoil',
    summary: 'Institutional 13F filings reveal Scion Asset Management expanded its downside hedge on Nasdaq-100 futures and semiconductor ETFs heading into Q4 expiration.',
    sentiment: 'bearish',
  },
  {
    id: 'news-2',
    symbol: 'ES1!',
    source: 'Bloomberg',
    timeAgo: '3 hours ago',
    headline: 'CME E-mini S&P 500 overnight liquidity concentrates near 7,600 gamma wall ahead of CPI print',
    summary: 'Dealer gamma positioning shows strong institutional support at the 1-sigma lower volatility boundary with overnight volume tracking 18% above 30-day average.',
    sentiment: 'neutral',
  },
  {
    id: 'news-3',
    symbol: 'GC1!',
    source: 'Dow Jones Newswires',
    timeAgo: '4 hours ago',
    headline: 'COMEX Gold futures test $3,900/oz as central bank physical allocations accelerate in Asian session',
    summary: 'Spot and December COMEX gold futures rose 0.33% during electronic trading hours as sovereign buyers stepped in on dips.',
    sentiment: 'bullish',
  },
  {
    id: 'news-4',
    symbol: 'YM1!',
    source: 'Financial Times',
    timeAgo: '5 hours ago',
    headline: 'Industrial & financial rotation steadies Dow futures near 52,340 despite tech pullback',
    summary: 'Blue-chip industrials outperformed high-multiple growth names as Treasury yields stabilized at the long end of the curve.',
    sentiment: 'neutral',
  },
];

/**
 * Formats a numeric price according to symbol decimals with thousands separators
 */
export function formatPrice(price: number, decimals: number = 2): string {
  if (!Number.isFinite(price)) return '0.00';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parses a timeframe string (e.g., '1m', '5m', '1h', '4h', 'D', 'W', 'M', '7m', '15s')
 * into duration in seconds.
 */
export function parseTimeframeToSeconds(tf: string): number {
  const clean = tf.trim();
  if (!clean) return 60;

  if (clean === 'D' || clean === '1D') return 86400;
  if (clean === 'W' || clean === '1W') return 86400 * 7;
  if (clean === 'M' || clean === '1M') return 86400 * 30;
  if (clean === '3M') return 86400 * 90;
  if (clean === '6M') return 86400 * 180;
  if (clean === '12M' || clean === '1Y') return 86400 * 365;

  const match = clean.match(/^(\d+)\s*([smhdwMyT])$/);
  if (!match) {
    const numOnly = parseInt(clean, 10);
    return Number.isFinite(numOnly) && numOnly > 0 ? numOnly * 60 : 60;
  }

  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
    case 'T':
      return Math.max(1, val);
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    case 'w':
      return val * 86400 * 7;
    case 'M':
      return val * 86400 * 30;
    case 'y':
      return val * 86400 * 365;
    default:
      return 60;
  }
}

/**
 * Converts a timeframe toolbar code ('1m', '15m', '1h', 'D') into the TradingView chart title token ('1', '15', '60', '1D')
 */
export function formatTimeframeHeaderLabel(tf: string): string {
  const clean = tf.trim();
  if (clean.endsWith('m')) {
    return clean.slice(0, -1);
  }
  if (clean === '1h') return '60';
  if (clean === '2h') return '120';
  if (clean === '4h') return '240';
  return clean;
}

/**
 * Validates and normalizes a user-created custom timeframe string (e.g. value=7, unit='m' -> '7m')
 */
export function buildCustomTimeframe(value: number, unit: 's' | 'm' | 'h' | 'D' | 'W' | 'M'): string | null {
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return null;
  const intVal = Math.floor(value);
  if (unit === 'D' && intVal === 1) return 'D';
  if (unit === 'W' && intVal === 1) return 'W';
  if (unit === 'M' && intVal === 1) return 'M';
  return `${intVal}${unit}`;
}

/**
 * Deterministic PRNG for reproducible realistic market series
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates realistic 1-minute historical candles matching Screenshot 1's exact price trajectory for NQ1!
 * and proportional trajectories for other symbols.
 */
export function generateHistoricalCandles(
  symbolInfo: SymbolInfo,
  timeframe: string = '1m',
  barCount: number = 330
): CandleBar[] {
  const intervalSec = parseTimeframeToSeconds(timeframe);
  // Base end timestamp aligned to 01:30:00 AM UTC-5 on the 13th (matching Screenshot 1: "13  12:30 AM  01:00 AM  01:30 AM")
  // 2026-11-13 01:30:00 UTC (renders as 01:30 AM on lightweight-charts time axis)
  const endTimestamp = 1794533400;
  const startTimestamp = endTimestamp - (barCount - 1) * intervalSec;

  // Normalized keyframe trajectory (from t=0.0 to t=1.0) modeled directly on Screenshot 1:
  // Keeps early bars (t=0..0.24) high above 28,480 so the top-left legend has clean white space beneath it,
  // drops through 28,400 around t=0.28, forms the mid-session swing around 28,325-28,385,
  // dips to 28,262 around 01:00 AM (t=0.86), and rallies to 28,304.00 at 01:30 AM (t=1.00).
  const keyframes: Array<[number, number]> = [
    [0.00, 225],
    [0.12, 215],
    [0.20, 195],
    [0.24, 165],
    [0.29, 108],
    [0.34, 78],
    [0.38, 92],
    [0.43, 16],
    [0.47, 50],
    [0.52, 74],
    [0.57, 42],
    [0.62, 82],
    [0.67, 48],
    [0.72, 24],
    [0.77, 14],
    [0.82, -14],
    [0.86, -42],
    [0.90, -36],
    [0.94, 4],
    [0.97, -2],
    [1.00, 0],
  ];

  // Scale factor relative to NQ1! (where 1 unit = 1 point around 28,304)
  const scaleRatio = (symbolInfo.price * 0.007) / 198;
  const seed = symbolInfo.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 1337);
  const rand = mulberry32(seed + intervalSec);

  const interpolateOffset = (progress: number): number => {
    for (let i = 0; i < keyframes.length - 1; i++) {
      const [t0, v0] = keyframes[i];
      const [t1, v1] = keyframes[i + 1];
      if (progress >= t0 && progress <= t1) {
        const localT = (progress - t0) / (t1 - t0);
        return v0 + (v1 - v0) * localT;
      }
    }
    return 0;
  };

  const candles: CandleBar[] = [];
  let prevClose = symbolInfo.price + interpolateOffset(0) * scaleRatio;

  for (let i = 0; i < barCount; i++) {
    const progress = i / (barCount - 1);
    const time = startTimestamp + i * intervalSec;
    const targetPrice = symbolInfo.price + interpolateOffset(progress) * scaleRatio;
    const noise = (rand() - 0.495) * 14 * scaleRatio;

    const open = roundToTick(prevClose, symbolInfo.tickSize, symbolInfo.decimals);
    let close = roundToTick(targetPrice + noise, symbolInfo.tickSize, symbolInfo.decimals);

    // Ensure the final two candles match Screenshot 1's exact header readout for NQ1!:
    // O28,306.00 H28,309.25 L28,298.00 C28,304.00 -3.00 (-0.01%)
    if (i === barCount - 1) {
      if (symbolInfo.symbol === 'NQ1!') {
        const finalOpen = 28306.00;
        const finalHigh = 28309.25;
        const finalLow = 28298.00;
        const finalClose = 28304.00;
        candles.push({
          time,
          open: finalOpen,
          high: finalHigh,
          low: finalLow,
          close: finalClose,
          volume: 1840,
        });
        break;
      } else {
        close = symbolInfo.price;
      }
    }

    const bodyMax = Math.max(open, close);
    const bodyMin = Math.min(open, close);
    const upperWick = (rand() * 11 + 2) * scaleRatio;
    const lowerWick = (rand() * 11 + 2) * scaleRatio;

    const high = roundToTick(bodyMax + upperWick, symbolInfo.tickSize, symbolInfo.decimals);
    const low = roundToTick(Math.max(symbolInfo.tickSize, bodyMin - lowerWick), symbolInfo.tickSize, symbolInfo.decimals);
    const volume = Math.floor(400 + rand() * 2200 * (1 + Math.abs(close - open) / (10 * scaleRatio + 0.0001)));

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    prevClose = close;
  }

  return candles;
}

export function roundToTick(value: number, tickSize: number, decimals: number): number {
  const ticks = Math.round(value / tickSize);
  return Number((ticks * tickSize).toFixed(decimals));
}

/**
 * Converts standard OHLC candles to Heikin-Ashi candles
 */
export function toHeikinAshiCandles(candles: CandleBar[]): CandleBar[] {
  if (candles.length === 0) return [];
  const result: CandleBar[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (result[i - 1].open + result[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({
      time: c.time,
      open: Number(haOpen.toFixed(4)),
      high: Number(haHigh.toFixed(4)),
      low: Number(haLow.toFixed(4)),
      close: Number(haClose.toFixed(4)),
      volume: c.volume,
    });
  }
  return result;
}

/**
 * Resamples 1m candles into a larger bucket factor
 */
export function resampleCandles(candles: CandleBar[], bucketSize: number): CandleBar[] {
  if (bucketSize <= 1 || candles.length === 0) return candles;
  const aggregated: CandleBar[] = [];
  for (let i = 0; i < candles.length; i += bucketSize) {
    const slice = candles.slice(i, i + bucketSize);
    if (slice.length === 0) continue;
    const open = slice[0].open;
    const close = slice[slice.length - 1].close;
    let high = slice[0].high;
    let low = slice[0].low;
    let volume = 0;
    for (const bar of slice) {
      if (bar.high > high) high = bar.high;
      if (bar.low < low) low = bar.low;
      volume += bar.volume;
    }
    aggregated.push({
      time: slice[0].time,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return aggregated;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(candles: CandleBar[], period: number): Array<{ time: number; value: number }> {
  if (period <= 0 || candles.length < period) return [];
  const out: Array<{ time: number; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      out.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(4)),
      });
    }
  }
  return out;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(candles: CandleBar[], period: number): Array<{ time: number; value: number }> {
  if (period <= 0 || candles.length < period) return [];
  const out: Array<{ time: number; value: number }> = [];
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  out.push({ time: candles[period - 1].time, value: Number(ema.toFixed(4)) });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: Number(ema.toFixed(4)) });
  }
  return out;
}

/**
 * Session Volume-Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: CandleBar[]): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const vol = Math.max(1, c.volume);
    cumPV += typical * vol;
    cumVol += vol;
    out.push({
      time: c.time,
      value: Number((cumPV / cumVol).toFixed(4)),
    });
  }
  return out;
}

/**
 * Returns the exact Institutional IV WALLS price levels shown on the right scale in Screenshot 1
 * for NQ1! (and scaled equivalents for any other active symbol).
 */
export function getInstitutionalIVWalls(symbolInfo: SymbolInfo): IVWallLevel[] {
  if (symbolInfo.symbol === 'NQ1!') {
    return [
      {
        id: 'iv-pivot-high',
        price: 28399.25,
        label: '28,399.25',
        sigma: '',
        color: '#363a45',
        bgColor: '#363a45',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'pivot',
      },
      {
        id: 'iv-u1',
        price: 28365.56,
        label: '28,365.56',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'upper_1sigma',
      },
      {
        id: 'iv-u2',
        price: 28351.93,
        label: '28,351.93',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'upper_1sigma',
      },
      {
        id: 'iv-u3',
        price: 28350.50,
        label: '28,350.50',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'upper_1sigma',
      },
      {
        id: 'iv-u4',
        price: 28349.50,
        label: '28,349.50',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'upper_1sigma',
      },
      {
        id: 'iv-l1',
        price: 28228.00,
        label: '28,228.00',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'lower_1sigma',
      },
      {
        id: 'iv-l2',
        price: 28212.94,
        label: '28,212.94',
        sigma: '1σ',
        color: '#2962ff',
        bgColor: '#2962ff',
        textColor: '#ffffff',
        lineStyle: 'solid',
        category: 'lower_1sigma',
      },
    ];
  }

  // Proportional IV Wall levels for other symbols
  const p = symbolInfo.price;
  const d = symbolInfo.decimals;
  const t = symbolInfo.tickSize;
  const r = (mult: number) => roundToTick(p * mult, t, d);

  return [
    {
      id: 'iv-pivot-high',
      price: r(1.00336),
      label: formatPrice(r(1.00336), d),
      sigma: '',
      color: '#363a45',
      bgColor: '#363a45',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'pivot',
    },
    {
      id: 'iv-u1',
      price: r(1.00217),
      label: formatPrice(r(1.00217), d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-u2',
      price: r(1.00169),
      label: formatPrice(r(1.00169), d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-l1',
      price: r(0.99731),
      label: formatPrice(r(0.99731), d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'lower_1sigma',
    },
    {
      id: 'iv-l2',
      price: r(0.99678),
      label: formatPrice(r(0.99678), d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'lower_1sigma',
    },
  ];
}

/**
 * Returns the green shaded institutional IV Wall / Quantum Wealth SSMT liquidity zones shown in Screenshot 1
 */
export function getSupplyDemandZones(symbolInfo: SymbolInfo, candles: CandleBar[]): SupplyDemandZone[] {
  if (candles.length < 50) return [];
  const p = symbolInfo.price;
  const ratio = p / 28304.0;
  const n = candles.length;

  return [
    // Upper left green step line/zone around 28,412
    {
      id: 'zone-1',
      startTimeIndex: Math.floor(n * 0.25),
      endTimeIndex: Math.floor(n * 0.44),
      topPrice: 28415.0 * ratio,
      bottomPrice: 28411.5 * ratio,
      color: 'rgba(102, 187, 106, 0.22)',
      borderColor: 'rgba(76, 175, 80, 0.45)',
    },
    // Mid-session horizontal support line at 28,278 -> 28,292 green block
    {
      id: 'zone-2',
      startTimeIndex: Math.floor(n * 0.44),
      endTimeIndex: Math.floor(n * 0.63),
      topPrice: 28279.5 * ratio,
      bottomPrice: 28277.5 * ratio,
      color: 'rgba(102, 187, 106, 0.22)',
      borderColor: 'rgba(76, 175, 80, 0.45)',
    },
    // Prominent green order-block rectangle in the center-right (12:00 AM - 01:00 AM around 28,288 - 28,298)
    {
      id: 'zone-3',
      startTimeIndex: Math.floor(n * 0.63),
      endTimeIndex: Math.floor(n * 0.83),
      topPrice: 28298.5 * ratio,
      bottomPrice: 28286.0 * ratio,
      color: 'rgba(129, 199, 132, 0.26)',
      borderColor: 'rgba(76, 175, 80, 0.55)',
    },
    // Right-edge upper 1-sigma green liquidity box (28,349.50 - 28,365.56)
    {
      id: 'zone-4',
      startTimeIndex: Math.floor(n * 0.83),
      endTimeIndex: n - 1,
      topPrice: 28365.56 * ratio,
      bottomPrice: 28349.50 * ratio,
      color: 'rgba(129, 199, 132, 0.28)',
      borderColor: 'rgba(41, 98, 255, 0.45)',
    },
    // Right-edge lower 1-sigma green liquidity box (28,212.94 - 28,228.00)
    {
      id: 'zone-5',
      startTimeIndex: Math.floor(n * 0.83),
      endTimeIndex: n - 1,
      topPrice: 28228.00 * ratio,
      bottomPrice: 28212.94 * ratio,
      color: 'rgba(129, 199, 132, 0.28)',
      borderColor: 'rgba(41, 98, 255, 0.45)',
    },
  ];
}

/**
 * Generates Forward Curve term structure points for the right-hand details panel
 */
export function getForwardCurve(symbolInfo: SymbolInfo): ForwardCurvePoint[] {
  const base = symbolInfo.price;
  const prefix = symbolInfo.symbol.replace('1!', '');
  return [
    { contract: `${prefix}Z2026`, monthLabel: 'Dec 26', price: Number(base.toFixed(2)) },
    { contract: `${prefix}H2027`, monthLabel: 'Mar 27', price: Number((base * 1.012).toFixed(2)) },
    { contract: `${prefix}M2027`, monthLabel: 'Jun 27', price: Number((base * 1.024).toFixed(2)) },
    { contract: `${prefix}U2027`, monthLabel: 'Sep 27', price: Number((base * 1.036).toFixed(2)) },
    { contract: `${prefix}Z2027`, monthLabel: 'Dec 27', price: Number((base * 1.049).toFixed(2)) },
    { contract: `${prefix}H2028`, monthLabel: 'Mar 28', price: Number((base * 1.062).toFixed(2)) },
  ];
}

/**
 * Calculates unrealized PnL for an open trade position
 */
export function calculatePositionPnL(position: TradePosition, currentPrice: number): {
  pointsDiff: number;
  dollarPnL: number;
  percentPnL: number;
} {
  const direction = position.side === 'BUY' ? 1 : -1;
  const pointsDiff = (currentPrice - position.entryPrice) * direction;
  // Standard E-mini point value ($20/pt for NQ, $50/pt for ES, etc., simplified to 20 * qty)
  const multiplier = position.symbol === 'NQ1!' ? 20 : position.symbol === 'ES1!' ? 50 : position.symbol === 'YM1!' ? 5 : 10;
  const dollarPnL = Number((pointsDiff * position.qty * multiplier).toFixed(2));
  const percentPnL = Number(((pointsDiff / position.entryPrice) * 100).toFixed(2));
  return {
    pointsDiff: Number(pointsDiff.toFixed(4)),
    dollarPnL,
    percentPnL,
  };
}

/**
 * Evaluates whether a price alert should trigger given previous and new price
 */
export function evaluateAlertTrigger(
  alert: PriceAlert,
  prevPrice: number,
  newPrice: number
): boolean {
  if (!alert.active || alert.triggered) return false;
  const target = alert.targetPrice;
  switch (alert.condition) {
    case 'Crossing':
      return (prevPrice < target && newPrice >= target) || (prevPrice > target && newPrice <= target);
    case 'Crossing Up':
      return prevPrice < target && newPrice >= target;
    case 'Crossing Down':
      return prevPrice > target && newPrice <= target;
    case 'Greater Than':
      return newPrice > target;
    case 'Less Than':
      return newPrice < target;
    default:
      return false;
  }
}
