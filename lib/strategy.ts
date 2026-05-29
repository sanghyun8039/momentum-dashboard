import { LatestRanking, HistoryResponse, PortfolioState, HoldingItem, HoldingStatus } from './types';

const HOLD_TOP_N = 3;
const BUFFER_MAX_RANK = 6;
const SELL_MIN_RANK = 7;

/**
 * 이번 달 1일 이전 마지막 데이터 포인트에서 Top N 심볼을 추출한다.
 * history가 없거나 전월 데이터가 없으면 현재 latest Top N으로 fallback한다.
 */
function getPrevMonthHoldings(
  latest: LatestRanking[],
  history: HistoryResponse | undefined,
  today: Date,
): string[] {
  if (!history || history.data.length === 0) {
    return latest
      .filter((e) => e.total_score > 0)
      .slice(0, HOLD_TOP_N)
      .map((e) => e.symbol);
  }

  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  // 이번 달 1일보다 앞선 가장 최근 데이터 포인트
  const prevPoint = [...history.data]
    .reverse()
    .find((d) => (d.date as string) < firstOfMonth);

  if (!prevPoint) {
    // 전월 데이터 없음 → fallback
    return latest
      .filter((e) => e.total_score > 0)
      .slice(0, HOLD_TOP_N)
      .map((e) => e.symbol);
  }

  // 해당 데이터 포인트에서 rank 기준 Top N 심볼 추출
  const ranked = history.symbols
    .map((sym) => ({ symbol: sym, rank: prevPoint[sym] as number }))
    .filter((e) => typeof e.rank === 'number')
    .sort((a, b) => a.rank - b.rank);

  return ranked.slice(0, HOLD_TOP_N).map((e) => e.symbol);
}

/**
 * 이번 달 마지막 금요일을 YYYY-MM-DD 형식으로 반환한다. (공휴일 무시)
 */
function getLastFridayOfMonth(today: Date): string {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const dayOfWeek = lastDay.getDay(); // 0=일, 5=금
  const offset = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
  const lastFriday = new Date(lastDay);
  lastFriday.setDate(lastDay.getDate() - offset);
  const y = lastFriday.getFullYear();
  const m = String(lastFriday.getMonth() + 1).padStart(2, '0');
  const d = String(lastFriday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 전략 상태를 계산하는 순수 함수.
 * today를 외부에서 주입받아 테스트 시 임의 날짜 사용 가능.
 */
export function computePortfolioStatus(
  latest: LatestRanking[],
  history: HistoryResponse | undefined,
  today: Date,
): PortfolioState {
  const prevHoldingSymbols = getPrevMonthHoldings(latest, history, today);
  const holdingSet = new Set(prevHoldingSymbols);

  // 현재 latest 데이터에서 보유 종목 상태 결정
  const holdings: HoldingItem[] = prevHoldingSymbols.map((sym) => {
    const current = latest.find((e) => e.symbol === sym);
    if (!current) {
      // 유니버스에서 사라진 경우 — SELL 처리
      return { symbol: sym, rank: 999, total_score: 0, status: 'SELL' as HoldingStatus };
    }

    let status: HoldingStatus;
    if (current.total_score <= 0) {
      status = 'SELL';
    } else if (current.rank >= SELL_MIN_RANK) {
      status = 'SELL';
    } else if (current.rank > HOLD_TOP_N) {
      status = 'BUFFER';
    } else {
      status = 'HOLD';
    }

    return { symbol: sym, rank: current.rank, total_score: current.total_score, status };
  });

  const sellCount = holdings.filter((h) => h.status === 'SELL').length;

  // SELL 종목 대체 후보: score > 0이면서 현재 미보유인 최상위 ETF
  const replacements: HoldingItem[] = latest
    .filter((e) => !holdingSet.has(e.symbol) && e.total_score > 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, sellCount)
    .map((e) => ({
      symbol: e.symbol,
      rank: e.rank,
      total_score: e.total_score,
      status: 'WATCH' as HoldingStatus,
    }));

  const allCashWarning = holdings.every((h) => h.status === 'SELL');
  const actionRequired = holdings.some((h) => h.status === 'SELL' || h.status === 'BUFFER');

  return {
    holdings,
    replacements: allCashWarning ? [] : replacements,
    actionRequired,
    nextCheckDate: getLastFridayOfMonth(today),
    allCashWarning,
  };
}
