import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface BottomBarProps {
  activeRange: string;
  onSelectRange: (range: string) => void;
  ethSession: 'ETH' | 'RTH';
  onToggleEthSession: () => void;
  backAdjusted: boolean;
  onToggleBackAdjusted: () => void;
  logScale: boolean;
  onToggleLogScale: () => void;
  autoScale: boolean;
  onToggleAutoScale: () => void;
}

const DATE_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

export const BottomBar: React.FC<BottomBarProps> = ({
  activeRange,
  onSelectRange,
  ethSession,
  onToggleEthSession,
  backAdjusted,
  onToggleBackAdjusted,
  logScale,
  onToggleLogScale,
  autoScale,
  onToggleAutoScale,
}) => {
  const [clockStr, setClockStr] = useState('01:30:59 AM UTC-5');

  useEffect(() => {
    // Keep a ticking clock starting at 01:30:59 AM UTC-5 matching Screenshot 1
    let offsetSeconds = 0;
    const baseSeconds = 1 * 3600 + 30 * 60 + 59;
    const timer = setInterval(() => {
      offsetSeconds += 1;
      const total = (baseSeconds + offsetSeconds) % 86400;
      const hh = Math.floor(total / 3600);
      const mm = Math.floor((total % 3600) / 60);
      const ss = total % 60;
      const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      setClockStr(
        `${String(displayH).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(
          2,
          '0'
        )} ${ampm} UTC-5`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="h-[34px] bg-[#0a0a0d] border-t border-[#222631] flex items-center justify-between px-3 text-[12px] text-[#b2b5be] select-none shrink-0 z-30">
      {/* Left Date Range Presets: 1D 5D 1M 3M 6M YTD 1Y 5Y All | Calendar */}
      <div className="flex items-center gap-1">
        {DATE_RANGES.map((range) => {
          const isActive = activeRange === range;
          return (
            <button
              key={range}
              type="button"
              onClick={() => onSelectRange(range)}
              aria-label={`Range ${range}`}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#2a2e39] text-white font-semibold'
                  : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
              }`}
            >
              {range}
            </button>
          );
        })}

        <div className="h-4 w-[1px] bg-[#222631] mx-1" />

        <button
          type="button"
          onClick={() => onSelectRange('1D')}
          aria-label="Go to Date"
          title="Go to Date"
          className="p-1 rounded hover:bg-[#1e222d] text-[#b2b5be] hover:text-white transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Clock & Session Controls: 01:30:59 AM UTC-5  ETH  B-ADJ */}
      <div className="flex items-center gap-2 font-mono text-[12px] tabular-nums">
        <span className="text-[#b2b5be]">{clockStr}</span>

        <button
          type="button"
          onClick={onToggleEthSession}
          aria-label="Toggle Electronic vs Regular Trading Hours"
          title="Electronic Trading Hours (ETH) / Regular Trading Hours (RTH)"
          className={`px-1.5 py-0.5 rounded transition-colors ${
            ethSession === 'ETH'
              ? 'text-[#d1d4dc] hover:bg-[#1e222d]'
              : 'bg-[#2962ff] text-white font-semibold'
          }`}
        >
          {ethSession}
        </button>

        <button
          type="button"
          onClick={onToggleBackAdjusted}
          aria-label="Adjust for contract changes (B-ADJ)"
          title="Back-adjust for continuous futures contract rollovers"
          className={`px-2 py-0.5 rounded transition-colors ${
            backAdjusted
              ? 'bg-[#2a2e39] text-white font-semibold'
              : 'text-[#9598a1] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          B-ADJ
        </button>

        <button
          type="button"
          onClick={onToggleLogScale}
          aria-label="Toggle Logarithmic Price Scale"
          className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] transition-colors ${
            logScale ? 'bg-[#2962ff] text-white font-semibold' : 'text-[#787b86] hover:text-white'
          }`}
        >
          log
        </button>

        <button
          type="button"
          onClick={onToggleAutoScale}
          aria-label="Toggle Auto Price Scale"
          className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] transition-colors ${
            autoScale ? 'text-[#2962ff] font-semibold' : 'text-[#787b86] hover:text-white'
          }`}
        >
          auto
        </button>
      </div>
    </footer>
  );
};
