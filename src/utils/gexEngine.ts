import {
  ChartGexOverlayLevel,
  GexChartOverlayConfig,
  GexDashboardData,
  GexSpotCurvePoint,
  GexStrikeLevel,
  OptionChainContract,
  OptionFlowPrint,
  OrderflowBucket,
} from '../types/trading.ts';
import { parseLseTimeToUnix } from './marketEngine.ts';

export const DEFAULT_GEX_OVERLAY_CONFIG: GexChartOverlayConfig = {
  showCallWall: true,
  showPutWall: true,
  showZeroGamma: true,
  showHvlPin: true,
  showExpectedMove: true,
  showStrikeHistogram: true,
  showSecondaryWalls: false,
  expiryMode: '0dte',
  futuresProxyEnabled: true,
};

export function resolveGexUnderlyingForSymbol(
  symbol: string,
  lseMarket: string,
  lseHttpSymbol: string,
  futuresProxyEnabled: boolean = true
): { underlying: string; isFuturesProxy: boolean } | null {
  const symUpper = (symbol || '').trim().toUpperCase();
  const httpUpper = (lseHttpSymbol || '').trim().toUpperCase();

  if (lseMarket === 'us_stocks') {
    const clean = (httpUpper || symUpper).replace(/[^A-Z0-9.-]/g, '');
    return clean ? { underlying: clean, isFuturesProxy: false } : null;
  }

  if (lseMarket === 'us_options') {
    const raw = httpUpper || symUpper;
    const occMatch = raw.match(/^(?:O:)?([A-Z]{1,6})\d{6}[CP]/);
    if (occMatch) {
      return { underlying: occMatch[1], isFuturesProxy: false };
    }
    const prefixMatch = raw.match(/^([A-Z]{1,6})/);
    return prefixMatch ? { underlying: prefixMatch[1], isFuturesProxy: false } : null;
  }

  if (futuresProxyEnabled) {
    if (symUpper === 'NASDAQ100' || symUpper === 'NQ' || httpUpper === 'NQ') {
      return { underlying: 'QQQ', isFuturesProxy: true };
    }
    if (symUpper === 'SP500' || symUpper === 'ES' || httpUpper === 'ES') {
      return { underlying: 'SPY', isFuturesProxy: true };
    }
    if (symUpper === 'DOW' || symUpper === 'YM' || httpUpper === 'YM') {
      return { underlying: 'DIA', isFuturesProxy: true };
    }
  }

  return null;
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Computes Black-Scholes option gamma for spot S, strike K, annualized time T, and implied vol sigma.
 */
export function computeBlackScholesGamma(
  spot: number,
  strike: number,
  tYears: number,
  iv: number,
  rate: number = 0.045
): number {
  if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(strike) || strike <= 0) {
    return 0;
  }
  const safeT = Math.max(1 / (365 * 24), tYears); // min 1 hour to expiration for smooth 0DTE gamma
  const safeIv = Math.min(3.5, Math.max(0.05, iv || 0.22));
  const sqrtT = Math.sqrt(safeT);
  const denom = safeIv * sqrtT;
  if (denom <= 0) return 0;
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * safeIv * safeIv) * safeT) / denom;
  return normPdf(d1) / (spot * denom);
}

function formatEtTimeLabel(unixSec: number, includeSeconds: boolean = false): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(new Date(unixSec * 1000));
  } catch {
    const d = new Date(unixSec * 1000);
    const base = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    return includeSeconds ? `${base}:${String(d.getUTCSeconds()).padStart(2, '0')}` : base;
  }
}

/**
 * Computes institutional 0DTE Gamma Exposure (GEX) levels by strike, simulated GEX(Spot) flip curve,
 * key structural levels (Call Wall, Put Wall, Zero Gamma Flip, Max Pin), and time-bucketed orderflow.
 */
export function buildGexDashboardData(params: {
  underlying: string;
  selectedExpiry: string;
  selectedDte: number;
  expiries: Array<{ expiry: string; dte: number }>;
  chainContracts: OptionChainContract[];
  flowPrints: OptionFlowPrint[];
  flowScope?: '0dte' | 'all';
  fallbackSpot?: number;
}): GexDashboardData {
  const {
    underlying,
    selectedExpiry,
    selectedDte,
    expiries,
    chainContracts,
    flowPrints,
    flowScope = '0dte',
    fallbackSpot = 0,
  } = params;

  const spotFromChain = chainContracts.find((c) => c.underlying_price > 0)?.underlying_price ?? 0;
  const spotFromFlow = flowPrints.find((f) => f.underlying_price > 0)?.underlying_price ?? 0;
  const spotPrice = spotFromChain || spotFromFlow || fallbackSpot || 0;

  const tYears = Math.max(0.35, Math.max(0, selectedDte)) / 365;
  const scaleM = spotPrice > 0 ? (spotPrice * spotPrice * 0.01 * 100) / 1_000_000 : 0;

  const strikeMap = new Map<number, GexStrikeLevel>();
  let totalCallGexM = 0;
  let totalPutGexM = 0;
  let netDexDollars = 0;
  let callVolume = 0;
  let putVolume = 0;
  let totalCallChainPrem = 0;
  let totalPutChainPrem = 0;

  for (const c of chainContracts) {
    if (!Number.isFinite(c.strike) || c.strike <= 0) continue;
    const vol = Math.max(0, c.volume_today || 0);
    const prem = Math.max(0, c.premium_today || 0);
    const gammaVal =
      c.gamma !== null && Number.isFinite(c.gamma) && c.gamma >= 0
        ? c.gamma
        : computeBlackScholesGamma(spotPrice, c.strike, tYears, c.iv ?? 0.22);

    const rawGexM = gammaVal * vol * scaleM;
    const deltaVal = c.delta !== null && Number.isFinite(c.delta) ? c.delta : 0;
    netDexDollars += deltaVal * vol * 100 * spotPrice;

    let entry = strikeMap.get(c.strike);
    if (!entry) {
      entry = {
        strike: c.strike,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        absGex: 0,
        callVolume: 0,
        putVolume: 0,
        callPremium: 0,
        putPremium: 0,
        callIv: null,
        putIv: null,
      };
      strikeMap.set(c.strike, entry);
    }

    if (c.contract_type === 'call') {
      entry.callGex += rawGexM;
      entry.callVolume += vol;
      entry.callPremium += prem;
      if (c.iv !== null && Number.isFinite(c.iv)) entry.callIv = c.iv;
      if (!entry.callTicker || vol >= 0) {
        entry.callTicker = c.occSymbol;
        entry.callLast = c.last_price;
      }
      totalCallGexM += rawGexM;
      callVolume += vol;
      totalCallChainPrem += prem;
    } else {
      entry.putGex -= rawGexM;
      entry.putVolume += vol;
      entry.putPremium += prem;
      if (c.iv !== null && Number.isFinite(c.iv)) entry.putIv = c.iv;
      if (!entry.putTicker || vol >= 0) {
        entry.putTicker = c.occSymbol;
        entry.putLast = c.last_price;
      }
      totalPutGexM -= rawGexM;
      putVolume += vol;
      totalPutChainPrem += prem;
    }
  }

  const strikes = Array.from(strikeMap.values())
    .map((s) => {
      const netGex = s.callGex + s.putGex;
      const absGex = Math.abs(s.callGex) + Math.abs(s.putGex);
      return {
        ...s,
        callGex: Number(s.callGex.toFixed(4)),
        putGex: Number(s.putGex.toFixed(4)),
        netGex: Number(netGex.toFixed(4)),
        absGex: Number(absGex.toFixed(4)),
      };
    })
    .sort((a, b) => a.strike - b.strike);

  // Institutional Directional Structural Levels (SpotGamma / MenthorQ methodology):
  // - Call Wall: heaviest positive Call GEX ceiling at/above Spot (>= spot * 0.997)
  // - Put Wall: deepest negative Put GEX floor at/below Spot (<= spot * 1.003), separated from Call Wall when distinct strikes exist
  // - HVL Pin: highest aggregate |Call GEX| + |Put GEX| magnet strike
  const upperCallCandidates =
    spotPrice > 0 ? strikes.filter((s) => s.strike >= spotPrice * 0.997 && s.callGex > 0) : [];
  const callPool =
    upperCallCandidates.length > 0 ? upperCallCandidates : strikes.filter((s) => s.callGex > 0);
  const callsRanked = [...callPool].sort((a, b) => b.callGex - a.callGex);
  const callWall = callsRanked[0]?.strike ?? null;
  const secondaryCallWalls = callsRanked
    .filter((s) => s.strike !== callWall && s.strike > spotPrice)
    .slice(0, 2)
    .map((s) => s.strike);

  const lowerPutCandidatesRaw =
    spotPrice > 0 ? strikes.filter((s) => s.strike <= spotPrice * 1.003 && s.putGex < 0) : [];
  const lowerPutDistinct =
    callWall !== null && lowerPutCandidatesRaw.some((s) => s.strike < callWall)
      ? lowerPutCandidatesRaw.filter((s) => s.strike < callWall)
      : lowerPutCandidatesRaw;
  const putPool =
    lowerPutDistinct.length > 0 ? lowerPutDistinct : strikes.filter((s) => s.putGex < 0);
  const putsRanked = [...putPool].sort((a, b) => a.putGex - b.putGex);
  const putWall = putsRanked[0]?.strike ?? null;
  const secondaryPutWalls = putsRanked
    .filter((s) => s.strike !== putWall && s.strike < spotPrice)
    .slice(0, 2)
    .map((s) => s.strike);

  let maxPinStrike: number | null = null;
  let maxNetGex = 0;
  let minAccelStrike: number | null = null;
  let minNetGex = 0;
  let hvlStrike: number | null = null;
  let maxAbsGex = 0;

  for (const s of strikes) {
    if (s.netGex > maxNetGex) {
      maxNetGex = s.netGex;
      maxPinStrike = s.strike;
    }
    if (s.netGex < minNetGex) {
      minNetGex = s.netGex;
      minAccelStrike = s.strike;
    }
    if (s.absGex > maxAbsGex) {
      maxAbsGex = s.absGex;
      hvlStrike = s.strike;
    }
  }

  // Compute ATM IV and 1-Day 1-Sigma Expected Move (1D Max / 1D Min)
  const nearAtmIvs = chainContracts
    .filter(
      (c) =>
        spotPrice > 0 &&
        c.iv !== null &&
        Number.isFinite(c.iv) &&
        c.iv >= 0.06 &&
        c.iv <= 1.5 &&
        Math.abs(c.strike - spotPrice) <= spotPrice * 0.025
    )
    .map((c) => c.iv as number)
    .sort((a, b) => a - b);
  const atmIv: number | null =
    nearAtmIvs.length > 0 ? Number(nearAtmIvs[Math.floor(nearAtmIvs.length / 2)].toFixed(4)) : null;

  let expectedMove1D: number | null =
    atmIv !== null && spotPrice > 0 ? spotPrice * atmIv * Math.sqrt(1 / 252) : null;

  // Cross-check 0DTE ATM straddle pricing when both call & put last prices exist near spot
  if (selectedDte === 0 && spotPrice > 0 && strikes.length > 0) {
    const nearestAtm = [...strikes]
      .filter((s) => (s.callLast ?? 0) > 0 && (s.putLast ?? 0) > 0)
      .sort((a, b) => Math.abs(a.strike - spotPrice) - Math.abs(b.strike - spotPrice))[0];
    if (nearestAtm && nearestAtm.callLast && nearestAtm.putLast) {
      const straddleImplied = (nearestAtm.callLast + nearestAtm.putLast) * 0.85;
      if (straddleImplied > 0) {
        expectedMove1D =
          expectedMove1D !== null
            ? 0.55 * expectedMove1D + 0.45 * straddleImplied
            : straddleImplied;
      }
    }
  }

  const roundedEm1D = expectedMove1D !== null ? Number(expectedMove1D.toFixed(2)) : null;
  const expectedMoveUpper =
    roundedEm1D !== null && spotPrice > 0 ? Number((spotPrice + roundedEm1D).toFixed(2)) : null;
  const expectedMoveLower =
    roundedEm1D !== null && spotPrice > 0
      ? Number(Math.max(0.01, spotPrice - roundedEm1D).toFixed(2))
      : null;

  // Simulated Black-Scholes GEX(Spot) curve across Spot ±5.5% anchored to OPRA contract gamma at Spot
  const gexCurve: GexSpotCurvePoint[] = [];
  let zeroGammaFlip: number | null = null;

  if (spotPrice > 0 && chainContracts.length > 0) {
    const activeContracts = chainContracts.filter((c) => (c.volume_today || 0) > 0 && c.strike > 0);
    const atmIvs = activeContracts
      .filter(
        (c) =>
          c.iv !== null &&
          Number.isFinite(c.iv) &&
          c.iv >= 0.05 &&
          c.iv <= 1.25 &&
          Math.abs(c.strike - spotPrice) <= spotPrice * 0.03
      )
      .map((c) => c.iv as number)
      .sort((a, b) => a - b);
    const medianAtmIv =
      atmIv ?? (atmIvs.length > 0 ? atmIvs[Math.floor(atmIvs.length / 2)] : 0.22);
    const curveTYears = Math.max(0.08, Math.max(0, selectedDte)) / 365;

    const calibrated = activeContracts.map((c) => {
      const cleanIv =
        c.iv !== null && Number.isFinite(c.iv) && c.iv >= 0.05 && c.iv <= 1.25
          ? c.iv
          : medianAtmIv;
      const gAtSpot = computeBlackScholesGamma(spotPrice, c.strike, curveTYears, cleanIv);
      const anchorScale =
        c.gamma !== null && Number.isFinite(c.gamma) && c.gamma > 0 && gAtSpot > 1e-7
          ? Math.min(12, Math.max(0.08, c.gamma / gAtSpot))
          : 1;
      return {
        strike: c.strike,
        vol: c.volume_today || 0,
        sign: c.contract_type === 'call' ? 1 : -1,
        cleanIv,
        anchorScale,
      };
    });

    const steps = 40;
    const minSpot = spotPrice * 0.945;
    const maxSpot = spotPrice * 1.055;
    const stepSize = (maxSpot - minSpot) / steps;

    for (let i = 0; i <= steps; i++) {
      const simSpot = minSpot + i * stepSize;
      const simScaleM = (simSpot * simSpot * 0.01 * 100) / 1_000_000;
      let simNetGex = 0;
      for (const c of calibrated) {
        const g = computeBlackScholesGamma(simSpot, c.strike, curveTYears, c.cleanIv);
        simNetGex += c.sign * g * c.anchorScale * c.vol * simScaleM;
      }
      gexCurve.push({
        spot: Number(simSpot.toFixed(2)),
        netGex: Number(simNetGex.toFixed(4)),
      });
    }

    // Locate crossing closest to current spotPrice
    let bestDist = Infinity;
    for (let i = 1; i < gexCurve.length; i++) {
      const a = gexCurve[i - 1];
      const b = gexCurve[i];
      if ((a.netGex <= 0 && b.netGex >= 0) || (a.netGex >= 0 && b.netGex <= 0)) {
        const span = b.netGex - a.netGex;
        const frac = Math.abs(span) > 1e-9 ? Math.abs(a.netGex) / Math.abs(span) : 0.5;
        const crossSpot = a.spot + frac * (b.spot - a.spot);
        const dist = Math.abs(crossSpot - spotPrice);
        if (dist < bestDist) {
          bestDist = dist;
          zeroGammaFlip = Number(crossSpot.toFixed(2));
        }
      }
    }
  }

  // Fallback cumulative-strike crossing estimate if BS curve stays one-sided
  if (zeroGammaFlip === null && strikes.length >= 2) {
    let bestAbs = Infinity;
    let candidate: number | null = null;
    for (let i = 1; i < strikes.length; i++) {
      const a = strikes[i - 1];
      const b = strikes[i];
      if ((a.netGex <= 0 && b.netGex >= 0) || (a.netGex >= 0 && b.netGex <= 0)) {
        const span = b.netGex - a.netGex;
        const frac = Math.abs(span) > 1e-9 ? Math.abs(a.netGex) / Math.abs(span) : 0.5;
        const cross = a.strike + frac * (b.strike - a.strike);
        const dist = Math.abs(cross - spotPrice);
        if (dist < bestAbs) {
          bestAbs = dist;
          candidate = Number(cross.toFixed(2));
        }
      }
    }
    zeroGammaFlip = candidate;
  }

  // Filter flow prints by scope ('0dte' matches selectedExpiry when prints exist, else fallback cleanly)
  const matchingExpiryPrints = selectedExpiry
    ? flowPrints.filter((p) => p.expiry === selectedExpiry)
    : flowPrints;
  const useExpiryOnly = flowScope === '0dte' && matchingExpiryPrints.length > 0;
  const scopedPrints = useExpiryOnly ? matchingExpiryPrints : flowPrints;
  const flowScopeUsed: '0dte' | 'all' = useExpiryOnly ? '0dte' : 'all';

  // Aggregate flow prints into dynamic time buckets for Orderflow chart
  const parsedFlow = scopedPrints
    .map((p) => ({
      print: p,
      timeSec: parseLseTimeToUnix(p.ts),
    }))
    .filter((item) => Number.isFinite(item.timeSec) && item.timeSec > 0)
    .sort((a, b) => a.timeSec - b.timeSec);

  let bucketSeconds = 300;
  if (parsedFlow.length >= 2) {
    const spanSec = parsedFlow[parsedFlow.length - 1].timeSec - parsedFlow[0].timeSec;
    if (spanSec <= 30) bucketSeconds = 2;
    else if (spanSec <= 180) bucketSeconds = 5;
    else if (spanSec <= 600) bucketSeconds = 15;
    else if (spanSec <= 1800) bucketSeconds = 60;
    else if (spanSec <= 4 * 3600) bucketSeconds = 300;
    else if (spanSec <= 12 * 3600) bucketSeconds = 900;
    else bucketSeconds = 1800;
  }

  const bucketMap = new Map<
    number,
    {
      callPremium: number;
      putPremium: number;
      callVolume: number;
      putVolume: number;
      tradesCount: number;
      spotSum: number;
      spotCount: number;
    }
  >();

  let totalFlowCallPrem = 0;
  let totalFlowPutPrem = 0;

  for (const { print, timeSec } of parsedFlow) {
    const bTime = Math.floor(timeSec / bucketSeconds) * bucketSeconds;
    let b = bucketMap.get(bTime);
    if (!b) {
      b = {
        callPremium: 0,
        putPremium: 0,
        callVolume: 0,
        putVolume: 0,
        tradesCount: 0,
        spotSum: 0,
        spotCount: 0,
      };
      bucketMap.set(bTime, b);
    }
    const prem = Math.max(0, print.premium || 0);
    const vol = Math.max(0, print.volume || 0);
    if (print.contract_type === 'call') {
      b.callPremium += prem;
      b.callVolume += vol;
      totalFlowCallPrem += prem;
    } else {
      b.putPremium += prem;
      b.putVolume += vol;
      totalFlowPutPrem += prem;
    }
    b.tradesCount += 1;
    if (print.underlying_price > 0) {
      b.spotSum += print.underlying_price;
      b.spotCount += 1;
    }
  }

  let runningCum = 0;
  const flowBuckets: OrderflowBucket[] = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bTime, b]) => {
      const netPremium = b.callPremium - b.putPremium;
      runningCum += netPremium;
      return {
        timeSec: bTime,
        label: formatEtTimeLabel(bTime, bucketSeconds < 60),
        callPremium: Math.round(b.callPremium),
        putPremium: Math.round(b.putPremium),
        netPremium: Math.round(netPremium),
        cumNetPremium: Math.round(runningCum),
        callVolume: b.callVolume,
        putVolume: b.putVolume,
        tradesCount: b.tradesCount,
        spotPrice: b.spotCount > 0 ? Number((b.spotSum / b.spotCount).toFixed(2)) : null,
      };
    });

  const effectiveCallPrem = totalFlowCallPrem > 0 ? totalFlowCallPrem : totalCallChainPrem;
  const effectivePutPrem = totalFlowPutPrem > 0 ? totalFlowPutPrem : totalPutChainPrem;
  const putCallRatio = callVolume > 0 ? Number((putVolume / callVolume).toFixed(2)) : 0;

  return {
    underlying,
    spotPrice: Number(spotPrice.toFixed(2)),
    selectedExpiry,
    selectedDte,
    expiries,
    contractsCount: chainContracts.length,
    flowScopeUsed,
    bucketSeconds,
    metrics: {
      totalNetGexM: Number((totalCallGexM + totalPutGexM).toFixed(3)),
      totalCallGexM: Number(totalCallGexM.toFixed(3)),
      totalPutGexM: Number(totalPutGexM.toFixed(3)),
      netDexM: Number((netDexDollars / 1_000_000).toFixed(3)),
      callWall,
      putWall,
      zeroGammaFlip,
      maxPinStrike,
      hvlStrike,
      minAccelStrike,
      atmIv,
      expectedMove1D: roundedEm1D,
      expectedMoveUpper,
      expectedMoveLower,
      secondaryCallWalls,
      secondaryPutWalls,
      callVolume,
      putVolume,
      putCallRatio,
      totalCallPremium: Math.round(effectiveCallPrem),
      totalPutPremium: Math.round(effectivePutPrem),
      netFlowPremium: Math.round(effectiveCallPrem - effectivePutPrem),
    },
    strikes,
    gexCurve,
    flowBuckets,
    recentFlowPrints: [...scopedPrints].slice(0, 60),
  };
}

/**
 * Converts institutional GEX metrics into chart-ready horizontal price lines,
 * supporting both direct ETF/equity underlyings (e.g. QQQ, SPY, NVDA) and
 * proportional scaling onto index futures charts (e.g. QQQ -> NASDAQ100).
 */
export function buildChartGexLevels(
  gex: GexDashboardData | null | undefined,
  config: GexChartOverlayConfig,
  targetChartSymbol: string,
  chartSpotPrice?: number
): ChartGexOverlayLevel[] {
  if (!gex) return [];

  const isProxy =
    gex.underlying.toUpperCase() !== targetChartSymbol.toUpperCase() &&
    gex.spotPrice > 0 &&
    chartSpotPrice !== undefined &&
    chartSpotPrice > 0;
  const ratio = isProxy ? chartSpotPrice! / gex.spotPrice : 1;
  const tagSuffix = isProxy ? ` (${gex.underlying})` : gex.selectedDte === 0 ? ' (0DTE)' : ` (${gex.selectedDte}DTE)`;

  const levels: ChartGexOverlayLevel[] = [];

  if (config.showCallWall && gex.metrics.callWall) {
    levels.push({
      id: 'gex-call-wall',
      key: 'call_wall',
      underlying: targetChartSymbol,
      price: gex.metrics.callWall * ratio,
      label: `Call Wall${tagSuffix}`,
      color: '#089981',
      lineStyle: 'solid',
      lineWidth: 2,
    });
  }

  if (config.showPutWall && gex.metrics.putWall) {
    levels.push({
      id: 'gex-put-wall',
      key: 'put_wall',
      underlying: targetChartSymbol,
      price: gex.metrics.putWall * ratio,
      label: `Put Wall${tagSuffix}`,
      color: '#f23645',
      lineStyle: 'solid',
      lineWidth: 2,
    });
  }

  if (config.showZeroGamma && gex.metrics.zeroGammaFlip) {
    levels.push({
      id: 'gex-zero-gamma',
      key: 'zero_gamma',
      underlying: targetChartSymbol,
      price: gex.metrics.zeroGammaFlip * ratio,
      label: `Zero Gamma${tagSuffix}`,
      color: '#f59e0b',
      lineStyle: 'dashed',
      lineWidth: 2,
    });
  }

  const hvlPrice = gex.metrics.hvlStrike ?? gex.metrics.maxPinStrike;
  if (
    config.showHvlPin &&
    hvlPrice &&
    hvlPrice !== gex.metrics.callWall &&
    hvlPrice !== gex.metrics.putWall
  ) {
    levels.push({
      id: 'gex-hvl-pin',
      key: 'hvl_pin',
      underlying: targetChartSymbol,
      price: hvlPrice * ratio,
      label: `HVL Pin${tagSuffix}`,
      color: '#2962ff',
      lineStyle: 'dotted',
      lineWidth: 2,
    });
  }

  if (config.showExpectedMove && gex.metrics.expectedMoveUpper && gex.metrics.expectedMoveLower) {
    levels.push({
      id: 'gex-em-upper',
      key: 'expected_move_up',
      underlying: targetChartSymbol,
      price: gex.metrics.expectedMoveUpper * ratio,
      label: `1D Max${tagSuffix}`,
      color: '#a855f7',
      lineStyle: 'dashed',
      lineWidth: 1,
    });
    levels.push({
      id: 'gex-em-lower',
      key: 'expected_move_dn',
      underlying: targetChartSymbol,
      price: gex.metrics.expectedMoveLower * ratio,
      label: `1D Min${tagSuffix}`,
      color: '#a855f7',
      lineStyle: 'dashed',
      lineWidth: 1,
    });
  }

  if (config.showSecondaryWalls) {
    gex.metrics.secondaryCallWalls.forEach((strike, idx) => {
      levels.push({
        id: `gex-cw-${idx + 2}`,
        key: 'secondary_call',
        underlying: targetChartSymbol,
        price: strike * ratio,
        label: `CW${idx + 2}${tagSuffix}`,
        color: '#26a69a',
        lineStyle: 'dotted',
        lineWidth: 1,
      });
    });
    gex.metrics.secondaryPutWalls.forEach((strike, idx) => {
      levels.push({
        id: `gex-pw-${idx + 2}`,
        key: 'secondary_put',
        underlying: targetChartSymbol,
        price: strike * ratio,
        label: `PW${idx + 2}${tagSuffix}`,
        color: '#ef5350',
        lineStyle: 'dotted',
        lineWidth: 1,
      });
    });
  }

  return levels;
}

