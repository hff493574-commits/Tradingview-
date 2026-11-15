import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CandlestickChart,
  AlignLeft,
  ArrowUpDown,
  Pencil,
  TrendingUp,
  Bell,
  Calendar,
  ChevronDown,
  Check,
} from 'lucide-react';
import { ChartSettingsConfig, getDefaultChartSettings } from '../types/trading';

export type SettingsTabId =
  | 'symbol'
  | 'status_line'
  | 'scales_and_lines'
  | 'canvas'
  | 'trading'
  | 'alerts'
  | 'events';

interface ChartSettingsModalProps {
  open: boolean;
  initialTab?: SettingsTabId;
  settings: ChartSettingsConfig;
  chartCanvasTheme: 'light' | 'dark';
  onPreviewSettings: (next: ChartSettingsConfig) => void;
  onCommitSettings: (next: ChartSettingsConfig, nextTheme?: 'light' | 'dark') => void;
  onCancelSettings: (original: ChartSettingsConfig) => void;
}

const TABS: Array<{ id: SettingsTabId; label: string; icon: React.ReactNode }> = [
  { id: 'symbol', label: 'Symbol', icon: <CandlestickChart className="w-4 h-4" /> },
  { id: 'status_line', label: 'Status line', icon: <AlignLeft className="w-4 h-4" /> },
  { id: 'scales_and_lines', label: 'Scales and lines', icon: <ArrowUpDown className="w-4 h-4" /> },
  { id: 'canvas', label: 'Canvas', icon: <Pencil className="w-4 h-4" /> },
  { id: 'trading', label: 'Trading', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
  { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
];

const TvCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  sublabel?: string;
}> = ({ checked, onChange, label, sublabel }) => (
  <label className="flex items-start gap-2.5 cursor-pointer select-none group">
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`mt-0.5 w-4 h-4 rounded-[3px] flex items-center justify-center border transition-colors shrink-0 ${
        checked
          ? 'bg-white border-white text-[#131722]'
          : 'bg-transparent border-white/35 group-hover:border-white/60 text-transparent'
      }`}
    >
      <Check className="w-3 h-3 stroke-[3]" />
    </button>
    <div className="flex flex-col">
      <span className="text-[13px] text-[#e0e3eb] leading-tight">{label}</span>
      {sublabel && <span className="text-[11px] text-[#868993] mt-0.5">{sublabel}</span>}
    </div>
  </label>
);

const ColorSwatchInput: React.FC<{
  value: string;
  onChange: (hex: string) => void;
  ariaLabel: string;
}> = ({ value, onChange, ariaLabel }) => (
  <label className="relative inline-flex items-center justify-center w-8 h-7 rounded-md border border-white/15 bg-white/5 hover:border-white/35 cursor-pointer overflow-hidden shrink-0">
    <span
      className="w-5 h-4 rounded-[3px] border border-black/20"
      style={{ backgroundColor: value }}
    />
    <input
      type="color"
      value={value.startsWith('#') && value.length === 7 ? value : '#2962ff'}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
    />
  </label>
);

const TEMPLATE_STORAGE_KEY = 'tv_lse_saved_settings_template_v1';

export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({
  open,
  initialTab = 'symbol',
  settings,
  chartCanvasTheme,
  onPreviewSettings,
  onCommitSettings,
  onCancelSettings,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [draft, setDraft] = useState<ChartSettingsConfig>(settings);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const snapshotRef = useRef<ChartSettingsConfig>(settings);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      snapshotRef.current = settings;
      setDraft(settings);
      setActiveTab(initialTab);
      setSavedToast(null);
      setTemplateMenuOpen(false);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!templateMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [templateMenuOpen]);

  if (!open) return null;

  const updateDraft = (patch: Partial<ChartSettingsConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPreviewSettings(next);
  };

  const triggerToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2200);
  };

  const applyTemplate = (preset: 'light' | 'dark' | 'slate' | 'saved') => {
    let next: ChartSettingsConfig;
    if (preset === 'light') {
      next = getDefaultChartSettings('light');
    } else if (preset === 'dark') {
      next = getDefaultChartSettings('dark');
    } else if (preset === 'slate') {
      const darkBase = getDefaultChartSettings('dark');
      next = {
        ...darkBase,
        useCustomCanvasColors: true,
        bgType: 'Gradient',
        bgColor: '#121622',
        bgColorBottom: '#0a0c12',
        vertGridColor: '#1d2232',
        horzGridColor: '#1d2232',
        watermarkMode: 'Visible',
        watermarkColor: 'rgba(224, 227, 235, 0.08)',
      };
    } else {
      try {
        const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        next = raw ? { ...getDefaultChartSettings(chartCanvasTheme), ...JSON.parse(raw) } : draft;
      } catch {
        next = draft;
      }
    }
    setDraft(next);
    onPreviewSettings(next);
    setTemplateMenuOpen(false);
    triggerToast('Template applied');
  };

  const saveCurrentTemplate = () => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(draft));
      triggerToast('Saved successfully');
    } catch {
      triggerToast('Saved to session');
    }
    setTemplateMenuOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Chart Settings"
      onClick={() => onCancelSettings(snapshotRef.current)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] h-[540px] max-h-[88vh] flex flex-col rounded-xl bg-[#16181f]/80 backdrop-blur-2xl border border-white/12 shadow-[0_28px_85px_rgba(0,0,0,0.75)] text-[#e0e3eb] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-[17px] font-semibold text-white tracking-tight">Settings</h2>
          <button
            type="button"
            onClick={() => onCancelSettings(snapshotRef.current)}
            aria-label="Close Settings"
            className="text-[#9598a1] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Left Tabs + Right Controls */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Navigation Rail */}
          <nav
            aria-label="Settings Categories"
            className="w-[185px] shrink-0 border-r border-white/10 p-2.5 flex flex-col gap-1 overflow-y-auto"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left ${
                    active
                      ? 'bg-white/12 text-white font-medium'
                      : 'text-[#b2b5be] hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <span className={active ? 'text-white' : 'text-[#868993]'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Form Scroll Container */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-[13px]">
            {activeTab === 'symbol' && (
              <>
                <div className="space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Candles
                  </div>
                  <TvCheckbox
                    checked={draft.colorBarsOnPrevClose}
                    onChange={(v) => updateDraft({ colorBarsOnPrevClose: v })}
                    label="Color bars based on previous close"
                  />

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.showBody}
                      onChange={(v) => updateDraft({ showBody: v })}
                      label="Body"
                    />
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={draft.bodyUpColor}
                        onChange={(c) =>
                          updateDraft({ bodyUpColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Body Up Color"
                      />
                      <ColorSwatchInput
                        value={draft.bodyDownColor}
                        onChange={(c) =>
                          updateDraft({ bodyDownColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Body Down Color"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.showBorders}
                      onChange={(v) => updateDraft({ showBorders: v })}
                      label="Borders"
                    />
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={draft.borderUpColor}
                        onChange={(c) =>
                          updateDraft({ borderUpColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Border Up Color"
                      />
                      <ColorSwatchInput
                        value={draft.borderDownColor}
                        onChange={(c) =>
                          updateDraft({ borderDownColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Border Down Color"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.showWick}
                      onChange={(v) => updateDraft({ showWick: v })}
                      label="Wick"
                    />
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={draft.wickUpColor}
                        onChange={(c) =>
                          updateDraft({ wickUpColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Wick Up Color"
                      />
                      <ColorSwatchInput
                        value={draft.wickDownColor}
                        onChange={(c) =>
                          updateDraft({ wickDownColor: c, useCustomCandleColors: true })
                        }
                        ariaLabel="Candle Wick Down Color"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Data Modification
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Precision</span>
                    <select
                      value={draft.precision}
                      onChange={(e) =>
                        updateDraft({
                          precision: e.target.value as ChartSettingsConfig['precision'],
                        })
                      }
                      aria-label="Price Precision"
                      className="w-40 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    >
                      <option value="Default" className="bg-[#181b24]">Default</option>
                      <option value="1" className="bg-[#181b24]">1 decimal (0.1)</option>
                      <option value="2" className="bg-[#181b24]">2 decimals (0.01)</option>
                      <option value="3" className="bg-[#181b24]">3 decimals (0.001)</option>
                      <option value="4" className="bg-[#181b24]">4 decimals (0.0001)</option>
                      <option value="5" className="bg-[#181b24]">5 decimals (0.00001)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'status_line' && (
              <>
                <div className="space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Instrument
                  </div>
                  <TvCheckbox
                    checked={draft.showLogo}
                    onChange={(v) => updateDraft({ showLogo: v })}
                    label="Logo"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.showTitle}
                      onChange={(v) => updateDraft({ showTitle: v })}
                      label="Title"
                    />
                    <select
                      value={draft.titleMode}
                      onChange={(e) =>
                        updateDraft({
                          titleMode: e.target.value as ChartSettingsConfig['titleMode'],
                        })
                      }
                      aria-label="Title Display Mode"
                      className="w-36 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    >
                      <option value="Name" className="bg-[#181b24]">Name</option>
                      <option value="Ticker" className="bg-[#181b24]">Ticker</option>
                      <option value="Description" className="bg-[#181b24]">Description</option>
                    </select>
                  </div>
                  <TvCheckbox
                    checked={draft.showOhlcValues}
                    onChange={(v) => updateDraft({ showOhlcValues: v })}
                    label="Chart values"
                  />
                  <TvCheckbox
                    checked={draft.showBarChangeValues}
                    onChange={(v) => updateDraft({ showBarChangeValues: v })}
                    label="Bar change values"
                  />
                  <TvCheckbox
                    checked={draft.showVolumeInLegend}
                    onChange={(v) => updateDraft({ showVolumeInLegend: v })}
                    label="Volume"
                  />
                  <TvCheckbox
                    checked={draft.showLastDayChange}
                    onChange={(v) => updateDraft({ showLastDayChange: v })}
                    label="Last day change values"
                  />
                  <TvCheckbox
                    checked={draft.showBuySellButtons}
                    onChange={(v) => updateDraft({ showBuySellButtons: v })}
                    label="Buy/sell buttons"
                    sublabel="Displays buy and sell buttons directly on the chart"
                  />
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Indicators
                  </div>
                  <TvCheckbox
                    checked={draft.showIndicatorsLegend}
                    onChange={(v) => updateDraft({ showIndicatorsLegend: v })}
                    label="Indicator titles & arguments"
                  />
                </div>
              </>
            )}

            {activeTab === 'scales_and_lines' && (
              <>
                <div className="space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Price Scale
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Currency and Unit</span>
                    <select
                      value={draft.currencyUnitVisibility}
                      onChange={(e) =>
                        updateDraft({
                          currencyUnitVisibility: e.target
                            .value as ChartSettingsConfig['currencyUnitVisibility'],
                        })
                      }
                      aria-label="Currency and Unit Visibility"
                      className="w-44 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    >
                      <option value="Always visible" className="bg-[#181b24]">Always visible</option>
                      <option value="Visible on mouse over" className="bg-[#181b24]">Visible on mouse over</option>
                      <option value="Hidden" className="bg-[#181b24]">Hidden</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Scale modes (A and L)</span>
                    <select
                      value={draft.scaleModesVisibility}
                      onChange={(e) =>
                        updateDraft({
                          scaleModesVisibility: e.target
                            .value as ChartSettingsConfig['scaleModesVisibility'],
                        })
                      }
                      aria-label="Scale Modes Visibility"
                      className="w-44 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    >
                      <option value="Always visible" className="bg-[#181b24]">Always visible</option>
                      <option value="Visible on tap" className="bg-[#181b24]">Visible on tap</option>
                      <option value="Always hidden" className="bg-[#181b24]">Always hidden</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.lockPriceToBarRatio}
                      onChange={(v) => updateDraft({ lockPriceToBarRatio: v })}
                      label="Lock price to bar ratio"
                    />
                    <input
                      type="number"
                      step="0.01"
                      disabled={!draft.lockPriceToBarRatio}
                      value={draft.priceToBarRatio}
                      onChange={(e) =>
                        updateDraft({ priceToBarRatio: parseFloat(e.target.value) || 0.85 })
                      }
                      aria-label="Price to bar ratio"
                      className="w-44 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs font-mono text-white disabled:opacity-45 focus:outline-none focus:border-[#2962ff]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Scales placement</span>
                    <select
                      value={draft.scalesPlacement}
                      onChange={(e) =>
                        updateDraft({
                          scalesPlacement: e.target.value as ChartSettingsConfig['scalesPlacement'],
                        })
                      }
                      aria-label="Scales Placement"
                      className="w-44 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    >
                      <option value="Auto" className="bg-[#181b24]">Auto</option>
                      <option value="Right" className="bg-[#181b24]">Right</option>
                      <option value="Left" className="bg-[#181b24]">Left</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Price Labels & Lines
                  </div>
                  <TvCheckbox
                    checked={draft.noOverlappingLabels}
                    onChange={(v) => updateDraft({ noOverlappingLabels: v })}
                    label="No overlapping labels"
                  />
                  <TvCheckbox
                    checked={draft.plusButton}
                    onChange={(v) => updateDraft({ plusButton: v })}
                    label="Plus button"
                  />
                  <TvCheckbox
                    checked={draft.countdownToBarClose}
                    onChange={(v) => updateDraft({ countdownToBarClose: v })}
                    label="Countdown to bar close"
                  />

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Symbol last price</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={draft.symbolLastPriceMode}
                        onChange={(e) =>
                          updateDraft({
                            symbolLastPriceMode: e.target
                              .value as ChartSettingsConfig['symbolLastPriceMode'],
                          })
                        }
                        aria-label="Symbol last price display"
                        className="w-36 h-8 bg-white/8 border border-white/15 rounded-md px-2 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                      >
                        <option value="Name, value, line" className="bg-[#181b24]">Name, value, line</option>
                        <option value="Value, line" className="bg-[#181b24]">Value, line</option>
                        <option value="Line only" className="bg-[#181b24]">Line only</option>
                      </select>
                      <ColorSwatchInput
                        value={draft.lastPriceColor}
                        onChange={(c) => updateDraft({ lastPriceColor: c })}
                        ariaLabel="Last Price Color"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'canvas' && (
              <>
                <div className="space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Chart Basic Styles
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Background</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={draft.bgType}
                        onChange={(e) =>
                          updateDraft({
                            bgType: e.target.value as 'Solid' | 'Gradient',
                            useCustomCanvasColors: true,
                          })
                        }
                        aria-label="Background Type"
                        className="w-32 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                      >
                        <option value="Solid" className="bg-[#181b24]">Solid</option>
                        <option value="Gradient" className="bg-[#181b24]">Gradient</option>
                      </select>
                      <ColorSwatchInput
                        value={draft.bgColor}
                        onChange={(c) => updateDraft({ bgColor: c, useCustomCanvasColors: true })}
                        ariaLabel="Background Primary Color"
                      />
                      {draft.bgType === 'Gradient' && (
                        <ColorSwatchInput
                          value={draft.bgColorBottom}
                          onChange={(c) =>
                            updateDraft({ bgColorBottom: c, useCustomCanvasColors: true })
                          }
                          ariaLabel="Background Bottom Color"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.vertGridLines}
                      onChange={(v) => updateDraft({ vertGridLines: v })}
                      label="Vertical grid lines"
                    />
                    <ColorSwatchInput
                      value={draft.vertGridColor}
                      onChange={(c) =>
                        updateDraft({ vertGridColor: c, useCustomCanvasColors: true })
                      }
                      ariaLabel="Vertical Grid Lines Color"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <TvCheckbox
                      checked={draft.horzGridLines}
                      onChange={(v) => updateDraft({ horzGridLines: v })}
                      label="Horizontal grid lines"
                    />
                    <ColorSwatchInput
                      value={draft.horzGridColor}
                      onChange={(c) =>
                        updateDraft({ horzGridColor: c, useCustomCanvasColors: true })
                      }
                      ariaLabel="Horizontal Grid Lines Color"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Crosshair</span>
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={draft.crosshairColor}
                        onChange={(c) =>
                          updateDraft({ crosshairColor: c, useCustomCanvasColors: true })
                        }
                        ariaLabel="Crosshair Color"
                      />
                      <select
                        value={draft.crosshairStyle}
                        onChange={(e) =>
                          updateDraft({
                            crosshairStyle: e.target.value as 'dashed' | 'dotted' | 'solid',
                          })
                        }
                        aria-label="Crosshair Style"
                        className="w-24 h-8 bg-white/8 border border-white/15 rounded-md px-2 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                      >
                        <option value="dashed" className="bg-[#181b24]">Dashed</option>
                        <option value="dotted" className="bg-[#181b24]">Dotted</option>
                        <option value="solid" className="bg-[#181b24]">Solid</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Watermark</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={draft.watermarkMode}
                        onChange={(e) =>
                          updateDraft({ watermarkMode: e.target.value as 'Hidden' | 'Visible' })
                        }
                        aria-label="Watermark Visibility"
                        className="w-32 h-8 bg-white/8 border border-white/15 rounded-md px-2.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                      >
                        <option value="Hidden" className="bg-[#181b24]">Hidden</option>
                        <option value="Visible" className="bg-[#181b24]">Visible</option>
                      </select>
                      <ColorSwatchInput
                        value={draft.watermarkColor}
                        onChange={(c) => updateDraft({ watermarkColor: c })}
                        ariaLabel="Watermark Color"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3.5">
                  <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                    Scales
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Text</span>
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={draft.scalesTextColor}
                        onChange={(c) =>
                          updateDraft({ scalesTextColor: c, useCustomCanvasColors: true })
                        }
                        ariaLabel="Scales Text Color"
                      />
                      <select
                        value={draft.scalesFontSize}
                        onChange={(e) =>
                          updateDraft({ scalesFontSize: parseInt(e.target.value, 10) || 11 })
                        }
                        aria-label="Scales Font Size"
                        className="w-24 h-8 bg-white/8 border border-white/15 rounded-md px-2 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                      >
                        {[10, 11, 12, 13, 14].map((sz) => (
                          <option key={sz} value={sz} className="bg-[#181b24]">
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#e0e3eb]">Lines</span>
                    <ColorSwatchInput
                      value={draft.scalesLinesColor}
                      onChange={(c) =>
                        updateDraft({ scalesLinesColor: c, useCustomCanvasColors: true })
                      }
                      ariaLabel="Scales Lines Color"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'trading' && (
              <div className="space-y-3.5">
                <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                  General
                </div>
                <TvCheckbox
                  checked={draft.showBuySellButtons}
                  onChange={(v) => updateDraft({ showBuySellButtons: v })}
                  label="Buy/sell buttons"
                  sublabel="Quick execution bid/ask controls on the upper-left chart canvas"
                />
                <TvCheckbox
                  checked={draft.instantOrdersPlacement}
                  onChange={(v) => updateDraft({ instantOrdersPlacement: v })}
                  label="Instant orders placement"
                />
                <TvCheckbox
                  checked={draft.showPositionsOnChart}
                  onChange={(v) => updateDraft({ showPositionsOnChart: v })}
                  label="Positions on chart"
                />
                <TvCheckbox
                  checked={draft.showOrdersOnChart}
                  onChange={(v) => updateDraft({ showOrdersOnChart: v })}
                  label="Orders & brackets"
                />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-3.5">
                <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                  Alerts Display
                </div>
                <TvCheckbox
                  checked={draft.showAlertsOnChart}
                  onChange={(v) => updateDraft({ showAlertsOnChart: v })}
                  label="Show alert lines on chart"
                />
                <TvCheckbox
                  checked={draft.onlyActiveAlerts}
                  onChange={(v) => updateDraft({ onlyActiveAlerts: v })}
                  label="Only active alerts"
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#e0e3eb]">Alert line color</span>
                  <ColorSwatchInput
                    value={draft.alertLineColor}
                    onChange={(c) => updateDraft({ alertLineColor: c })}
                    ariaLabel="Alert Line Color"
                  />
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-3.5">
                <div className="text-[11px] font-semibold tracking-wider text-[#868993] uppercase">
                  Corporate Actions & Macro Events
                </div>
                <TvCheckbox
                  checked={draft.showEconomicEvents}
                  onChange={(v) => updateDraft({ showEconomicEvents: v })}
                  label="Economic events marker on timeline"
                />
                <TvCheckbox
                  checked={draft.showDividends}
                  onChange={(v) => updateDraft({ showDividends: v })}
                  label="Dividends"
                />
                <TvCheckbox
                  checked={draft.showSplits}
                  onChange={(v) => updateDraft({ showSplits: v })}
                  label="Splits"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-5 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="relative" ref={templateMenuRef}>
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((v) => !v)}
              className="h-9 px-3.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-[13px] text-[#e0e3eb] flex items-center gap-2 transition-colors"
            >
              <span>Template</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#868993]" />
            </button>

            {templateMenuOpen && (
              <div className="absolute left-0 bottom-11 w-52 rounded-lg bg-[#1c1f29]/95 backdrop-blur-2xl border border-white/15 shadow-2xl py-1.5 z-50 text-[12.5px]">
                <button
                  type="button"
                  onClick={saveCurrentTemplate}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-white font-medium"
                >
                  Save As Template...
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('saved')}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-[#d1d4dc]"
                >
                  Load Saved Template
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={() => applyTemplate('light')}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-[#d1d4dc]"
                >
                  Apply TradingView Light
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('dark')}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-[#d1d4dc]"
                >
                  Apply TradingView Dark
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('slate')}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-[#d1d4dc]"
                >
                  Apply Gradient Slate
                </button>
              </div>
            )}
          </div>

          {savedToast && (
            <div className="px-4 py-1.5 rounded-lg bg-[#222631]/90 border border-white/10 text-[12px] text-white shadow-lg">
              {savedToast}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onCancelSettings(snapshotRef.current)}
              className="h-9 px-4 rounded-lg border border-white/25 hover:bg-white/8 text-[13px] font-medium text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onCommitSettings(draft);
              }}
              className="h-9 px-5 rounded-lg bg-white hover:bg-[#e8eaef] text-[#0a0a0d] text-[13px] font-semibold transition-colors"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
