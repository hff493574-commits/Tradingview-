import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { X, RefreshCw, Pin, PinOff, ArrowUpRight } from 'lucide-react';
import {
  ChartGexOverlayLevel,
  GexDashboardData,
  GexStrikeLevel,
  OrderflowBucket,
} from '../types/trading';

interface GexDashboardModalProps {
  open: boolean;
  onClose: () => void;
  initialUnderlying: string;
  pinnedUnderlying: string | null;
  onTogglePinLevels: (underlying: string, levels: ChartGexOverlayLevel[]) => void;
  onSelectOptionContract: (contract: {
    occSymbol: string;
    underlying: string;
    strike: number;
    expiry: string;
    contract_type: 'call' | 'put';
  }) => void;
}

const QUICK_UNDERLYINGS = ['SPY', 'QQQ', 'IWM', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'META'];

function formatPrem(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatGexM(val: number): string {
  const abs = Math.abs(val);
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)}B`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}M`;
  return `${sign}${abs.toFixed(2)}M`;
}

export const GexDashboardModal: React.FC<GexDashboardModalProps> = ({
  open,
  onClose,
  initialUnderlying,
  pinnedUnderlying,
  onTogglePinLevels,
  onSelectOptionContract,
}) => {
  const [underlying, setUnderlying] = useState<string>(initialUnderlying || 'SPY');
  const [draftTicker, setDraftTicker] = useState<string>(initialUnderlying || 'SPY');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [flowScope, setFlowScope] = useState<'0dte' | 'all'>('0dte');
  const [strikeWindow, setStrikeWindow] = useState<'3pct' | '6pct' | 'all'>('6pct');
  const [gexViewMode, setGexViewMode] = useState<'split' | 'net'>('split');

  const [data, setData] = useState<GexDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [hoveredStrikeIdx, setHoveredStrikeIdx] = useState<number | null>(null);
  const [hoveredCurveIdx, setHoveredCurveIdx] = useState<number | null>(null);
  const [hoveredFlowIdx, setHoveredFlowIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open && initialUnderlying) {
      const clean = initialUnderlying.toUpperCase();
      setUnderlying(clean);
      setDraftTicker(clean);
      setSelectedExpiry('');
    }
  }, [open, initialUnderlying]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const fetchGex = useCallback(async () => {
    if (!underlying) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        underlying,
        flow_scope: flowScope,
      });
      if (selectedExpiry) qs.set('expiry', selectedExpiry);
      const res = await fetch(`/api/lse/options/gex?${qs.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || `LSE GEX request failed (${res.status})`);
      }
      setData(payload as GexDashboardData);
    } catch (err) {
      setError((err as Error).message || 'Failed to load 0DTE GEX data');
    } finally {
      setLoading(false);
    }
  }, [underlying, selectedExpiry, flowScope]);

  useEffect(() => {
    if (!open) return;
    fetchGex();
  }, [open, fetchGex]);

  const filteredStrikes = useMemo(() => {
    if (!data?.strikes.length) return [];
    const spot = data.spotPrice;
    if (strikeWindow === 'all' || !spot || spot <= 0) {
      return data.strikes;
    }
    const pct = strikeWindow === '3pct' ? 0.03 : 0.06;
    const minK = spot * (1 - pct);
    const maxK = spot * (1 + pct);
    const sliced = data.strikes.filter((s) => s.strike >= minK && s.strike <= maxK);
    return sliced.length >= 6 ? sliced : data.strikes;
  }, [data, strikeWindow]);

  const overlayLevelsForChart = useMemo<ChartGexOverlayLevel[]>(() => {
    if (!data) return [];
    const levels: ChartGexOverlayLevel[] = [];
    if (data.metrics.callWall) {
      levels.push({
        id: 'gex-call-wall',
        underlying: data.underlying,
        price: data.metrics.callWall,
        label: `0DTE Call Wall`,
        color: '#089981',
        lineStyle: 'solid',
      });
    }
    if (data.metrics.putWall) {
      levels.push({
        id: 'gex-put-wall',
        underlying: data.underlying,
        price: data.metrics.putWall,
        label: `0DTE Put Wall`,
        color: '#f23645',
        lineStyle: 'solid',
      });
    }
    if (data.metrics.zeroGammaFlip) {
      levels.push({
        id: 'gex-zero-gamma',
        underlying: data.underlying,
        price: data.metrics.zeroGammaFlip,
        label: `Zero Gamma`,
        color: '#f59e0b',
        lineStyle: 'dashed',
      });
    }
    if (
      data.metrics.maxPinStrike &&
      data.metrics.maxPinStrike !== data.metrics.callWall
    ) {
      levels.push({
        id: 'gex-max-pin',
        underlying: data.underlying,
        price: data.metrics.maxPinStrike,
        label: `Max Pin`,
        color: '#2962ff',
        lineStyle: 'dotted',
      });
    }
    return levels;
  }, [data]);

  const isPinned = Boolean(
    data && pinnedUnderlying && pinnedUnderlying.toUpperCase() === data.underlying.toUpperCase()
  );

  if (!open) return null;

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draftTicker.trim().toUpperCase();
    if (clean) {
      setUnderlying(clean);
      setSelectedExpiry('');
    }
  };

  const handleSelectQuickTicker = (tk: string) => {
    setDraftTicker(tk);
    setUnderlying(tk);
    setSelectedExpiry('');
  };

  const handlePlotStrike = (s: GexStrikeLevel) => {
    if (!data) return;
    const preferCall = Math.abs(s.callGex) >= Math.abs(s.putGex);
    const occ = preferCall ? s.callTicker || s.putTicker : s.putTicker || s.callTicker;
    if (!occ) return;
    onSelectOptionContract({
      occSymbol: occ,
      underlying: data.underlying,
      strike: s.strike,
      expiry: data.selectedExpiry,
      contract_type: preferCall && s.callTicker ? 'call' : 'put',
    });
    onClose();
  };

  const flipDeltaPct =
    data && data.spotPrice > 0 && data.metrics.zeroGammaFlip
      ? ((data.metrics.zeroGammaFlip - data.spotPrice) / data.spotPrice) * 100
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="0DTE Options GEX and Orderflow Dashboard"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[1280px] max-h-[92vh] bg-[#0d1017] border border-[#222631] rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-[#d1d4dc]">
        {/* Top Header & Controls */}
        <div className="px-4 py-2.5 border-b border-[#222631] bg-[#0a0c12] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 pr-2 border-r border-[#222631]">
              <span className="text-[13px] font-semibold tracking-tight text-white">
                0DTE GEX & Orderflow
              </span>
              <span className="text-[11px] font-mono text-[#787b86]">OPRA</span>
            </div>

            <form onSubmit={handleTickerSubmit} className="flex items-center gap-1">
              <input
                type="text"
                value={draftTicker}
                onChange={(e) => setDraftTicker(e.target.value.toUpperCase())}
                placeholder="SPY"
                aria-label="GEX Underlying Ticker"
                className="w-20 h-7 px-2 rounded bg-[#141720] border border-[#2a2e39] text-[12px] font-mono font-semibold text-white uppercase focus:outline-none focus:border-[#2962ff]"
              />
              <button
                type="submit"
                className="h-7 px-2.5 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white text-[11px] font-semibold transition-colors"
              >
                Load
              </button>
            </form>

            <div className="hidden lg:flex items-center gap-0.5 bg-[#141720] p-0.5 rounded border border-[#222631]">
              {QUICK_UNDERLYINGS.map((tk) => (
                <button
                  key={tk}
                  type="button"
                  onClick={() => handleSelectQuickTicker(tk)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    underlying === tk
                      ? 'bg-[#2a2e39] text-white font-semibold'
                      : 'text-[#868993] hover:text-white'
                  }`}
                >
                  {tk}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Expiry Selector */}
            <select
              value={data?.selectedExpiry || selectedExpiry}
              onChange={(e) => setSelectedExpiry(e.target.value)}
              aria-label="Select Options Expiration"
              className="h-7 px-2 rounded bg-[#141720] border border-[#2a2e39] text-[11px] font-mono text-white focus:outline-none focus:border-[#2962ff]"
            >
              {(data?.expiries || []).map((ex) => (
                <option key={ex.expiry} value={ex.expiry}>
                  {ex.expiry} ({ex.dte === 0 ? '0DTE' : `${ex.dte}DTE`})
                </option>
              ))}
            </select>

            {/* Flow Scope Toggle */}
            <div className="flex items-center bg-[#141720] p-0.5 rounded border border-[#222631] text-[11px]">
              <button
                type="button"
                onClick={() => setFlowScope('0dte')}
                className={`px-2 py-1 rounded transition-colors ${
                  flowScope === '0dte'
                    ? 'bg-[#2a2e39] text-white font-semibold'
                    : 'text-[#868993] hover:text-white'
                }`}
              >
                Expiry Flow
              </button>
              <button
                type="button"
                onClick={() => setFlowScope('all')}
                className={`px-2 py-1 rounded transition-colors ${
                  flowScope === 'all'
                    ? 'bg-[#2a2e39] text-white font-semibold'
                    : 'text-[#868993] hover:text-white'
                }`}
              >
                All Expiries
              </button>
            </div>

            {/* Pin GEX Levels to Main Chart */}
            <button
              type="button"
              disabled={!data || overlayLevelsForChart.length === 0}
              onClick={() => {
                if (!data) return;
                onTogglePinLevels(data.underlying, overlayLevelsForChart);
              }}
              className={`h-7 px-2.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                isPinned
                  ? 'bg-[#2962ff]/15 border-[#2962ff] text-white'
                  : 'bg-[#141720] border-[#2a2e39] text-[#d1d4dc] hover:border-[#434651] hover:text-white'
              }`}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5 text-[#2962ff]" /> : <Pin className="w-3.5 h-3.5" />}
              <span>{isPinned ? 'Unpin Levels' : 'Pin Levels on Chart'}</span>
            </button>

            <button
              type="button"
              onClick={fetchGex}
              aria-label="Refresh GEX Data"
              title="Refresh GEX & Orderflow"
              className="w-7 h-7 rounded bg-[#141720] border border-[#2a2e39] flex items-center justify-center text-[#9598a1] hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close GEX Dashboard"
              className="w-7 h-7 rounded bg-[#141720] border border-[#2a2e39] flex items-center justify-center text-[#9598a1] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          {error && (
            <div className="px-3 py-2 rounded border border-[#f23645]/40 bg-[#f23645]/10 text-[12px] text-[#f23645] flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchGex}
                className="underline font-medium hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="py-24 text-center text-[13px] text-[#868993] font-mono">
              Loading real-time OPRA chain & orderflow for {underlying}...
            </div>
          ) : data ? (
            <>
              {/* 6-Metric Flat Institutional KPI Strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    {data.underlying} Spot
                  </div>
                  <div className="text-[17px] font-mono font-semibold text-white tabular-nums mt-0.5">
                    {data.spotPrice > 0 ? `$${data.spotPrice.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-[11px] font-mono text-[#868993] tabular-nums mt-0.5">
                    Net DEX {formatGexM(data.metrics.netDexM)}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    Net GEX ($M/1%)
                  </div>
                  <div
                    className={`text-[17px] font-mono font-semibold tabular-nums mt-0.5 ${
                      data.metrics.totalNetGexM >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {formatGexM(data.metrics.totalNetGexM)}
                  </div>
                  <div className="text-[11px] text-[#868993] mt-0.5">
                    {data.metrics.totalNetGexM >= 0
                      ? '+Gamma Mean-Reverting'
                      : '-Gamma Volatility'}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    Zero Gamma Flip
                  </div>
                  <div className="text-[17px] font-mono font-semibold text-[#f59e0b] tabular-nums mt-0.5">
                    {data.metrics.zeroGammaFlip
                      ? `$${data.metrics.zeroGammaFlip.toFixed(2)}`
                      : 'One-Sided'}
                  </div>
                  <div className="text-[11px] font-mono text-[#868993] tabular-nums mt-0.5">
                    {flipDeltaPct !== null
                      ? `${flipDeltaPct >= 0 ? '+' : ''}${flipDeltaPct.toFixed(2)}% vs Spot`
                      : `Max Pin ${data.metrics.maxPinStrike ? `$${data.metrics.maxPinStrike}` : '—'}`}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    Call Wall
                  </div>
                  <div className="text-[17px] font-mono font-semibold text-[#089981] tabular-nums mt-0.5">
                    {data.metrics.callWall ? `$${data.metrics.callWall}` : '—'}
                  </div>
                  <div className="text-[11px] font-mono text-[#868993] tabular-nums mt-0.5">
                    Call GEX {formatGexM(data.metrics.totalCallGexM)}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    Put Wall
                  </div>
                  <div className="text-[17px] font-mono font-semibold text-[#f23645] tabular-nums mt-0.5">
                    {data.metrics.putWall ? `$${data.metrics.putWall}` : '—'}
                  </div>
                  <div className="text-[11px] font-mono text-[#868993] tabular-nums mt-0.5">
                    Put GEX {formatGexM(data.metrics.totalPutGexM)}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#11151e] border border-[#222631]">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#787b86]">
                    Net Flow Delta
                  </div>
                  <div
                    className={`text-[17px] font-mono font-semibold tabular-nums mt-0.5 ${
                      data.metrics.netFlowPremium >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {data.metrics.netFlowPremium >= 0 ? '+' : ''}
                    {formatPrem(data.metrics.netFlowPremium)}
                  </div>
                  <div className="text-[11px] font-mono text-[#868993] tabular-nums mt-0.5">
                    P/C {data.metrics.putCallRatio.toFixed(2)} · {data.contractsCount} cts
                  </div>
                </div>
              </div>

              {/* Row 1: GEX Levels by Strike + Gamma Flip Curve */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* Panel A: GEX Levels by Strike */}
                <div className="p-3 rounded bg-[#11151e] border border-[#222631] flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[12.5px] font-semibold text-white">
                        GEX Levels by Strike
                      </h3>
                      <p className="text-[10.5px] text-[#787b86]">
                        Dealer gamma ($M per 1% spot move) · Click any bar to plot OCC contract
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px]">
                      <div className="flex items-center bg-[#0a0c12] p-0.5 rounded border border-[#222631]">
                        {(['split', 'net'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setGexViewMode(m)}
                            className={`px-1.5 py-0.5 rounded capitalize ${
                              gexViewMode === m
                                ? 'bg-[#2a2e39] text-white font-semibold'
                                : 'text-[#868993] hover:text-white'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center bg-[#0a0c12] p-0.5 rounded border border-[#222631] font-mono">
                        {(
                          [
                            ['3pct', '±3%'],
                            ['6pct', '±6%'],
                            ['all', 'All'],
                          ] as const
                        ).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setStrikeWindow(val)}
                            className={`px-1.5 py-0.5 rounded ${
                              strikeWindow === val
                                ? 'bg-[#2a2e39] text-white font-semibold'
                                : 'text-[#868993] hover:text-white'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <StrikeGexChart
                    strikes={filteredStrikes}
                    spotPrice={data.spotPrice}
                    callWall={data.metrics.callWall}
                    putWall={data.metrics.putWall}
                    zeroGammaFlip={data.metrics.zeroGammaFlip}
                    mode={gexViewMode}
                    hoveredIdx={hoveredStrikeIdx}
                    onHoverIdx={setHoveredStrikeIdx}
                    onClickStrike={handlePlotStrike}
                  />
                </div>

                {/* Panel B: Gamma Flip Profile GEX(Spot) */}
                <div className="p-3 rounded bg-[#11151e] border border-[#222631] flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[12.5px] font-semibold text-white">
                        Gamma Flip Profile GEX(Spot)
                      </h3>
                      <p className="text-[10.5px] text-[#787b86]">
                        Projected dealer gamma sensitivity across Spot ±5.5%
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10.5px] font-mono">
                      <span className="text-[#089981]">+Gamma Pin</span>
                      <span className="text-[#f23645]">-Gamma Trend</span>
                    </div>
                  </div>

                  <GexFlipCurveChart
                    curve={data.gexCurve}
                    spotPrice={data.spotPrice}
                    zeroGammaFlip={data.metrics.zeroGammaFlip}
                    hoveredIdx={hoveredCurveIdx}
                    onHoverIdx={setHoveredCurveIdx}
                  />
                </div>
              </div>

              {/* Row 2: Orderflow Chart + Live Flow Prints Tape */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
                {/* Orderflow Chart (3/5) */}
                <div className="lg:col-span-3 p-3 rounded bg-[#11151e] border border-[#222631] flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[12.5px] font-semibold text-white">
                        Options Orderflow & Cumulative Net Premium
                      </h3>
                      <p className="text-[10.5px] text-[#787b86] font-mono tabular-nums">
                        {data.bucketSeconds < 60
                          ? `${data.bucketSeconds}s`
                          : `${Math.round(data.bucketSeconds / 60)}m`}{' '}
                        ET buckets · Call{' '}
                        <span className="text-[#089981]">
                          {formatPrem(data.metrics.totalCallPremium)}
                        </span>{' '}
                        vs Put{' '}
                        <span className="text-[#f23645]">
                          {formatPrem(data.metrics.totalPutPremium)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10.5px] font-mono">
                      <span className="text-[#089981]">Call $</span>
                      <span className="text-[#f23645]">Put $</span>
                      <span className="text-[#2962ff]">Cum Net $</span>
                    </div>
                  </div>

                  <OrderflowComboChart
                    buckets={data.flowBuckets}
                    hoveredIdx={hoveredFlowIdx}
                    onHoverIdx={setHoveredFlowIdx}
                  />
                </div>

                {/* Live Flow Tape (2/5) */}
                <div className="lg:col-span-2 p-3 rounded bg-[#11151e] border border-[#222631] flex flex-col max-h-[290px]">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div>
                      <h3 className="text-[12.5px] font-semibold text-white">
                        {data.flowScopeUsed === '0dte' ? 'Expiry Flow Prints' : 'Recent Options Prints'}
                      </h3>
                      <p className="text-[10.5px] text-[#787b86]">
                        Click a print to plot OCC candlestick chart
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#787b86] tabular-nums">
                      {data.recentFlowPrints.length} prints
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto border-t border-[#222631] divide-y divide-[#1a1e29]">
                    {data.recentFlowPrints.length === 0 ? (
                      <div className="py-10 text-center text-[11.5px] text-[#787b86]">
                        No options flow prints returned for {data.underlying}.
                      </div>
                    ) : (
                      data.recentFlowPrints.slice(0, 40).map((fl) => {
                        const isCall = fl.contract_type === 'call';
                        return (
                          <button
                            key={fl.id}
                            type="button"
                            onClick={() => {
                              onSelectOptionContract({
                                occSymbol: fl.occSymbol,
                                underlying: fl.underlying,
                                strike: fl.strike,
                                expiry: fl.expiry,
                                contract_type: fl.contract_type,
                              });
                              onClose();
                            }}
                            className="w-full py-1.5 px-1.5 flex items-center justify-between text-left hover:bg-[#181c28] transition-colors font-mono text-[11px] tabular-nums group"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`font-bold ${
                                  isCall ? 'text-[#089981]' : 'text-[#f23645]'
                                }`}
                              >
                                ${fl.strike}
                                {isCall ? 'C' : 'P'}
                              </span>
                              <span className="text-[#787b86] text-[10px]">
                                {fl.expiry.slice(5)}
                              </span>
                              <span className="text-[#b2b5be] truncate">
                                {fl.volume}x @ ${Number(fl.last_price || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-semibold ${
                                  isCall ? 'text-[#089981]' : 'text-[#f23645]'
                                }`}
                              >
                                {formatPrem(fl.premium)}
                              </span>
                              <span className="text-[10px] text-[#787b86]">
                                {fl.ts ? fl.ts.slice(11, 16) : '—'}
                              </span>
                              <ArrowUpRight className="w-3 h-3 text-[#787b86] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/* ---------- SVG Subcharts (Crisp Vector Rendering & Interactive Crosshairs) ---------- */

const StrikeGexChart: React.FC<{
  strikes: GexStrikeLevel[];
  spotPrice: number;
  callWall: number | null;
  putWall: number | null;
  zeroGammaFlip: number | null;
  mode: 'split' | 'net';
  hoveredIdx: number | null;
  onHoverIdx: (idx: number | null) => void;
  onClickStrike: (s: GexStrikeLevel) => void;
}> = ({
  strikes,
  spotPrice,
  callWall,
  putWall,
  zeroGammaFlip,
  mode,
  hoveredIdx,
  onHoverIdx,
  onClickStrike,
}) => {
  if (strikes.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[11.5px] text-[#787b86] font-mono">
        No active strikes with gamma exposure in selected window.
      </div>
    );
  }

  const W = 560;
  const H = 220;
  const padL = 54;
  const padR = 14;
  const padT = 20;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let maxAbs = 0.01;
  for (const s of strikes) {
    if (mode === 'split') {
      maxAbs = Math.max(maxAbs, Math.abs(s.callGex), Math.abs(s.putGex), Math.abs(s.netGex));
    } else {
      maxAbs = Math.max(maxAbs, Math.abs(s.netGex));
    }
  }
  maxAbs *= 1.12;

  const yOf = (val: number) => padT + ((maxAbs - val) / (2 * maxAbs)) * plotH;
  const zeroY = yOf(0);
  const stepW = plotW / strikes.length;
  const barW = Math.max(2, Math.min(18, stepW * 0.68));
  const xOfIdx = (i: number) => padL + (i + 0.5) * stepW;

  const findNearestXForPrice = (price: number | null): number | null => {
    if (!price || strikes.length === 0) return null;
    if (price <= strikes[0].strike) return xOfIdx(0);
    if (price >= strikes[strikes.length - 1].strike) return xOfIdx(strikes.length - 1);
    for (let i = 1; i < strikes.length; i++) {
      const a = strikes[i - 1].strike;
      const b = strikes[i].strike;
      if (price >= a && price <= b) {
        const frac = b > a ? (price - a) / (b - a) : 0;
        return xOfIdx(i - 1) + frac * stepW;
      }
    }
    return null;
  };

  const spotX = findNearestXForPrice(spotPrice);
  const callWallX = findNearestXForPrice(callWall);
  const putWallX = findNearestXForPrice(putWall);
  const flipX = findNearestXForPrice(zeroGammaFlip);

  const netPolyline = strikes
    .map((s, i) => `${xOfIdx(i).toFixed(1)},${yOf(s.netGex).toFixed(1)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? strikes[hoveredIdx] : null;
  const labelStride = Math.max(1, Math.ceil(strikes.length / 8));

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[220px] overflow-visible"
        onMouseLeave={() => onHoverIdx(null)}
      >
        {/* Horizontal Grid + Y Labels */}
        {[maxAbs * 0.75, 0, -maxAbs * 0.75].map((tickVal, idx) => {
          const y = yOf(tickVal);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={tickVal === 0 ? '#363a45' : '#1b1f2a'}
                strokeWidth={tickVal === 0 ? 1.2 : 1}
              />
              <text
                x={padL - 5}
                y={y + 3}
                textAnchor="end"
                fill="#787b86"
                fontSize="9.5"
                fontFamily="monospace"
              >
                {tickVal === 0 ? '0' : formatGexM(tickVal)}
              </text>
            </g>
          );
        })}

        {/* Vertical Wall & Spot Markers (skip colliding top labels within 24px of Spot/CW/PW) */}
        {(() => {
          const markers: Array<{ key: string; x: number; label: string; color: string; dash: string; opacity: number }> = [];
          if (putWallX !== null) markers.push({ key: 'pw', x: putWallX, label: 'PW', color: '#f23645', dash: '3 3', opacity: 0.7 });
          if (callWallX !== null) markers.push({ key: 'cw', x: callWallX, label: 'CW', color: '#089981', dash: '3 3', opacity: 0.7 });
          if (flipX !== null) markers.push({ key: 'zf', x: flipX, label: 'ZF', color: '#f59e0b', dash: '2 2', opacity: 0.85 });
          if (spotX !== null) markers.push({ key: 'spot', x: spotX, label: 'Spot', color: '#ffffff', dash: '4 2', opacity: 0.9 });

          return markers.map((m) => {
            const tooCloseToSpot = m.key !== 'spot' && spotX !== null && Math.abs(m.x - spotX) < 22;
            const tooCloseToCw = m.key === 'pw' && callWallX !== null && Math.abs(m.x - callWallX) < 18;
            const showLabel = !tooCloseToSpot && !tooCloseToCw;
            return (
              <g key={m.key}>
                <line
                  x1={m.x}
                  y1={padT}
                  x2={m.x}
                  y2={H - padB}
                  stroke={m.color}
                  strokeWidth={m.key === 'spot' ? 1.2 : 1}
                  strokeDasharray={m.dash}
                  opacity={m.opacity}
                />
                {showLabel && (
                  <text x={m.x} y={11} textAnchor="middle" fill={m.color} fontSize="9" fontFamily="monospace">
                    {m.label}
                  </text>
                )}
              </g>
            );
          });
        })()}

        {/* Strike Bars */}
        {strikes.map((s, i) => {
          const cx = xOfIdx(i);
          const isHov = hoveredIdx === i;
          return (
            <g
              key={s.strike}
              className="cursor-pointer"
              onMouseEnter={() => onHoverIdx(i)}
              onClick={() => onClickStrike(s)}
            >
              <rect
                x={cx - stepW / 2}
                y={padT}
                width={stepW}
                height={plotH}
                fill={isHov ? 'rgba(255,255,255,0.05)' : 'transparent'}
              />
              {mode === 'split' ? (
                <>
                  {s.callGex > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={yOf(s.callGex)}
                      width={barW}
                      height={Math.max(1, zeroY - yOf(s.callGex))}
                      fill="#089981"
                      opacity={isHov ? 1 : 0.82}
                      rx="1"
                    />
                  )}
                  {s.putGex < 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={zeroY}
                      width={barW}
                      height={Math.max(1, yOf(s.putGex) - zeroY)}
                      fill="#f23645"
                      opacity={isHov ? 1 : 0.82}
                      rx="1"
                    />
                  )}
                </>
              ) : (
                <rect
                  x={cx - barW / 2}
                  y={s.netGex >= 0 ? yOf(s.netGex) : zeroY}
                  width={barW}
                  height={Math.max(1, Math.abs(yOf(s.netGex) - zeroY))}
                  fill={s.netGex >= 0 ? '#089981' : '#f23645'}
                  opacity={isHov ? 1 : 0.85}
                  rx="1"
                />
              )}

              {i % labelStride === 0 && (
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fill="#787b86"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {s.strike}
                </text>
              )}
            </g>
          );
        })}

        {/* Net GEX Overlay Line in Split Mode */}
        {mode === 'split' && strikes.length > 1 && (
          <polyline
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.4"
            opacity="0.85"
            points={netPolyline}
            className="pointer-events-none"
          />
        )}
      </svg>

      {hovered && (
        <div className="mt-1 px-2 py-1 rounded bg-[#0a0c12] border border-[#222631] flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono tabular-nums">
          <span className="text-white font-semibold">Strike ${hovered.strike}</span>
          <span className="text-[#089981]">Call {formatGexM(hovered.callGex)} ({hovered.callVolume}v)</span>
          <span className="text-[#f23645]">Put {formatGexM(hovered.putGex)} ({hovered.putVolume}v)</span>
          <span className={hovered.netGex >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
            Net {formatGexM(hovered.netGex)}
          </span>
        </div>
      )}
    </div>
  );
};

const GexFlipCurveChart: React.FC<{
  curve: Array<{ spot: number; netGex: number }>;
  spotPrice: number;
  zeroGammaFlip: number | null;
  hoveredIdx: number | null;
  onHoverIdx: (idx: number | null) => void;
}> = ({ curve, spotPrice, zeroGammaFlip, hoveredIdx, onHoverIdx }) => {
  if (curve.length < 2) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[11.5px] text-[#787b86] font-mono">
        Insufficient contracts with volume to compute Gamma Flip curve.
      </div>
    );
  }

  const W = 560;
  const H = 220;
  const padL = 54;
  const padR = 14;
  const padT = 20;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minS = curve[0].spot;
  const maxS = curve[curve.length - 1].spot;
  const minG = Math.min(0, ...curve.map((p) => p.netGex));
  const maxG = Math.max(0, ...curve.map((p) => p.netGex));
  const absMax = Math.max(0.01, Math.abs(minG), Math.abs(maxG)) * 1.12;

  const xOfSpot = (s: number) =>
    padL + ((s - minS) / Math.max(0.01, maxS - minS)) * plotW;
  const yOfGex = (g: number) => padT + ((absMax - g) / (2 * absMax)) * plotH;
  const zeroY = yOfGex(0);

  const linePoints = curve
    .map((p) => `${xOfSpot(p.spot).toFixed(1)},${yOfGex(p.netGex).toFixed(1)}`)
    .join(' ');
  const areaPath = `M ${xOfSpot(curve[0].spot).toFixed(1)} ${zeroY.toFixed(1)} ${curve
    .map((p) => `L ${xOfSpot(p.spot).toFixed(1)} ${yOfGex(p.netGex).toFixed(1)}`)
    .join(' ')} L ${xOfSpot(curve[curve.length - 1].spot).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const spotX = spotPrice >= minS && spotPrice <= maxS ? xOfSpot(spotPrice) : null;
  const flipX =
    zeroGammaFlip && zeroGammaFlip >= minS && zeroGammaFlip <= maxS
      ? xOfSpot(zeroGammaFlip)
      : null;

  const hovered = hoveredIdx !== null ? curve[hoveredIdx] : null;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minS + f * (maxS - minS));

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[220px] overflow-visible"
        onMouseLeave={() => onHoverIdx(null)}
      >
        <defs>
          <linearGradient id="gexCurveSplitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#089981" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#089981" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#f23645" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#f23645" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {[absMax * 0.75, 0, -absMax * 0.75].map((tickVal, idx) => {
          const y = yOfGex(tickVal);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={tickVal === 0 ? '#363a45' : '#1b1f2a'}
                strokeWidth={tickVal === 0 ? 1.2 : 1}
              />
              <text
                x={padL - 5}
                y={y + 3}
                textAnchor="end"
                fill="#787b86"
                fontSize="9.5"
                fontFamily="monospace"
              >
                {tickVal === 0 ? '0' : formatGexM(tickVal)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#gexCurveSplitGrad)" />
        <polyline fill="none" stroke="#94a3b8" strokeWidth="1.8" points={linePoints} />

        {spotX !== null && (
          <g>
            <line
              x1={spotX}
              y1={padT}
              x2={spotX}
              y2={H - padB}
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeDasharray="4 2"
            />
            <text x={spotX} y={11} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace">
              Spot ${spotPrice.toFixed(2)}
            </text>
          </g>
        )}

        {flipX !== null && zeroGammaFlip && (
          <g>
            <line
              x1={flipX}
              y1={padT}
              x2={flipX}
              y2={H - padB}
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
            <circle cx={flipX} cy={zeroY} r="4" fill="#f59e0b" stroke="#0d1017" strokeWidth="1.5" />
            <text
              x={flipX}
              y={zeroY - 8}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize="9.5"
              fontFamily="monospace"
            >
              Flip ${zeroGammaFlip.toFixed(2)}
            </text>
          </g>
        )}

        {xTicks.map((t, i) => (
          <text
            key={i}
            x={xOfSpot(t)}
            y={H - 6}
            textAnchor="middle"
            fill="#787b86"
            fontSize="9.5"
            fontFamily="monospace"
          >
            ${t.toFixed(0)}
          </text>
        ))}

        {/* Interactive Hover Columns */}
        {curve.map((p, i) => {
          const cx = xOfSpot(p.spot);
          const colW = plotW / curve.length;
          return (
            <g key={i} onMouseEnter={() => onHoverIdx(i)}>
              <rect
                x={cx - colW / 2}
                y={padT}
                width={colW}
                height={plotH}
                fill="transparent"
              />
              {hoveredIdx === i && (
                <>
                  <line
                    x1={cx}
                    y1={padT}
                    x2={cx}
                    y2={H - padB}
                    stroke="#64748b"
                    strokeWidth="1"
                  />
                  <circle
                    cx={cx}
                    cy={yOfGex(p.netGex)}
                    r="3.5"
                    fill={p.netGex >= 0 ? '#089981' : '#f23645'}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="mt-1 px-2 py-1 rounded bg-[#0a0c12] border border-[#222631] flex items-center justify-between text-[10.5px] font-mono tabular-nums">
          <span className="text-white">Sim Spot ${hovered.spot.toFixed(2)}</span>
          <span className={hovered.netGex >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
            Projected Net GEX {formatGexM(hovered.netGex)}
          </span>
        </div>
      )}
    </div>
  );
};

const OrderflowComboChart: React.FC<{
  buckets: OrderflowBucket[];
  hoveredIdx: number | null;
  onHoverIdx: (idx: number | null) => void;
}> = ({ buckets, hoveredIdx, onHoverIdx }) => {
  if (buckets.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[11.5px] text-[#787b86] font-mono">
        No time-bucketed flow prints available for this selection.
      </div>
    );
  }

  const W = 680;
  const H = 220;
  const padL = 48;
  const padR = 54;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxBarPrem = Math.max(
    1000,
    ...buckets.map((b) => Math.max(b.callPremium, b.putPremium))
  ) * 1.15;
  const yBarOf = (val: number) =>
    padT + ((maxBarPrem - val) / (2 * maxBarPrem)) * plotH;
  const zeroBarY = yBarOf(0);

  const cumVals = buckets.map((b) => b.cumNetPremium);
  const minCum = Math.min(0, ...cumVals);
  const maxCum = Math.max(0, ...cumVals);
  const cumSpan = Math.max(1000, maxCum - minCum);
  const yCumOf = (val: number) =>
    padT + ((maxCum - val) / cumSpan) * plotH;

  const stepW = plotW / buckets.length;
  const barW = Math.max(3, Math.min(20, stepW * 0.65));
  const xOfIdx = (i: number) => padL + (i + 0.5) * stepW;

  const cumLine = buckets
    .map((b, i) => `${xOfIdx(i).toFixed(1)},${yCumOf(b.cumNetPremium).toFixed(1)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null;
  const labelStride = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[220px] overflow-visible"
        onMouseLeave={() => onHoverIdx(null)}
      >
        {[maxBarPrem * 0.75, 0, -maxBarPrem * 0.75].map((tickVal, idx) => {
          const y = yBarOf(tickVal);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={tickVal === 0 ? '#363a45' : '#1b1f2a'}
                strokeWidth={tickVal === 0 ? 1.2 : 1}
              />
              <text
                x={padL - 5}
                y={y + 3}
                textAnchor="end"
                fill="#787b86"
                fontSize="9.5"
                fontFamily="monospace"
              >
                {tickVal === 0 ? '0' : formatPrem(tickVal)}
              </text>
            </g>
          );
        })}

        {/* Right Y-axis Labels for Cumulative Net Premium */}
        <text
          x={W - padR + 5}
          y={padT + 8}
          textAnchor="start"
          fill="#2962ff"
          fontSize="9.5"
          fontFamily="monospace"
        >
          {formatPrem(maxCum)}
        </text>
        <text
          x={W - padR + 5}
          y={H - padB}
          textAnchor="start"
          fill="#2962ff"
          fontSize="9.5"
          fontFamily="monospace"
        >
          {formatPrem(minCum)}
        </text>

        {buckets.map((b, i) => {
          const cx = xOfIdx(i);
          const isHov = hoveredIdx === i;
          return (
            <g key={b.timeSec} onMouseEnter={() => onHoverIdx(i)}>
              <rect
                x={cx - stepW / 2}
                y={padT}
                width={stepW}
                height={plotH}
                fill={isHov ? 'rgba(255,255,255,0.05)' : 'transparent'}
              />
              {b.callPremium > 0 && (
                <rect
                  x={cx - barW / 2}
                  y={yBarOf(b.callPremium)}
                  width={barW}
                  height={Math.max(1, zeroBarY - yBarOf(b.callPremium))}
                  fill="#089981"
                  opacity={isHov ? 1 : 0.8}
                  rx="1"
                />
              )}
              {b.putPremium > 0 && (
                <rect
                  x={cx - barW / 2}
                  y={zeroBarY}
                  width={barW}
                  height={Math.max(1, yBarOf(-b.putPremium) - zeroBarY)}
                  fill="#f23645"
                  opacity={isHov ? 1 : 0.8}
                  rx="1"
                />
              )}
              {i % labelStride === 0 && (
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fill="#787b86"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {b.label}
                </text>
              )}
            </g>
          );
        })}

        {buckets.length > 1 && (
          <polyline
            fill="none"
            stroke="#2962ff"
            strokeWidth="2"
            points={cumLine}
            className="pointer-events-none"
          />
        )}
      </svg>

      {hovered && (
        <div className="mt-1 px-2 py-1 rounded bg-[#0a0c12] border border-[#222631] flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono tabular-nums">
          <span className="text-white font-semibold">{hovered.label} ET</span>
          <span className="text-[#089981]">Call {formatPrem(hovered.callPremium)}</span>
          <span className="text-[#f23645]">Put {formatPrem(hovered.putPremium)}</span>
          <span className="text-[#2962ff]">Cum {formatPrem(hovered.cumNetPremium)}</span>
          {hovered.spotPrice && <span className="text-[#b2b5be]">Spot ${hovered.spotPrice.toFixed(2)}</span>}
        </div>
      )}
    </div>
  );
};
