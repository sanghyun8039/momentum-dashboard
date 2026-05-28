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
