export interface LatestRanking {
  date: string;
  symbol: string;
  price: number;
  rank: number;
  total_score: number;
  score_1m: number;
  score_3m: number;
  score_6m: number;
  score_12m: number;
  created_at: string;
}

export interface HistoryDataPoint {
  date: string;
  [symbol: string]: number | string; // symbol → rank
}

export interface HistoryResponse {
  symbols: string[];
  data: HistoryDataPoint[];
}

export interface SymbolLatest {
  date: string;
  rank: number;
  total_score: number;
  score_1m: number;
  score_3m: number;
  score_6m: number;
  score_12m: number;
}

export type HoldingStatus = 'HOLD' | 'BUFFER' | 'SELL' | 'WATCH';

export interface HoldingItem {
  symbol: string;
  rank: number;
  total_score: number;
  status: HoldingStatus;
}

export interface PortfolioState {
  holdings: HoldingItem[];      // 전월 말 Top 3 기준 현재 보유 종목 (상태 포함)
  replacements: HoldingItem[];  // SELL 종목 대체 후보 (score > 0인 최상위 미보유)
  actionRequired: boolean;      // SELL 또는 BUFFER 존재 시 true
  nextCheckDate: string;        // 이번 달 마지막 금요일 (YYYY-MM-DD)
  allCashWarning: boolean;      // Top 3 모두 score ≤ 0일 때 true
}
