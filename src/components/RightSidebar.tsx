import React, { useState } from 'react';
import {
  Plus,
  Maximize2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  LayoutGrid,
  Edit,
  Bookmark,
  Clock,
  Layers,
  Sparkles,
  Target,
  Triangle,
  Calendar,
  Rss,
  Bell,
  MessageSquare,
  Grid,
  HelpCircle,
} from 'lucide-react';
import {
  SymbolInfo,
  NewsItem,
  PriceAlert,
  TradePosition,
  formatPrice,
  getForwardCurve,
  calculatePositionPnL,
} from '../utils/marketEngine';
import { RightRailTab, ChartDrawing, IndicatorConfig } from '../types/trading';

interface RightSidebarProps {
  symbols: SymbolInfo[];
  watchlistSymbols: string[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
  onToggleSymbolFlag: (symbol: string) => void;
  onOpenAddSymbol: () => void;
  news: NewsItem[];
  activeTab: RightRailTab;
  onSelectTab: (tab: RightRailTab) => void;
  alerts: PriceAlert[];
  onOpenCreateAlert: () => void;
  onRemoveAlert: (id: string) => void;
  drawings: ChartDrawing[];
  onRemoveDrawing: (id: string) => void;
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
  positions: TradePosition[];
  onQuickOrder: (side: 'BUY' | 'SELL') => void;
  onClosePosition: (id: string) => void;
  lastTickSymbol: string | null;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  symbols,
  watchlistSymbols,
  activeSymbol,
  onSelectSymbol,
  onRemoveFromWatchlist,
  onToggleSymbolFlag,
  onOpenAddSymbol,
  news,
  activeTab,
  onSelectTab,
  alerts,
  onOpenCreateAlert,
  onRemoveAlert,
  drawings,
  onRemoveDrawing,
  indicators,
  onToggleIndicator,
  positions,
  onQuickOrder,
  onClosePosition,
  lastTickSymbol,
}) => {
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'flagged'>('all');
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  const selectedSymbolObj = symbols.find((s) => s.symbol === activeSymbol) || symbols[0];
  const activeNews = news.find((n) => n.symbol === activeSymbol) || news[0];
  const forwardCurve = getForwardCurve(selectedSymbolObj);

  const displayedWatchlist = watchlistSymbols
    .map((symKey) => symbols.find((s) => s.symbol === symKey))
    .filter((s): s is SymbolInfo => Boolean(s))
    .filter((s) => (watchlistFilter === 'flagged' ? Boolean(s.flagColor) : true));

  return (
    <div className="flex h-full shrink-0 select-none z-30">
      {/* Main Right Sidebar Content Area (276px wide matching Screenshot 1) */}
      <aside
        aria-label="Watchlist and Symbol Details"
        className="w-[278px] bg-[#0a0a0d] border-l border-[#222631] flex flex-col h-full overflow-hidden"
      >
        {activeTab === 'watchlist' && (
          <>
            {/* Top Half: Watchlist */}
            <div
              className={`flex flex-col ${
                detailsExpanded ? 'h-[236px]' : 'flex-1'
              } border-b border-[#222631] shrink-0`}
            >
              {/* Watchlist Header Bar */}
              <div className="h-[38px] px-3 flex items-center justify-between border-b border-[#181b24] shrink-0">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter((f) => (f === 'all' ? 'flagged' : 'all'))}
                  aria-label="Filter Watchlist"
                  className="flex items-center gap-1 text-[13px] font-semibold text-[#e0e3eb] hover:text-white cursor-pointer"
                >
                  <span>{watchlistFilter === 'all' ? 'Watchlist' : 'Red & Orange List'}</span>
                  <span className="text-[10px] text-[#787b86]">▼</span>
                </button>

                <div className="flex items-center gap-1 text-[#b2b5be]">
                  <button
                    type="button"
                    onClick={onOpenAddSymbol}
                    aria-label="Add Symbol to Watchlist"
                    title="Add Symbol to Watchlist"
                    className="w-6 h-6 rounded hover:bg-[#1e222d] flex items-center justify-center hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsExpanded((v) => !v)}
                    aria-label="Toggle Symbol Details Pane"
                    title="Expand / Collapse Watchlist"
                    className="w-6 h-6 rounded hover:bg-[#1e222d] flex items-center justify-center hover:text-white transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchlistFilter('all')}
                    aria-label="Watchlist Options"
                    className="w-6 h-6 rounded hover:bg-[#1e222d] flex items-center justify-center hover:text-white transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Watchlist Column Headers: [Flag] Symb | Last | Chg | Chg% */}
              <div className="h-[26px] px-2 flex items-center text-[11px] text-[#787b86] border-b border-[#181b24] shrink-0">
                <div className="w-3.5 flex items-center justify-center mr-1">
                  <span className="w-2.5 h-2 bg-[#434651] inline-block rounded-xs" />
                </div>
                <div className="w-[74px] text-left">Symb</div>
                <div className="flex-1 text-right pr-1">Last</div>
                <div className="w-[52px] text-right">Chg</div>
                <div className="w-[52px] text-right pr-1">Chg%</div>
              </div>

              {/* Watchlist Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#141720]">
                {displayedWatchlist.map((item) => {
                  const isSelected = item.symbol === activeSymbol;
                  const isNegative = item.change < 0;
                  const justTicked = lastTickSymbol === item.symbol;

                  return (
                    <div
                      key={item.symbol}
                      onClick={() => onSelectSymbol(item.symbol)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select symbol ${item.symbol}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectSymbol(item.symbol);
                        }
                      }}
                      className={`group relative h-[36px] px-1.5 flex items-center text-[12px] cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1c202b] border-y border-[#363a45]'
                          : 'hover:bg-[#141720]'
                      }`}
                    >
                      {/* Left Ribbon Flag matching Screenshot 1 */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleSymbolFlag(item.symbol);
                        }}
                        aria-label={`Flag ${item.symbol}`}
                        className="w-3.5 h-4 flex items-center justify-center mr-1 shrink-0"
                      >
                        <svg
                          viewBox="0 0 12 10"
                          className={`w-2.5 h-2.5 ${
                            item.flagColor === 'red'
                              ? 'text-[#f23645] fill-current'
                              : item.flagColor === 'orange'
                              ? 'text-[#ff9800] fill-current'
                              : item.flagColor === 'blue'
                              ? 'text-[#2962ff] fill-current'
                              : 'text-[#363a45] group-hover:text-[#787b86]'
                          }`}
                        >
                          <path d="M0 0 H10 L12 5 L10 10 H0 L2 5 Z" />
                        </svg>
                      </button>

                      {/* Circular Instrument Badge ("100", "30", "500", Gold icon) + Symbol Code */}
                      <div className="w-[74px] flex items-center gap-1.5 min-w-0 shrink-0">
                        <span
                          style={{
                            backgroundColor: item.badgeBg,
                            color: item.badgeColor || '#ffffff',
                          }}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-extrabold leading-none shrink-0"
                        >
                          {item.badgeText}
                        </span>
                        <span className="font-semibold text-[#e0e3eb] truncate flex items-center gap-0.5">
                          {item.symbol}
                          <span className="text-[7px] text-[#ff9800] align-top">●</span>
                        </span>
                      </div>

                      {/* Last Price */}
                      <div
                        className={`flex-1 text-right font-mono tabular-nums pr-1 ${
                          justTicked
                            ? isNegative
                              ? 'text-[#ff5252] font-semibold'
                              : 'text-[#00e676] font-semibold'
                            : item.symbol === 'YM1!'
                            ? 'text-[#d1d4dc]'
                            : isNegative
                            ? 'text-[#f23645]'
                            : 'text-[#089981]'
                        }`}
                      >
                        {item.symbol === 'YM1!' ? (
                          <span>
                            52,34<span className="text-[#089981]">{Math.abs(item.price) % 10}</span>
                          </span>
                        ) : (
                          formatPrice(
                            item.price,
                            item.symbol === 'NQ1!' || item.symbol === 'BTCUSD' ? 1 : item.decimals
                          )
                        )}
                      </div>

                      {/* Change */}
                      <div
                        className={`w-[52px] text-right font-mono tabular-nums ${
                          isNegative ? 'text-[#f23645]' : 'text-[#089981]'
                        }`}
                      >
                        {formatPrice(item.change, item.symbol === 'BTCUSD' ? 0 : item.decimals)}
                      </div>

                      {/* Change % */}
                      <div
                        className={`w-[52px] text-right font-mono tabular-nums pr-1 ${
                          isNegative ? 'text-[#f23645]' : 'text-[#089981]'
                        }`}
                      >
                        {item.changePercent.toFixed(2)}%
                      </div>

                      {/* Hover Delete Trash Button matching Screenshot 1 on NQ1! row */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onRemoveFromWatchlist(item.symbol);
                        }}
                        aria-label={`Remove ${item.symbol} from watchlist`}
                        className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded bg-[#2a2e39] hover:bg-[#363a45] text-[#d1d4dc] hover:text-white items-center justify-center shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Half: Selected Symbol Details + News Card + Forward Curve */}
            {detailsExpanded && (
              <div className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-3">
                {/* Symbol Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        backgroundColor: selectedSymbolObj.badgeBg,
                        color: selectedSymbolObj.badgeColor || '#ffffff',
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-extrabold"
                    >
                      {selectedSymbolObj.badgeText}
                    </span>
                    <span className="text-[14px] font-bold text-white">
                      {selectedSymbolObj.symbol}
                    </span>
                    <span className="text-[8px] text-[#ff9800]">●</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#9598a1]">
                    <button
                      type="button"
                      onClick={() => onSelectTab('object_tree')}
                      aria-label="View Data Window"
                      className="p-1 hover:text-white rounded hover:bg-[#1e222d]"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onOpenCreateAlert}
                      aria-label="Add Symbol Note or Alert"
                      className="p-1 hover:text-white rounded hover:bg-[#1e222d]"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab('dom_trade')}
                      aria-label="More Symbol Actions"
                      className="p-1 hover:text-white rounded hover:bg-[#1e222d]"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Full Instrument Name & Exchange Subtitle */}
                <div className="text-[11.5px] text-[#9598a1] leading-snug -mt-1">
                  <div className="flex items-center gap-1 text-[#b2b5be]">
                    <span>{selectedSymbolObj.name}</span>
                    <ExternalLink className="w-3 h-3 inline text-[#787b86]" />
                    <span>· {selectedSymbolObj.exchange}</span>
                  </div>
                  <div className="text-[#787b86] mt-0.5">{selectedSymbolObj.type}</div>
                </div>

                {/* Big Price Readout matching Screenshot 1 ("28,304.00 USD  -80.50 -0.28%  ● Market open") */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      data-testid="details-live-price"
                      className={`text-[26px] font-bold font-mono tracking-tight tabular-nums leading-none ${
                        selectedSymbolObj.change < 0 ? 'text-[#f23645]' : 'text-[#089981]'
                      }`}
                    >
                      {formatPrice(selectedSymbolObj.price, selectedSymbolObj.decimals)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#9598a1]">
                      {selectedSymbolObj.currency}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-2 text-[13px] font-mono font-medium tabular-nums mt-1 ${
                      selectedSymbolObj.change < 0 ? 'text-[#f23645]' : 'text-[#089981]'
                    }`}
                  >
                    <span>
                      {selectedSymbolObj.change > 0 ? '+' : ''}
                      {formatPrice(selectedSymbolObj.change, selectedSymbolObj.decimals)}
                    </span>
                    <span>
                      {selectedSymbolObj.changePercent > 0 ? '+' : ''}
                      {selectedSymbolObj.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[#089981] mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
                    <span>Market open</span>
                  </div>
                </div>

                {/* Purple News Card matching Screenshot 1 */}
                <div
                  onClick={() => onSelectTab('news_calendar')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectTab('news_calendar');
                  }}
                  className="bg-[#1d1729] hover:bg-[#251d34] border border-[#2d2340] rounded-lg p-3 transition-colors cursor-pointer"
                >
                  <div className="text-[11px] text-[#9598a1] mb-1">
                    <span className="text-[#ba68c8] font-medium">News</span> · {activeNews.timeAgo}
                  </div>
                  <p className="text-[12px] text-[#d1d4dc] leading-relaxed line-clamp-3">
                    {activeNews.headline}
                  </p>
                  <div className="text-[11.5px] text-[#9598a1] hover:text-white mt-2 flex items-center gap-0.5">
                    <span>More events</span>
                    <span>›</span>
                  </div>
                </div>

                {/* Forward Curve Chart Section matching Screenshot 1 */}
                <div className="pt-1">
                  <div className="text-[12px] font-semibold text-[#e0e3eb] mb-2">
                    Forward curve
                  </div>
                  <div className="relative h-[88px] w-full bg-[#0d0f14] border border-[#181b24] rounded p-2">
                    <div className="flex justify-between text-[10px] font-mono text-[#787b86] tabular-nums mb-1">
                      <span>
                        {formatPrice(
                          forwardCurve[forwardCurve.length - 1]?.price ?? 37500,
                          selectedSymbolObj.decimals
                        )}
                      </span>
                      <span>{forwardCurve[0]?.contract} → {forwardCurve[forwardCurve.length - 1]?.contract}</span>
                    </div>
                    <svg viewBox="0 0 220 48" className="w-full h-[46px] overflow-visible">
                      <line x1="0" y1="6" x2="220" y2="6" stroke="#1e222d" strokeWidth="1" />
                      <line x1="0" y1="26" x2="220" y2="26" stroke="#1e222d" strokeWidth="1" />
                      <line x1="0" y1="44" x2="220" y2="44" stroke="#1e222d" strokeWidth="1" />
                      <path
                        d="M 8 40 Q 65 34, 115 24 T 212 8"
                        fill="none"
                        stroke="#2962ff"
                        strokeWidth="2"
                      />
                      {forwardCurve.map((pt, i) => {
                        const cx = 8 + (i / (forwardCurve.length - 1)) * 204;
                        const cy = 40 - (i / (forwardCurve.length - 1)) * 32;
                        return (
                          <circle
                            key={pt.contract}
                            cx={cx}
                            cy={cy}
                            r="2.5"
                            fill="#2962ff"
                          >
                            <title>{`${pt.contract} (${pt.monthLabel}): ${formatPrice(pt.price, selectedSymbolObj.decimals)}`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Alternate Tab 2: Price Alerts Panel */}
        {activeTab === 'alerts' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[38px] px-3 flex items-center justify-between border-b border-[#222631]">
              <span className="text-[13px] font-semibold text-white">Price Alerts ({alerts.length})</span>
              <button
                type="button"
                onClick={onOpenCreateAlert}
                aria-label="Add New Alert"
                className="px-2 py-1 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#787b86]">
                  No active alerts. Click Create to set a real-time price alert.
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded bg-[#141720] border border-[#222631] flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <span>{al.symbol}</span>
                        <span className="text-[#9598a1] font-normal">{al.condition}</span>
                        <span className="font-mono text-[#f59e0b] tabular-nums">
                          {formatPrice(al.targetPrice, 2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#787b86] mt-0.5">{al.note}</div>
                      <div className="text-[10px] mt-1">
                        {al.triggered ? (
                          <span className="text-[#089981] font-semibold">
                            ● Triggered at {al.triggeredAt}
                          </span>
                        ) : (
                          <span className="text-[#2962ff]">● Active · Monitoring live feed</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAlert(al.id)}
                      aria-label={`Delete alert on ${al.symbol}`}
                      className="text-[#787b86] hover:text-[#f23645] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Alternate Tab 3: Object Tree & Indicators Manager */}
        {activeTab === 'object_tree' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[38px] px-3 flex items-center justify-between border-b border-[#222631]">
              <span className="text-[13px] font-semibold text-white">Object Tree & Layers</span>
              <span className="text-[11px] text-[#787b86]">{activeSymbol}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
              <div>
                <div className="text-[11px] font-semibold text-[#9598a1] uppercase tracking-wider mb-1.5">
                  Active Studies & Indicators
                </div>
                <div className="space-y-1">
                  {indicators.map((ind) => (
                    <div
                      key={ind.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded bg-[#141720] text-xs"
                    >
                      <span className={ind.visible ? 'text-white' : 'text-[#787b86] line-through'}>
                        {ind.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleIndicator(ind.id)}
                        className="text-[11px] text-[#2962ff] hover:underline"
                      >
                        {ind.visible ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[#9598a1] uppercase tracking-wider mb-1.5">
                  Chart Drawings ({drawings.length})
                </div>
                {drawings.length === 0 ? (
                  <p className="text-xs text-[#787b86]">
                    Select any tool from the left or floating toolbar and click on the chart to draw.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {drawings.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded bg-[#141720] text-xs"
                      >
                        <div>
                          <div className="text-white font-medium">{d.tool}</div>
                          <div className="text-[10.5px] font-mono text-[#787b86] tabular-nums">
                            {d.symbol} @ {formatPrice(d.p1, 2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveDrawing(d.id)}
                          aria-label={`Remove drawing ${d.tool}`}
                          className="text-[#787b86] hover:text-[#f23645]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alternate Tab 4: DOM Order Ticket & Active Positions */}
        {activeTab === 'dom_trade' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[38px] px-3 flex items-center justify-between border-b border-[#222631]">
              <span className="text-[13px] font-semibold text-white">Order DOM · {activeSymbol}</span>
              <span className="text-[11px] font-mono text-[#089981]">LIVE</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onQuickOrder('SELL')}
                  className="py-2.5 px-3 rounded bg-[#f23645]/15 border border-[#f23645] text-[#f23645] hover:bg-[#f23645] hover:text-white transition-colors flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold uppercase">Sell Market</span>
                  <span className="text-sm font-mono font-bold tabular-nums">
                    {formatPrice(selectedSymbolObj.bid, selectedSymbolObj.decimals)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickOrder('BUY')}
                  className="py-2.5 px-3 rounded bg-[#2962ff]/15 border border-[#2962ff] text-[#2962ff] hover:bg-[#2962ff] hover:text-white transition-colors flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold uppercase">Buy Market</span>
                  <span className="text-sm font-mono font-bold tabular-nums">
                    {formatPrice(selectedSymbolObj.ask, selectedSymbolObj.decimals)}
                  </span>
                </button>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[#9598a1] uppercase tracking-wider mb-1.5">
                  Open Positions ({positions.length})
                </div>
                {positions.length === 0 ? (
                  <div className="text-xs text-[#787b86] py-4 text-center border border-dashed border-[#222631] rounded">
                    No open positions. Click BUY or SELL on the chart or above.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {positions.map((pos) => {
                      const symObj = symbols.find((s) => s.symbol === pos.symbol) || selectedSymbolObj;
                      const pnl = calculatePositionPnL(pos, symObj.price);
                      return (
                        <div
                          key={pos.id}
                          className="p-2 rounded bg-[#141720] border border-[#222631] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">
                              <span
                                className={
                                  pos.side === 'BUY' ? 'text-[#2962ff]' : 'text-[#f23645]'
                                }
                              >
                                {pos.side}
                              </span>{' '}
                              {pos.qty} {pos.symbol}
                            </div>
                            <div className="text-[10.5px] font-mono text-[#787b86] tabular-nums">
                              Entry: {formatPrice(pos.entryPrice, symObj.decimals)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-mono font-semibold tabular-nums ${
                                pnl.dollarPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                              }`}
                            >
                              {pnl.dollarPnL >= 0 ? '+' : ''}${pnl.dollarPnL.toFixed(2)}
                            </div>
                            <button
                              type="button"
                              onClick={() => onClosePosition(pos.id)}
                              className="text-[10px] text-[#9598a1] hover:text-white underline"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alternate Tab 5: News & Economic Calendar Stream */}
        {activeTab === 'news_calendar' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[38px] px-3 flex items-center justify-between border-b border-[#222631]">
              <span className="text-[13px] font-semibold text-white">Headlines & Macro Wire</span>
              <button
                type="button"
                onClick={() => onSelectTab('watchlist')}
                className="text-xs text-[#2962ff] hover:underline"
              >
                Watchlist
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {news.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectSymbol(item.symbol)}
                  className="p-2.5 rounded bg-[#141720] hover:bg-[#1c202b] border border-[#222631] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[10.5px] text-[#9598a1] mb-1">
                    <span className="font-bold text-[#ba68c8]">{item.symbol}</span>
                    <span>{item.timeAgo}</span>
                  </div>
                  <div className="text-xs font-medium text-white leading-snug mb-1">
                    {item.headline}
                  </div>
                  <p className="text-[11px] text-[#787b86] leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Far-Right Vertical Icon Rail (44px wide matching Screenshot 1) */}
      <nav
        aria-label="Workspace Tools Rail"
        className="w-[44px] bg-[#0a0a0d] border-l border-[#222631] flex flex-col items-center justify-between py-1.5 shrink-0"
      >
        <div className="flex flex-col items-center gap-1.5">
          {/* Watchlist Icon (Active) */}
          <button
            type="button"
            onClick={() => onSelectTab('watchlist')}
            aria-label="Watchlist, Details and News"
            title="Watchlist, Details and News"
            className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
              activeTab === 'watchlist'
                ? 'bg-[#2a2e39] text-white border border-[#363a45]'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <Bookmark className="w-[18px] h-[18px]" />
          </button>

          {/* Alerts Clock Icon */}
          <button
            type="button"
            onClick={() => onSelectTab('alerts')}
            aria-label="Alerts Manager"
            title="Alerts"
            className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
              activeTab === 'alerts'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <Clock className="w-[18px] h-[18px]" />
          </button>

          {/* Object Tree / Data Window Icon */}
          <button
            type="button"
            onClick={() => onSelectTab('object_tree')}
            aria-label="Object Tree and Data Window"
            title="Object Tree & Data Window"
            className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
              activeTab === 'object_tree'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <Layers className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Bottom Group of Right Rail Icons matching Screenshot 1 */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectTab('dom_trade')}
            aria-label="Hotlists and DOM"
            title="DOM Order Book & Positions"
            className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
              activeTab === 'dom_trade'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <Sparkles className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('dom_trade')}
            aria-label="Trading Snipers and Targets"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <Target className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('object_tree')}
            aria-label="Pine Script and Patterns"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <Triangle className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('news_calendar')}
            aria-label="Economic Calendar"
            title="Economic Calendar & News"
            className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors ${
              activeTab === 'news_calendar'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#b2b5be] hover:bg-[#1e222d] hover:text-white'
            }`}
          >
            <Calendar className="w-[18px] h-[18px]" />
          </button>

          {/* RSS Streams Icon with "99+" Red Badge matching Screenshot 1 */}
          <button
            type="button"
            onClick={() => onSelectTab('news_calendar')}
            aria-label="Social Streams and Minds"
            className="relative w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <Rss className="w-[18px] h-[18px]" />
            <span className="absolute top-0.5 right-0 bg-[#f23645] text-white text-[8.5px] font-bold leading-none px-1 py-0.5 rounded-full">
              99+
            </span>
          </button>

          {/* Notifications Bell Icon with "5" Red Badge matching Screenshot 1 */}
          <button
            type="button"
            onClick={() => onSelectTab('alerts')}
            aria-label="Notifications"
            className="relative w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-0.5 right-1 bg-[#f23645] text-white text-[9px] font-bold leading-none px-1 py-0.5 rounded-full">
              5
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('news_calendar')}
            aria-label="Public Chat"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <MessageSquare className="w-[18px] h-[18px]" />
          </button>

          {/* White Circle 9-Dot App Grid Button matching Screenshot 1 */}
          <button
            type="button"
            onClick={() => onSelectTab('watchlist')}
            aria-label="TradingView Products Grid"
            className="w-[32px] h-[32px] rounded-full bg-[#f0f3fa] text-[#0a0a0d] flex items-center justify-center shadow-xs hover:bg-white transition-colors my-0.5"
          >
            <Grid className="w-[17px] h-[17px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('object_tree')}
            aria-label="Help Center"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[#b2b5be] hover:bg-[#1e222d] hover:text-white transition-colors"
          >
            <HelpCircle className="w-[18px] h-[18px]" />
          </button>
        </div>
      </nav>
    </div>
  );
};
