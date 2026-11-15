export type ChartStyleType =
  | 'candles'
  | 'hollow_candles'
  | 'bars'
  | 'line'
  | 'area'
  | 'baseline'
  | 'heikin_ashi';

export type DrawingToolId =
  | 'cursor'
  | 'trend-line'
  | 'horizontal-ray'
  | 'vertical-line'
  | 'fib-levels'
  | 'liquidity-box'
  | 'stop-channel'
  | 'rectangle'
  | 'text-note'
  | 'volume-profile'
  | 'candle-pattern'
  | 'wave-path'
  | 'time-cycles'
  | 'measure';

export interface ChartDrawing {
  id: string;
  symbol: string;
  tool: DrawingToolId;
  t1: number; // Unix timestamp (seconds)
  p1: number; // Price 1
  t2: number; // Unix timestamp (seconds)
  p2: number; // Price 2
  text?: string;
  color: string;
  locked?: boolean;
}

export interface IndicatorConfig {
  id: string;
  name: string;
  shortTitle: string;
  paramsText: string;
  visible: boolean;
  category: 'institutional' | 'overlay' | 'volume';
  color?: string;
}

export type RightRailTab = 'watchlist' | 'alerts' | 'object_tree' | 'dom_trade' | 'news_calendar';
