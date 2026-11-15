import React from 'react';
import { LAYOUT_PRESETS, LayoutPreset, LayoutSyncConfig } from '../types/trading';

interface LayoutSelectorPopoverProps {
  open: boolean;
  activeLayoutId: string;
  onSelectLayout: (layoutId: string) => void;
  syncConfig: LayoutSyncConfig;
  onToggleSync: (key: keyof LayoutSyncConfig) => void;
}

const ROW_GROUPS: Array<{ count: number }> = [
  { count: 1 },
  { count: 2 },
  { count: 3 },
  { count: 4 },
  { count: 6 },
  { count: 8 },
];

export const LayoutGlyph: React.FC<{ preset: LayoutPreset; active?: boolean; className?: string }> = ({
  preset,
  active = false,
  className = 'w-5 h-5',
}) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    {preset.svgRects.map(([x, y, w, h], idx) => (
      <rect
        key={idx}
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ))}
  </svg>
);

const SYNC_ITEMS: Array<{ key: keyof LayoutSyncConfig; label: string; info: string }> = [
  { key: 'symbol', label: 'Symbol', info: 'Synchronize active instrument across all charts' },
  { key: 'interval', label: 'Interval', info: 'Synchronize timeframe across all charts' },
  { key: 'crosshair', label: 'Crosshair', info: 'Mirror crosshair cursor time & price across panes' },
  { key: 'time', label: 'Time', info: 'Synchronize horizontal chart scroll position' },
  { key: 'dateRange', label: 'Date range', info: 'Synchronize bottom date range preset across panes' },
];

export const LayoutSelectorPopover: React.FC<LayoutSelectorPopoverProps> = ({
  open,
  activeLayoutId,
  onSelectLayout,
  syncConfig,
  onToggleSync,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Select Chart Layout"
      className="absolute right-0 top-[34px] w-[320px] rounded-xl bg-[#16181f]/82 backdrop-blur-2xl border border-white/12 shadow-[0_24px_70px_rgba(0,0,0,0.72)] p-3 z-50 text-[#e0e3eb]"
    >
      {/* Grid Variants Grouped by Pane Count */}
      <div className="space-y-1.5 divide-y divide-white/8">
        {ROW_GROUPS.map((grp, gIdx) => {
          const items = LAYOUT_PRESETS.filter((p) => p.count === grp.count);
          return (
            <div
              key={grp.count}
              className={`flex items-center gap-2 ${gIdx > 0 ? 'pt-1.5' : ''}`}
            >
              <span className="w-5 text-[11px] font-mono text-[#787b86] shrink-0 text-center">
                {grp.count}
              </span>
              <div className="flex items-center flex-wrap gap-1.5">
                {items.map((preset) => {
                  const isActive = preset.id === activeLayoutId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectLayout(preset.id)}
                      aria-label={`Layout ${preset.id}`}
                      title={`${preset.count} chart${preset.count > 1 ? 's' : ''} (${preset.id})`}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-white text-[#0a0a0d] shadow-sm'
                          : 'text-[#d1d4dc] hover:bg-white/12 hover:text-white'
                      }`}
                    >
                      <LayoutGlyph preset={preset} active={false} className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync in Layout Toggles */}
      <div className="mt-3 pt-2.5 border-t border-white/10">
        <div className="text-[10.5px] font-semibold tracking-wider text-[#787b86] uppercase mb-2">
          Sync in Layout
        </div>
        <div className="space-y-2">
          {SYNC_ITEMS.map((item) => {
            const enabled = syncConfig[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center justify-between text-[12.5px]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[#e0e3eb]">{item.label}</span>
                  <span
                    title={item.info}
                    className="w-3.5 h-3.5 rounded-full bg-white/12 text-[#868993] text-[9px] font-bold inline-flex items-center justify-center cursor-help"
                  >
                    i
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Sync ${item.label}`}
                  onClick={() => onToggleSync(item.key)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    enabled ? 'bg-white' : 'bg-white/18'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                      enabled
                        ? 'translate-x-[18px] bg-[#0a0a0d]'
                        : 'translate-x-0.5 bg-[#b2b5be]'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
