import React from 'react';
import {
  Crosshair,
  TrendingUp,
  Sliders,
  Share2,
  GitCommit,
  Brush,
  Type,
  Heart,
  Ruler,
  ZoomIn,
  Magnet,
  Edit3,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { DrawingToolId } from '../types/trading';

interface LeftDrawingToolbarProps {
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  favoritesBarVisible: boolean;
  onToggleFavoritesBar: () => void;
  magnetActive: boolean;
  onToggleMagnet: () => void;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  drawingsLocked: boolean;
  onToggleLockDrawings: () => void;
  drawingsHidden: boolean;
  onToggleHideDrawings: () => void;
  onClearDrawings: () => void;
  onZoomIn: () => void;
}

export const LeftDrawingToolbar: React.FC<LeftDrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  favoritesBarVisible,
  onToggleFavoritesBar,
  magnetActive,
  onToggleMagnet,
  stayInDrawingMode,
  onToggleStayInDrawingMode,
  drawingsLocked,
  onToggleLockDrawings,
  drawingsHidden,
  onToggleHideDrawings,
  onClearDrawings,
  onZoomIn,
}) => {
  const topTools: Array<{ id: DrawingToolId; label: string; icon: React.ReactNode }> = [
    { id: 'cursor', label: 'Crosshair', icon: <Crosshair className="w-[18px] h-[18px]" /> },
    { id: 'trend-line', label: 'Trend Line Tools', icon: <TrendingUp className="w-[18px] h-[18px]" /> },
    { id: 'fib-levels', label: 'Gann and Fibonacci Tools', icon: <Sliders className="w-[18px] h-[18px]" /> },
    { id: 'wave-path', label: 'Geometric Patterns', icon: <Share2 className="w-[18px] h-[18px]" /> },
    { id: 'liquidity-box', label: 'Prediction and Measurement Tools', icon: <GitCommit className="w-[18px] h-[18px]" /> },
    { id: 'rectangle', label: 'Brush & Shapes', icon: <Brush className="w-[18px] h-[18px]" /> },
    { id: 'text-note', label: 'Annotation & Text', icon: <Type className="w-[18px] h-[18px]" /> },
  ];

  return (
    <aside
      aria-label="Drawing Tools Sidebar"
      className="w-[46px] bg-[#0a0a0d] border-r border-[#222631] flex flex-col items-center py-1.5 justify-between select-none shrink-0 z-30"
    >
      <div className="flex flex-col items-center gap-1 w-full">
        {topTools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              aria-label={tool.label}
              title={tool.label}
              className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-[#2a2e39] text-white'
                  : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
              }`}
            >
              {tool.icon}
            </button>
          );
        })}

        {/* Favorites Heart Icon (Toggles Floating Favorites Toolbar) */}
        <button
          type="button"
          onClick={onToggleFavoritesBar}
          aria-label="Toggle Favorite Drawing Tools Toolbar"
          title="Show/Hide Favorite Drawing Tools Toolbar"
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            favoritesBarVisible
              ? 'text-[#f7931a] bg-[#1e222d]'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          <Heart className="w-[18px] h-[18px]" />
        </button>

        <div className="w-6 h-[1px] bg-[#222631] my-0.5" />

        {/* Measure Tool */}
        <button
          type="button"
          onClick={() => onSelectTool(activeTool === 'measure' ? 'cursor' : 'measure')}
          aria-label="Measure Price and Time Range"
          title="Measure (Shift + Click)"
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            activeTool === 'measure'
              ? 'bg-[#2962ff] text-white'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          <Ruler className="w-[18px] h-[18px]" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom In Chart"
          title="Zoom In"
          className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
        >
          <ZoomIn className="w-[18px] h-[18px]" />
        </button>

        <div className="w-6 h-[1px] bg-[#222631] my-0.5" />

        {/* Magnet Mode — Highlighted in solid white rounded square when active, matching Screenshot 1! */}
        <button
          type="button"
          onClick={onToggleMagnet}
          aria-label="Magnet Mode"
          title={magnetActive ? 'Strong Magnet Mode Enabled (Snaps to OHLC)' : 'Enable Magnet Mode'}
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            magnetActive
              ? 'bg-[#f0f3fa] text-[#0a0a0d] shadow-sm'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          <Magnet className="w-[18px] h-[18px] -rotate-45" />
        </button>

        {/* Stay in Drawing Mode */}
        <button
          type="button"
          onClick={onToggleStayInDrawingMode}
          aria-label="Stay in Drawing Mode"
          title="Stay in Drawing Mode"
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            stayInDrawingMode
              ? 'bg-[#2962ff] text-white'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          <Edit3 className="w-[17px] h-[17px]" />
        </button>

        {/* Lock All Drawings */}
        <button
          type="button"
          onClick={onToggleLockDrawings}
          aria-label="Lock All Drawing Tools"
          title={drawingsLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            drawingsLocked
              ? 'bg-[#2a2e39] text-[#2962ff]'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          {drawingsLocked ? <Lock className="w-[17px] h-[17px]" /> : <Unlock className="w-[17px] h-[17px]" />}
        </button>

        {/* Hide All Drawings */}
        <button
          type="button"
          onClick={onToggleHideDrawings}
          aria-label="Hide All Drawings"
          title={drawingsHidden ? 'Show All Drawings' : 'Hide All Drawings'}
          className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
            drawingsHidden
              ? 'bg-[#2a2e39] text-[#f59e0b]'
              : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
          }`}
        >
          {drawingsHidden ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
        </button>
      </div>

      {/* Bottom Trash / Remove Objects Icon */}
      <div className="pt-1 border-t border-[#222631] w-full flex justify-center">
        <button
          type="button"
          onClick={onClearDrawings}
          aria-label="Remove Drawings"
          title="Remove all user drawings"
          className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-[#f23645] transition-colors"
        >
          <Trash2 className="w-[17px] h-[17px]" />
        </button>
      </div>
    </aside>
  );
};
