import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
  BellPlus,
  Rewind,
  Lightbulb,
  SlidersHorizontal,
  Trash2,
  Sun,
  Moon,
  Settings,
} from 'lucide-react';
import { ChartStyleType, LAYOUT_PRESETS, LayoutSyncConfig } from '../types/trading';
import { buildCustomTimeframe } from '../utils/marketEngine';
import { LayoutGlyph, LayoutSelectorPopover } from './LayoutSelectorPopover';

interface TopToolbarProps {
  activeSymbol: string;
  onOpenSymbolSearch: (mode: 'switch' | 'compare') => void;
  activeTimeframe: string;
  timeframes: string[];
  customTimeframes: string[];
  onSelectTimeframe: (tf: string) => void;
  onAddCustomTimeframe: (tf: string) => void;
  onRemoveCustomTimeframe: (tf: string) => void;
  chartStyle: ChartStyleType;
  onSelectChartStyle: (style: ChartStyleType) => void;
  onOpenIndicators: () => void;
  activeIndicatorsCount: number;
  onOpenAlertModal: () => void;
  replayActive: boolean;
  onToggleReplay: () => void;
  onOpenTradeTicket: () => void;
  onOpenScreener: () => void;
  onOpenUsageModal: () => void;
  onOpenSettings: () => void;
  activeLayoutId: string;
  onSelectLayout: (layoutId: string) => void;
  layoutSync: LayoutSyncConfig;
  onToggleLayoutSync: (key: keyof LayoutSyncConfig) => void;
  alertBadgeCount: number;
  chartCanvasTheme: 'light' | 'dark';
  onToggleChartCanvasTheme: () => void;
  wsConnected: boolean;
  liveStreamEnabled: boolean;
  onToggleLiveStream: () => void;
  onOpenGexDashboard: () => void;
}

const CHART_STYLE_OPTIONS: Array<{ id: ChartStyleType; label: string }> = [
  { id: 'candles', label: 'Candles' },
  { id: 'hollow_candles', label: 'Hollow candles' },
  { id: 'bars', label: 'Bars (OHLC)' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'heikin_ashi', label: 'Heikin Ashi' },
];

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeSymbol,
  onOpenSymbolSearch,
  activeTimeframe,
  timeframes,
  customTimeframes,
  onSelectTimeframe,
  onAddCustomTimeframe,
  onRemoveCustomTimeframe,
  chartStyle,
  onSelectChartStyle,
  onOpenIndicators,
  activeIndicatorsCount,
  onOpenAlertModal,
  replayActive,
  onToggleReplay,
  onOpenTradeTicket,
  onOpenScreener,
  onOpenUsageModal,
  onOpenSettings,
  activeLayoutId,
  onSelectLayout,
  layoutSync,
  onToggleLayoutSync,
  alertBadgeCount,
  chartCanvasTheme,
  onToggleChartCanvasTheme,
  wsConnected,
  liveStreamEnabled,
  onToggleLiveStream,
  onOpenGexDashboard,
}) => {
  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [customVal, setCustomVal] = useState('7');
  const [customUnit, setCustomUnit] = useState<'s' | 'm' | 'h' | 'D' | 'W' | 'M'>('m');
  const [customError, setCustomError] = useState('');

  const tfMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tfMenuRef.current && !tfMenuRef.current.contains(e.target as Node)) {
        setTfMenuOpen(false);
      }
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
        setStyleMenuOpen(false);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLayoutPreset =
    LAYOUT_PRESETS.find((p) => p.id === activeLayoutId) || LAYOUT_PRESETS[0];

  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customVal, 10);
    const built = buildCustomTimeframe(num, customUnit);
    if (!built) {
      setCustomError('Enter an interval between 1 and 1000');
      return;
    }
    setCustomError('');
    onAddCustomTimeframe(built);
    onSelectTimeframe(built);
    setTfMenuOpen(false);
  };

  return (
    <header className="h-[34px] bg-[#0a0a0d] border-b border-[#222631] flex items-center justify-between px-1.5 select-none shrink-0 z-40">
      {/* Left & Center Controls */}
      <div className="flex items-center gap-0.5 min-w-0">
        {/* Account & LSE Feed Diagnostics Circle */}
        <button
          type="button"
          onClick={onOpenUsageModal}
          aria-label="LSE Data Feed Status and Quota"
          title="Open LSE Data 3.0 Quota & WebSocket Diagnostics"
          className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-[#1e222d] transition-colors shrink-0 mr-0.5"
        >
          <div className="w-5 h-5 rounded-full bg-[#363a45] flex items-center justify-center text-[10px] font-semibold text-[#d1d4dc]">
            TV
          </div>
          {alertBadgeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 bg-[#f23645] text-white text-[8px] font-bold leading-none px-1 py-[1px] rounded-full tabular-nums">
              {alertBadgeCount}
            </span>
          ) : (
            <span
              className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-[#0a0a0d] ${
                wsConnected && liveStreamEnabled ? 'bg-[#089981]' : 'bg-[#f59e0b]'
              }`}
            />
          )}
        </button>

        {/* Symbol Search Pill Button */}
        <div className="flex items-center bg-[#1c202b] hover:bg-[#252936] rounded-full h-[24px] px-2 gap-1.5 border border-[#2a2e39] transition-colors shrink-0">
          <button
            type="button"
            onClick={() => onOpenSymbolSearch('switch')}
            aria-label={`Symbol Search (${activeSymbol})`}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[#e0e3eb] tracking-tight whitespace-nowrap cursor-pointer"
          >
            <span>{activeSymbol}</span>
            <SlidersHorizontal className="w-3 h-3 text-[#9598a1]" />
          </button>
        </div>

        {/* Compare / Add Symbol (+) Circle Button */}
        <button
          type="button"
          onClick={() => onOpenSymbolSearch('compare')}
          aria-label="Compare or Add Symbol"
          title="Compare Overlay or Switch LSE Instrument"
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#1e222d] text-[#b2b5be] hover:text-white transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 rounded-full border border-[#b2b5be] p-0.5" />
        </button>

        <div className="h-4 w-[1px] bg-[#222631] mx-0.5 shrink-0" />

        {/* Timeframes Strip */}
        <div className="flex items-center gap-0.5 relative" ref={tfMenuRef}>
          {[...timeframes, ...customTimeframes].map((tf) => {
            const isActive = activeTimeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => onSelectTimeframe(tf)}
                aria-label={`Timeframe ${tf}`}
                className={`px-1.5 h-[24px] text-[12px] rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  isActive
                    ? 'bg-[#2a2e39] text-white font-semibold'
                    : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white font-normal'
                }`}
              >
                {tf}
              </button>
            );
          })}

          {/* Custom Timeframe Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setTfMenuOpen((v) => !v)}
            aria-label="Custom Timeframes Menu"
            aria-expanded={tfMenuOpen}
            title="Add or select custom timeframe"
            className={`flex items-center justify-center w-5 h-[24px] rounded transition-colors shrink-0 ${
              tfMenuOpen ? 'bg-[#2a2e39] text-white' : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Custom Timeframe Popover */}
          {tfMenuOpen && (
            <div className="absolute left-0 top-[34px] w-72 bg-[#16181f]/82 backdrop-blur-2xl border border-white/12 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.72)] p-3 z-50">
              <div className="text-[11px] font-semibold text-[#9598a1] uppercase tracking-wider mb-2">
                Add Custom Interval
              </div>
              <form onSubmit={handleAddCustomSubmit} className="flex items-center gap-1.5 mb-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  aria-label="Custom interval value"
                  className="w-16 h-8 bg-[#0f1117] border border-[#2a2e39] rounded px-2 text-xs text-white tabular-nums focus:outline-none focus:border-[#2962ff]"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as 's' | 'm' | 'h' | 'D' | 'W' | 'M')}
                  aria-label="Custom interval unit"
                  className="flex-1 h-8 bg-[#0f1117] border border-[#2a2e39] rounded px-2 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                >
                  <option value="s">Seconds (s)</option>
                  <option value="m">Minutes (m)</option>
                  <option value="h">Hours (h)</option>
                  <option value="D">Days (D)</option>
                  <option value="W">Weeks (W)</option>
                  <option value="M">Months (M)</option>
                </select>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0"
                >
                  Add
                </button>
              </form>
              {customError && <p className="text-[11px] text-[#f23645] mb-2">{customError}</p>}

              <div className="border-t border-[#2a2e39] pt-2 mt-1">
                <div className="text-[11px] text-[#787b86] mb-1.5">Seconds (LSE Live + History)</div>
                <div className="grid grid-cols-4 gap-1 mb-2.5">
                  {['1s', '5s', '15s', '30s'].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        if (!timeframes.includes(tf) && !customTimeframes.includes(tf)) {
                          onAddCustomTimeframe(tf);
                        }
                        onSelectTimeframe(tf);
                        setTfMenuOpen(false);
                      }}
                      className={`py-1 rounded border text-xs tabular-nums transition-colors ${
                        activeTimeframe === tf
                          ? 'bg-[#2962ff] border-[#2962ff] text-white font-semibold'
                          : 'bg-[#0f1117] border-[#2a2e39] text-[#d1d4dc] hover:bg-[#2a2e39]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-[#787b86] mb-1.5">Quick Presets & Custom Intervals</div>
                <div className="flex flex-wrap gap-1">
                  {['10s', '45s', '2m', '7m', '10m', '45m', '2h', '6h', '3D', ...customTimeframes]
                    .filter((v, idx, arr) => arr.indexOf(v) === idx)
                    .map((tf) => {
                      const isUserAdded = customTimeframes.includes(tf);
                      return (
                        <div
                          key={tf}
                          className="inline-flex items-center bg-[#0f1117] border border-[#2a2e39] rounded overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!timeframes.includes(tf) && !customTimeframes.includes(tf)) {
                                onAddCustomTimeframe(tf);
                              }
                              onSelectTimeframe(tf);
                              setTfMenuOpen(false);
                            }}
                            className={`px-2 py-1 text-xs tabular-nums transition-colors ${
                              activeTimeframe === tf
                                ? 'bg-[#2962ff] text-white font-semibold'
                                : 'text-[#d1d4dc] hover:bg-[#2a2e39]'
                            }`}
                          >
                            {tf}
                          </button>
                          {isUserAdded && (
                            <button
                              type="button"
                              onClick={() => onRemoveCustomTimeframe(tf)}
                              aria-label={`Remove custom timeframe ${tf}`}
                              className="px-1 py-1 text-[#787b86] hover:text-[#f23645]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#222631] mx-0.5 shrink-0" />

        {/* Chart Style Selector */}
        <div className="flex items-center gap-0.5 relative" ref={styleMenuRef}>
          <button
            type="button"
            onClick={() => onSelectChartStyle('candles')}
            aria-label="Candlestick Chart Style"
            title="Candles"
            className={`flex items-center justify-center w-6 h-[24px] rounded transition-colors shrink-0 ${
              chartStyle === 'candles' || chartStyle === 'hollow_candles' || chartStyle === 'heikin_ashi'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <line x1="8" y1="3" x2="8" y2="7" />
              <rect x="5.5" y="7" width="5" height="10" rx="0.5" />
              <line x1="8" y1="17" x2="8" y2="21" />
              <line x1="16" y1="5" x2="16" y2="9" />
              <rect x="13.5" y="9" width="5" height="7" rx="0.5" />
              <line x1="16" y1="16" x2="16" y2="20" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onSelectChartStyle(chartStyle === 'line' ? 'area' : 'line')}
            aria-label="Line or Area Chart Style"
            title="Line / Area"
            className={`flex items-center justify-center w-6 h-[24px] rounded transition-colors shrink-0 ${
              chartStyle === 'line' || chartStyle === 'area' || chartStyle === 'baseline'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <polyline points="3 17 9 11 13 15 21 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setStyleMenuOpen((v) => !v)}
            aria-label="More Chart Styles"
            aria-expanded={styleMenuOpen}
            className="flex items-center justify-center w-4 h-[24px] rounded text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors shrink-0"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {styleMenuOpen && (
            <div className="absolute left-0 top-[28px] w-44 bg-[#16181f]/82 backdrop-blur-2xl border border-white/12 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.72)] py-1 z-50">
              {CHART_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectChartStyle(opt.id);
                    setStyleMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    chartStyle === opt.id
                      ? 'bg-[#2962ff] text-white font-semibold'
                      : 'text-[#d1d4dc] hover:bg-[#2a2e39]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {chartStyle === opt.id && <span className="text-[10px]">Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#222631] mx-0.5 shrink-0" />

        {/* Indicators Button */}
        <button
          type="button"
          onClick={onOpenIndicators}
          aria-label="Indicators, Metrics, and Strategies"
          className="flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] text-[#d1d4dc] hover:bg-[#1e222d] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#b2b5be]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 4 3 5-6" />
          </svg>
          <span>Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span className="text-[10.5px] text-[#9598a1] tabular-nums">({activeIndicatorsCount})</span>
          )}
          <ChevronDown className="w-3 h-3 text-[#787b86]" />
        </button>

        <div className="h-4 w-[1px] bg-[#222631] mx-0.5 shrink-0" />

        {/* Alert Button */}
        <button
          type="button"
          onClick={onOpenAlertModal}
          aria-label="Create Price Alert"
          className="flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] text-[#d1d4dc] hover:bg-[#1e222d] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <BellPlus className="w-3.5 h-3.5 text-[#b2b5be]" />
          <span>Alert</span>
        </button>

        {/* Replay Button */}
        <button
          type="button"
          onClick={onToggleReplay}
          aria-label="Bar Replay Mode"
          className={`flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] transition-colors whitespace-nowrap shrink-0 ${
            replayActive
              ? 'bg-[#2962ff] text-white font-semibold'
              : 'text-[#d1d4dc] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          <Rewind className="w-3.5 h-3.5" />
          <span>Replay</span>
        </button>

        <div className="h-4 w-[1px] bg-[#222631] mx-0.5 shrink-0" />

        {/* 0DTE GEX & Orderflow Dashboard Button */}
        <button
          type="button"
          onClick={onOpenGexDashboard}
          aria-label="0DTE Options GEX and Orderflow Dashboard"
          title="Open 0DTE GEX Levels, Gamma Flip & Options Orderflow"
          className="flex items-center gap-1 px-2 h-[24px] rounded border border-[#2962ff]/40 bg-[#2962ff]/10 hover:bg-[#2962ff]/20 text-[11.5px] font-semibold text-[#e0e3eb] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <span>0DTE GEX</span>
        </button>
      </div>

      {/* Right Side Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Live WebSocket Indicator Button */}
        <button
          type="button"
          onClick={onToggleLiveStream}
          aria-label={liveStreamEnabled ? 'Pause Real-Time WebSocket Stream' : 'Resume Real-Time WebSocket Stream'}
          title={
            wsConnected
              ? liveStreamEnabled
                ? 'LSE Real-Time WebSocket Live (Click to pause)'
                : 'LSE WebSocket Paused (Click to resume)'
              : 'Connecting to LSE WebSocket feed...'
          }
          className="hidden xl:flex items-center gap-1 px-1.5 h-[22px] rounded text-[10.5px] text-[#9598a1] hover:text-white hover:bg-[#1e222d] transition-colors whitespace-nowrap shrink-0"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected && liveStreamEnabled ? 'bg-[#089981]' : 'bg-[#f59e0b]'
            }`}
          />
          <span>{liveStreamEnabled ? 'LSE LIVE' : 'WS PAUSED'}</span>
        </button>

        {/* Multi-Chart Layout Selector */}
        <div className="relative" ref={layoutMenuRef}>
          <button
            type="button"
            onClick={() => setLayoutMenuOpen((v) => !v)}
            aria-label="Select Layout"
            aria-expanded={layoutMenuOpen}
            title="Select Multiple Chart Layout"
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors shrink-0 ${
              layoutMenuOpen || activeLayoutId !== '1'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <LayoutGlyph preset={currentLayoutPreset} className="w-3.5 h-3.5" />
          </button>

          <LayoutSelectorPopover
            open={layoutMenuOpen}
            activeLayoutId={activeLayoutId}
            onSelectLayout={(id) => {
              onSelectLayout(id);
              setLayoutMenuOpen(false);
            }}
            syncConfig={layoutSync}
            onToggleSync={onToggleLayoutSync}
          />
        </div>

        {/* Chart Settings Gear Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Chart Settings"
          title="Chart Settings (Symbol, Status Line, Scales, Canvas)"
          className="flex items-center justify-center w-6 h-6 rounded text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Toggle White vs Dark Chart Canvas */}
        <button
          type="button"
          onClick={onToggleChartCanvasTheme}
          aria-label="Toggle Chart Canvas Theme"
          title={chartCanvasTheme === 'light' ? 'Switch chart canvas to Dark theme' : 'Switch chart canvas to White theme'}
          className="flex items-center justify-center w-6 h-6 rounded text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors shrink-0"
        >
          {chartCanvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Fundamentals & Screener Lightbulb Icon */}
        <button
          type="button"
          onClick={onOpenScreener}
          aria-label="Symbol Fundamentals and Factors"
          title="LSE Fundamentals, History & Corporate Factors"
          className="flex items-center justify-center w-6 h-6 rounded text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors shrink-0"
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </button>

        {/* Trade Outlined Pill Button */}
        <button
          type="button"
          onClick={onOpenTradeTicket}
          aria-label="Open Trade Panel"
          className="px-2.5 h-[24px] rounded-full border border-[#363a45] hover:border-[#5d606b] text-[11.5px] font-medium text-[#d1d4dc] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          Trade
        </button>

        {/* LSE Plan & Quota Pill Button */}
        <button
          type="button"
          onClick={onOpenUsageModal}
          aria-label="LSE Plan and API Quota"
          title="View LSE Data 3.0 Plan, Row Quota & WebSocket Status"
          className="flex items-center gap-1 px-2.5 h-[24px] rounded-full bg-[#f0f3fa] hover:bg-white text-[#0a0a0d] text-[11.5px] font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <span className="text-[11px]">⚡</span>
          <span>LSE Plan</span>
        </button>
      </div>
    </header>
  );
};
