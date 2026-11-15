import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Trash2,
  Copy,
  Type,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ChartDrawing, LineStyleType } from '../types/trading';
import { getToolDisplayName } from '../utils/drawingEngine';

interface DrawingPropertiesBarProps {
  drawing: ChartDrawing;
  onUpdate: (updated: ChartDrawing) => void;
  onClone: (drawing: ChartDrawing) => void;
  onDelete: (id: string) => void;
  onRequestEditText: (drawing: ChartDrawing) => void;
}

const TV_COLORS = [
  '#2962ff',
  '#089981',
  '#f23645',
  '#ff9800',
  '#9c27b0',
  '#ffeb3b',
  '#00bcd4',
  '#ffffff',
  '#787b86',
  '#131722',
];

export const DrawingPropertiesBar: React.FC<DrawingPropertiesBarProps> = ({
  drawing,
  onUpdate,
  onClone,
  onDelete,
  onRequestEditText,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 320, y: 36 });
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [widthMenuOpen, setWidthMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const clampToParent = () => {
      const el = barRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8);
      const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8);
      setPos((prev) => {
        const nx = Math.max(8, Math.min(maxX, prev.x));
        const ny = Math.max(8, Math.min(maxY, prev.y));
        return nx === prev.x && ny === prev.y ? prev : { x: nx, y: ny };
      });
    };
    clampToParent();
    const parent = barRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(clampToParent);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const el = barRef.current;
      const parent = el?.parentElement;
      const maxX = parent && el ? Math.max(8, parent.clientWidth - el.offsetWidth - 8) : window.innerWidth - 360;
      const maxY = parent && el ? Math.max(8, parent.clientHeight - el.offsetHeight - 8) : window.innerHeight - 140;
      setPos({
        x: Math.max(8, Math.min(maxX, dragRef.current.origX + ev.clientX - dragRef.current.startX)),
        y: Math.max(8, Math.min(maxY, dragRef.current.origY + ev.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const lineWidth = drawing.lineWidth ?? 1.8;
  const lineStyle = drawing.lineStyle ?? 'solid';

  return (
    <div
      ref={barRef}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Selected Drawing Properties"
      className="absolute z-40 flex items-center gap-0.5 bg-[#16181f]/82 backdrop-blur-2xl border border-white/12 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.65)] px-1 py-0.5 text-[11px] text-[#d1d4dc] select-none max-w-[calc(100%-16px)]"
    >
      {/* Drag Handle */}
      <button
        type="button"
        onMouseDown={handleDragStart}
        aria-label="Drag Drawing Properties Bar"
        className="w-3.5 h-5 flex items-center justify-center text-[#5d606b] hover:text-[#9598a1] cursor-grab active:cursor-grabbing"
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

      {/* Tool Name Tag */}
      <span className="px-1 text-[10.5px] font-medium text-[#9598a1] border-r border-[#2a2e39] mr-0.5 whitespace-nowrap">
        {getToolDisplayName(drawing.tool)}
      </span>

      {/* Color Swatch Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setColorMenuOpen((v) => !v);
            setWidthMenuOpen(false);
            setStyleMenuOpen(false);
          }}
          aria-label="Drawing Color"
          title="Line / Shape Color"
          className="w-6 h-6 rounded hover:bg-[#2a2e39] flex items-center justify-center"
        >
          <span
            style={{ backgroundColor: drawing.color }}
            className="w-3.5 h-3.5 rounded-xs border border-[#434651]"
          />
        </button>

        {colorMenuOpen && (
          <div className="absolute left-0 top-7 p-2 bg-[#16181f]/85 backdrop-blur-2xl border border-white/12 rounded-lg shadow-2xl grid grid-cols-5 gap-1.5 w-[134px] z-50">
            {TV_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => {
                  onUpdate({ ...drawing, color: c });
                  setColorMenuOpen(false);
                }}
                style={{ backgroundColor: c }}
                className={`w-4.5 h-4.5 rounded-xs border ${
                  drawing.color === c ? 'border-white scale-110' : 'border-[#363a45]'
                } transition-transform`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Line Width Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setWidthMenuOpen((v) => !v);
            setColorMenuOpen(false);
            setStyleMenuOpen(false);
          }}
          aria-label="Line Thickness"
          title="Line Thickness"
          className="h-6 px-1.5 rounded hover:bg-[#2a2e39] flex items-center gap-1 text-[10.5px] font-mono tabular-nums"
        >
          <span>{Math.round(lineWidth)}px</span>
        </button>

        {widthMenuOpen && (
          <div className="absolute left-0 top-7 py-1 bg-[#16181f]/85 backdrop-blur-2xl border border-white/12 rounded-lg shadow-2xl w-24 z-50">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, lineWidth: w });
                  setWidthMenuOpen(false);
                }}
                className={`w-full px-2.5 py-1 flex items-center justify-between text-xs hover:bg-[#2a2e39] ${
                  Math.round(lineWidth) === w ? 'text-[#2962ff] font-semibold' : 'text-[#d1d4dc]'
                }`}
              >
                <span>{w}px</span>
                <span className="w-8 bg-current" style={{ height: `${w}px` }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Line Style Selector (Solid / Dashed / Dotted) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setStyleMenuOpen((v) => !v);
            setColorMenuOpen(false);
            setWidthMenuOpen(false);
          }}
          aria-label="Line Style"
          title="Line Style"
          className="h-6 px-1.5 rounded hover:bg-[#2a2e39] flex items-center gap-1"
        >
          <svg viewBox="0 0 24 8" className="w-4 h-2" stroke="currentColor" strokeWidth="2">
            <line
              x1="1"
              y1="4"
              x2="23"
              y2="4"
              strokeDasharray={
                lineStyle === 'dashed' ? '5 3' : lineStyle === 'dotted' ? '2 2' : undefined
              }
            />
          </svg>
        </button>

        {styleMenuOpen && (
          <div className="absolute left-0 top-7 py-1 bg-[#16181f]/85 backdrop-blur-2xl border border-white/12 rounded-lg shadow-2xl w-24 z-50">
            {(['solid', 'dashed', 'dotted'] as LineStyleType[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, lineStyle: st });
                  setStyleMenuOpen(false);
                }}
                className={`w-full px-2.5 py-1 text-left text-xs capitalize hover:bg-[#2a2e39] ${
                  lineStyle === st ? 'text-[#2962ff] font-semibold' : 'text-[#d1d4dc]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-3.5 bg-[#2a2e39] mx-0.5" />

      {/* Edit Label / Text */}
      <button
        type="button"
        onClick={() => onRequestEditText(drawing)}
        aria-label="Edit Drawing Text"
        title="Add or Edit Text Label"
        className="w-6 h-6 rounded hover:bg-[#2a2e39] flex items-center justify-center hover:text-white"
      >
        <Type className="w-3 h-3" />
      </button>

      {/* Clone Drawing */}
      <button
        type="button"
        onClick={() => onClone(drawing)}
        aria-label="Clone Drawing"
        title="Clone (Duplicate)"
        className="w-6 h-6 rounded hover:bg-[#2a2e39] flex items-center justify-center hover:text-white"
      >
        <Copy className="w-3 h-3" />
      </button>

      {/* Lock Individual Drawing */}
      <button
        type="button"
        onClick={() => onUpdate({ ...drawing, locked: !drawing.locked })}
        aria-label={drawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
        title={drawing.locked ? 'Unlock' : 'Lock'}
        className={`w-6 h-6 rounded hover:bg-[#2a2e39] flex items-center justify-center ${
          drawing.locked ? 'text-[#2962ff]' : 'hover:text-white'
        }`}
      >
        {drawing.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
      </button>

      {/* Hide Individual Drawing */}
      <button
        type="button"
        onClick={() => onUpdate({ ...drawing, visible: drawing.visible === false })}
        aria-label="Hide Drawing"
        title="Hide Drawing"
        className="w-6 h-6 rounded hover:bg-[#2a2e39] flex items-center justify-center hover:text-white"
      >
        {drawing.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>

      {/* Delete Selected Drawing */}
      <button
        type="button"
        onClick={() => onDelete(drawing.id)}
        aria-label="Delete Selected Drawing"
        title="Remove (Delete / Backspace)"
        className="w-6 h-6 rounded hover:bg-[#2a2e39] text-[#b2b5be] hover:text-[#f23645] flex items-center justify-center"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};
