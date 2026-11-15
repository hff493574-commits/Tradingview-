import React, { useState } from 'react';
import { X, Search, Plus, Check, Eye, EyeOff, BellPlus } from 'lucide-react';
import { SymbolInfo, PriceAlert, formatPrice } from '../utils/marketEngine';
import { IndicatorConfig } from '../types/trading';

interface SymbolSearchModalProps {
  open: boolean;
  mode: 'switch' | 'compare' | 'watchlist';
  symbols: SymbolInfo[];
  activeSymbol: string;
  watchlistSymbols: string[];
  onSelectSymbol: (symbol: string) => void;
  onAddToWatchlist: (symbol: string) => void;
  onClose: () => void;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  open,
  mode,
  symbols,
  activeSymbol,
  watchlistSymbols,
  onSelectSymbol,
  onAddToWatchlist,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | 'Futures' | 'Stock' | 'Crypto' | 'Forex'>('All');

  if (!open) return null;

  const filtered = symbols.filter((s) => {
    const matchesCat = category === 'All' || s.type === category;
    const matchesQuery =
      !query.trim() ||
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.exchange.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Symbol Search"
    >
      <div className="w-full max-w-xl bg-[#181b24] border border-[#2a2e39] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2e39] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'watchlist'
              ? 'Add Symbol to Watchlist'
              : mode === 'compare'
              ? 'Compare or Switch Instrument'
              : 'Symbol Search'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Symbol Search"
            className="text-[#9598a1] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-2.5 border-b border-[#2a2e39] flex items-center gap-2 bg-[#12151c]">
          <Search className="w-4 h-4 text-[#787b86]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol, e.g. NQ1!, ES1!, GC1!, BTCUSD, NVDA..."
            aria-label="Search symbols"
            autoFocus
            className="w-full bg-transparent text-xs text-white placeholder-[#787b86] focus:outline-none"
          />
        </div>

        {/* Asset Class Tabs */}
        <div className="px-4 py-2 border-b border-[#2a2e39] flex items-center gap-1.5">
          {(['All', 'Futures', 'Stock', 'Crypto', 'Forex'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-[#2962ff] text-white'
                  : 'bg-[#222631] text-[#b2b5be] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#222631]">
          {filtered.map((item) => {
            const inWatchlist = watchlistSymbols.includes(item.symbol);
            return (
              <div
                key={item.symbol}
                onClick={() => {
                  if (mode === 'watchlist') {
                    onAddToWatchlist(item.symbol);
                  } else {
                    onSelectSymbol(item.symbol);
                  }
                  onClose();
                }}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-[#222631] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    style={{
                      backgroundColor: item.badgeBg,
                      color: item.badgeColor || '#ffffff',
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  >
                    {item.badgeText}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{item.symbol}</span>
                      {item.symbol === activeSymbol && (
                        <span className="text-[10px] text-[#2962ff] font-normal">Active</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#9598a1]">{item.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-mono text-white tabular-nums">
                      {formatPrice(item.price, item.decimals)}
                    </div>
                    <div className="text-[10px] text-[#787b86]">
                      {item.type} · {item.exchange}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onAddToWatchlist(item.symbol);
                    }}
                    aria-label={
                      inWatchlist
                        ? `${item.symbol} in Watchlist`
                        : `Add ${item.symbol} to Watchlist`
                    }
                    className={`w-7 h-7 rounded flex items-center justify-center border ${
                      inWatchlist
                        ? 'border-[#089981] text-[#089981]'
                        : 'border-[#363a45] text-[#b2b5be] hover:text-white hover:border-white'
                    }`}
                  >
                    {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface IndicatorsModalProps {
  open: boolean;
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
  onClose: () => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  open,
  indicators,
  onToggleIndicator,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  if (!open) return null;

  const filtered = indicators.filter(
    (ind) =>
      !search.trim() ||
      ind.name.toLowerCase().includes(search.toLowerCase()) ||
      ind.shortTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Indicators, Metrics, and Strategies"
    >
      <div className="w-full max-w-lg bg-[#181b24] border border-[#2a2e39] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2e39] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Indicators, Metrics & Strategies</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Indicators Modal"
            className="text-[#9598a1] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-[#2a2e39] flex items-center gap-2 bg-[#12151c]">
          <Search className="w-4 h-4 text-[#787b86]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indicators (e.g. IV WALLS, Quantum Wealth SSMT, VWAP, EMA)..."
            aria-label="Search indicators"
            className="w-full bg-transparent text-xs text-white placeholder-[#787b86] focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[#222631]">
          {filtered.map((ind) => (
            <div
              key={ind.id}
              onClick={() => onToggleIndicator(ind.id)}
              className="px-4 py-3 flex items-center justify-between hover:bg-[#222631] cursor-pointer transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-white">{ind.name}</div>
                <div className="text-[11px] text-[#787b86] font-mono mt-0.5 truncate max-w-sm">
                  {ind.shortTitle} {ind.paramsText}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Toggle ${ind.name}`}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 ${
                  ind.visible
                    ? 'bg-[#2962ff] text-white'
                    : 'bg-[#222631] text-[#9598a1] hover:text-white'
                }`}
              >
                {ind.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{ind.visible ? 'Visible' : 'Hidden'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface CreateAlertModalProps {
  open: boolean;
  symbolInfo: SymbolInfo;
  onCreateAlert: (alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => void;
  onClose: () => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  open,
  symbolInfo,
  onCreateAlert,
  onClose,
}) => {
  const [condition, setCondition] = useState<PriceAlert['condition']>('Crossing');
  const [targetPrice, setTargetPrice] = useState<string>(String(symbolInfo.price));
  const [note, setNote] = useState<string>(`${symbolInfo.symbol} 1σ IV Wall Alert`);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(targetPrice);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Please enter a valid positive target price.');
      return;
    }
    onCreateAlert({
      symbol: symbolInfo.symbol,
      condition,
      targetPrice: num,
      note: note.trim() || `${symbolInfo.symbol} price alert`,
      active: true,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Create Alert on ${symbolInfo.symbol}`}
    >
      <div className="w-full max-w-md bg-[#181b24] border border-[#2a2e39] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2e39] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BellPlus className="w-4 h-4 text-[#2962ff]" />
            <span>Create Alert on {symbolInfo.symbol}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Alert Modal"
            className="text-[#9598a1] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-[#9598a1] mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PriceAlert['condition'])}
              aria-label="Alert Condition"
              className="w-full h-9 bg-[#0f1117] border border-[#2a2e39] rounded px-2.5 text-white focus:outline-none focus:border-[#2962ff]"
            >
              <option value="Crossing">Crossing</option>
              <option value="Crossing Up">Crossing Up</option>
              <option value="Crossing Down">Crossing Down</option>
              <option value="Greater Than">Greater Than</option>
              <option value="Less Than">Less Than</option>
            </select>
          </div>

          <div>
            <label className="block text-[#9598a1] mb-1">
              Price Level (Current: {formatPrice(symbolInfo.price, symbolInfo.decimals)})
            </label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              aria-label="Alert Target Price"
              className="w-full h-9 bg-[#0f1117] border border-[#2a2e39] rounded px-2.5 font-mono text-white tabular-nums focus:outline-none focus:border-[#2962ff]"
            />
            {error && <p className="text-[#f23645] text-[11px] mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-[#9598a1] mb-1">Alert Message / Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Alert Message"
              className="w-full h-9 bg-[#0f1117] border border-[#2a2e39] rounded px-2.5 text-white focus:outline-none focus:border-[#2962ff]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded bg-[#222631] hover:bg-[#2a2e39] text-[#d1d4dc]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white font-semibold"
            >
              Create Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
