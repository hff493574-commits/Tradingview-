import React, { useState, useRef } from 'react';
import { DrawingToolId } from '../types/trading';
import { getToolDisplayName } from '../utils/drawingEngine';

interface FloatingFavoritesToolbarProps {
  activeTool: DrawingToolId;
  favoriteToolIds: DrawingToolId[];
  onSelectTool: (tool: DrawingToolId) => void;
  onQuickPlaceTool: (tool: DrawingToolId) => void;
  visible: boolean;
}

export function renderDrawingToolIcon(toolId: DrawingToolId): React.ReactNode {
  switch (toolId) {
    case 'fib-levels':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="5" x2="21" y2="5" />
          <line x1="3" y1="9.5" x2="17" y2="9.5" />
          <circle cx="19" cy="9.5" r="2" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'liquidity-box':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="6" r="2" />
          <line x1="7" y1="6" x2="21" y2="6" />
          <text
            x="12"
            y="14"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="8.5"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            L
          </text>
          <line x1="7" y1="15.5" x2="21" y2="15.5" />
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'text-note':
    case 'callout':
    case 'price-label':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 7V5h14v2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
          <line x1="9" y1="19" x2="15" y2="19" strokeLinecap="round" />
        </svg>
      );
    case 'rectangle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="7" y1="5" x2="17" y2="5" />
          <line x1="7" y1="19" x2="17" y2="19" />
          <line x1="5" y1="7" x2="5" y2="17" />
          <line x1="19" y1="7" x2="19" y2="17" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    case 'stop-channel':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="6" r="2" />
          <line x1="7" y1="6" x2="21" y2="6" />
          <line x1="5" y1="10" x2="21" y2="10" />
          <text
            x="13"
            y="16"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="8"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            S
          </text>
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'volume-profile':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="6" y1="4" x2="6" y2="16.5" />
          <circle cx="6" cy="18.5" r="2" />
          <rect x="6" y="6" width="5" height="2.8" />
          <rect x="6" y="8.8" width="8" height="2.8" />
          <rect x="6" y="11.6" width="3.5" height="2.8" />
          <circle cx="19" cy="5.5" r="2" />
          <line x1="19" y1="7.5" x2="19" y2="20" />
        </svg>
      );
    case 'vertical-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="3.5" x2="12" y2="10" />
          <circle cx="12" cy="12" r="2" />
          <line x1="12" y1="14" x2="12" y2="20.5" />
        </svg>
      );
    case 'horizontal-ray':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="12" r="2" />
          <line x1="7.5" y1="12" x2="20.5" y2="12" />
        </svg>
      );
    case 'horizontal-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="12" x2="10" y2="12" />
          <circle cx="12" cy="12" r="2" />
          <line x1="14" y1="12" x2="21" y2="12" />
        </svg>
      );
    case 'candle-pattern':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="8" y1="4" x2="8" y2="7" />
          <rect x="6" y="7" width="4" height="9" />
          <line x1="8" y1="16" x2="8" y2="20" />
          <line x1="15" y1="3.5" x2="15" y2="6.5" />
          <rect x="13" y="6.5" width="4" height="8.5" />
          <line x1="15" y1="15" x2="15" y2="19.5" />
          <circle cx="4" cy="15.5" r="1.7" />
          <path d="M5.5 14.5 L11 12.5 L20 8" />
        </svg>
      );
    case 'wave-path':
    case 'elliott-wave':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 16.5 L8 11.5" />
          <circle cx="9.5" cy="10" r="1.8" />
          <path d="M11 11.2 L13.5 14" />
          <circle cx="15" cy="15.2" r="1.8" />
          <path d="M16.2 13.8 L20.5 8.5" />
          <path d="M16.5 8.5 H20.5 V12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'time-cycles':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="5" y1="4" x2="5" y2="8.5" />
          <circle cx="5" cy="10.5" r="1.8" />
          <line x1="5" y1="12.5" x2="5" y2="20" />
          <line x1="10.5" y1="4" x2="10.5" y2="14.5" />
          <circle cx="10.5" cy="16.5" r="1.8" />
          <line x1="10.5" y1="18.5" x2="10.5" y2="20" />
          <line x1="6.3" y1="11.8" x2="9.3" y2="15.2" strokeDasharray="1.8 1.8" />
          <line x1="15" y1="4" x2="15" y2="20" />
          <line x1="19.5" y1="4" x2="19.5" y2="20" />
        </svg>
      );
    case 'long-position':
    case 'short-position':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="7" fill="currentColor" fillOpacity="0.18" />
          <line x1="4" y1="11" x2="20" y2="11" strokeWidth="1.8" />
          <rect x="4" y="11" width="16" height="9" fill="currentColor" fillOpacity="0.06" />
        </svg>
      );
    case 'parallel-channel':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="4" y1="14" x2="18" y2="5" />
          <line x1="6" y1="19" x2="20" y2="10" />
          <line x1="5" y1="16.5" x2="19" y2="7.5" strokeDasharray="2 2" />
        </svg>
      );
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      );
    case 'triangle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="12,5 20,19 4,19" />
        </svg>
      );
    case 'brush':
    case 'highlighter':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 17c3-5 6-5 8-1s5 3 8-3" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="18.5" r="2" />
          <line x1="7" y1="17" x2="17" y2="7" />
          <circle cx="18.5" cy="5.5" r="2" />
        </svg>
      );
  }
}

export const DEFAULT_FAVORITE_TOOLS: DrawingToolId[] = [
  'fib-levels',
  'liquidity-box',
  'text-note',
  'rectangle',
  'stop-channel',
  'volume-profile',
  'vertical-line',
  'horizontal-ray',
  'candle-pattern',
  'wave-path',
  'time-cycles',
  'trend-line',
];

export const FloatingFavoritesToolbar: React.FC<FloatingFavoritesToolbarProps> = ({
  activeTool,
  favoriteToolIds,
  onSelectTool,
  onQuickPlaceTool,
  visible,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 76, y: 10 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  if (!visible || favoriteToolIds.length === 0) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvt.clientX - dragRef.current.startX;
      const dy = dragRef.current.startY - moveEvt.clientY;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 420, dragRef.current.origX + dx)),
        y: Math.max(4, Math.min(window.innerHeight - 100, dragRef.current.origY + dy)),
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={{ left: `${pos.x}px`, bottom: `${pos.y}px` }}
      className="absolute z-30 flex items-center bg-[#14161d]/80 backdrop-blur-2xl border border-white/12 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.65)] px-0.5 py-0.5 select-none"
      role="toolbar"
      aria-label="Favorite Drawing Tools"
    >
      {/* 6-Dot Drag Handle */}
      <button
        type="button"
        onMouseDown={handleMouseDown}
        aria-label="Drag Favorite Drawing Toolbar"
        title="Drag toolbar"
        className="flex items-center justify-center w-4 h-6 text-[#5d606b] hover:text-[#9598a1] cursor-grab active:cursor-grabbing shrink-0"
      >
        <svg viewBox="0 0 10 16" className="w-2 h-3" fill="currentColor">
          <circle cx="3" cy="3" r="1.1" />
          <circle cx="7" cy="3" r="1.1" />
          <circle cx="3" cy="8" r="1.1" />
          <circle cx="7" cy="8" r="1.1" />
          <circle cx="3" cy="13" r="1.1" />
          <circle cx="7" cy="13" r="1.1" />
        </svg>
      </button>

      {/* Favorite Drawing Tool Icons */}
      <div className="flex items-center gap-0.5">
        {favoriteToolIds.map((toolId) => {
          const isActive = activeTool === toolId;
          const label = getToolDisplayName(toolId);
          return (
            <button
              key={toolId}
              type="button"
              aria-label={label}
              title={`${label} — Click to draw on chart, double-click to auto-plot`}
              onClick={() => onSelectTool(isActive ? 'cursor' : toolId)}
              onDoubleClick={() => onQuickPlaceTool(toolId)}
              className={`flex items-center justify-center w-[25px] h-[24px] rounded-[4px] transition-colors shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] ${
                isActive
                  ? 'bg-[#2962ff] text-white'
                  : 'text-[#b2b5be] hover:bg-[#2a2e39] hover:text-white'
              }`}
            >
              {renderDrawingToolIcon(toolId)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
