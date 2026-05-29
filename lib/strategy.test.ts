import { computePortfolioStatus } from './strategy';
import { LatestRanking, HistoryResponse } from './types';

// 테스트용 더미 데이터 생성 헬퍼
function makeLatest(overrides: Partial<LatestRanking>[] = []): LatestRanking[] {
  const base: LatestRanking[] = [
    { symbol: 'EWY', rank: 1, total_score: 10.0, date: '2026-05-29', price: 200, score_1m: 4, score_3m: 2, score_6m: 2, score_12m: 2, created_at: '' },
    { symbol: 'UFO', rank: 2, total_score: 9.0,  date: '2026-05-29', price: 60,  score_1m: 3, score_3m: 2, score_6m: 2, score_12m: 2, created_at: '' },
    { symbol: 'SOXX', rank: 3, total_score: 8.0, date: '2026-05-29', price: 500, score_1m: 3, score_3m: 2, score_6m: 2, score_12m: 1, created_at: '' },
    { symbol: 'TAN', rank: 4, total_score: 5.0,  date: '2026-05-29', price: 70,  score_1m: 2, score_3m: 1, score_6m: 1, score_12m: 1, created_at: '' },
    { symbol: 'AIQ', rank: 5, total_score: 4.0,  date: '2026-05-29', price: 60,  score_1m: 2, score_3m: 1, score_6m: 1, score_12m: 0, created_at: '' },
    { symbol: 'GLD', rank: 39, total_score: -0.5, date: '2026-05-29', price: 400, score_1m: -1, score_3m: 0, score_6m: 0, score_12m: 0, created_at: '' },
  ];
  return base.map((item, i) => ({ ...item, ...(overrides[i] ?? {}) }));
}

function makeHistory(prevTop3 = ['EWY', 'UFO', 'SOXX']): HistoryResponse {
  const prevDate = '2026-04-30';
  const dataPoint: Record<string, string | number> = { date: prevDate };
  prevTop3.forEach((sym, i) => { dataPoint[sym] = i + 1; });
  return {
    symbols: prevTop3,
    data: [{ date: prevDate, ...dataPoint }],
  };
}

const TODAY = new Date('2026-05-29');

describe('computePortfolioStatus', () => {
  test('모두 HOLD — Top 3 유지, score 양수', () => {
    const latest = makeLatest();
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    expect(state.holdings).toHaveLength(3);
    expect(state.holdings[0]).toMatchObject({ symbol: 'EWY', status: 'HOLD' });
    expect(state.holdings[1]).toMatchObject({ symbol: 'UFO', status: 'HOLD' });
    expect(state.holdings[2]).toMatchObject({ symbol: 'SOXX', status: 'HOLD' });
    expect(state.actionRequired).toBe(false);
    expect(state.allCashWarning).toBe(false);
    expect(state.replacements).toHaveLength(0);
  });

  test('BUFFER — 보유 종목이 4~6위로 밀림', () => {
    const latest = makeLatest();
    // SOXX를 5위로 변경
    latest.find((e) => e.symbol === 'SOXX')!.rank = 5;
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    const soxx = state.holdings.find((h) => h.symbol === 'SOXX');
    expect(soxx?.status).toBe('BUFFER');
    expect(state.actionRequired).toBe(true);
    expect(state.replacements).toHaveLength(0); // SELL 없음
  });

  test('SELL — 7위 이하로 이탈', () => {
    const latest = makeLatest();
    latest.find((e) => e.symbol === 'SOXX')!.rank = 8;
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    const soxx = state.holdings.find((h) => h.symbol === 'SOXX');
    expect(soxx?.status).toBe('SELL');
    expect(state.actionRequired).toBe(true);
    expect(state.replacements).toHaveLength(1);
    expect(state.replacements[0].symbol).toBe('TAN'); // 미보유 중 최상위
  });

  test('SELL — score가 0 이하로 전환', () => {
    const latest = makeLatest();
    latest.find((e) => e.symbol === 'SOXX')!.total_score = -0.1;
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    const soxx = state.holdings.find((h) => h.symbol === 'SOXX');
    expect(soxx?.status).toBe('SELL');
  });

  test('allCashWarning — Top 3 모두 score 음수', () => {
    const latest = makeLatest();
    ['EWY', 'UFO', 'SOXX'].forEach((sym) => {
      latest.find((e) => e.symbol === sym)!.total_score = -1;
    });
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    expect(state.allCashWarning).toBe(true);
    expect(state.actionRequired).toBe(true);
    expect(state.replacements).toHaveLength(0); // 대체 후보도 score 양수여야 함
  });

  test('history 없으면 현재 Top 3 fallback', () => {
    const latest = makeLatest();
    const state = computePortfolioStatus(latest, undefined, TODAY);

    expect(state.holdings.map((h) => h.symbol)).toEqual(['EWY', 'UFO', 'SOXX']);
  });

  test('nextCheckDate는 이번 달 마지막 금요일', () => {
    // 2026년 5월 마지막 금요일: 5월 29일
    const state = computePortfolioStatus(makeLatest(), makeHistory(), new Date('2026-05-01'));
    expect(state.nextCheckDate).toBe('2026-05-29');
  });

  test('대체 후보는 score > 0인 미보유 ETF', () => {
    const latest = makeLatest();
    // SOXX SELL, GLD는 score < 0이므로 대체 후보 제외
    latest.find((e) => e.symbol === 'SOXX')!.rank = 8;
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    expect(state.replacements[0].symbol).toBe('TAN');
    expect(state.replacements.every((r) => r.total_score > 0)).toBe(true);
  });

  test('경계값 — 6위는 BUFFER, 7위는 SELL', () => {
    const latest = makeLatest();
    latest.find((e) => e.symbol === 'UFO')!.rank = 6;
    latest.find((e) => e.symbol === 'SOXX')!.rank = 7;
    const history = makeHistory();
    const state = computePortfolioStatus(latest, history, TODAY);

    expect(state.holdings.find((h) => h.symbol === 'UFO')?.status).toBe('BUFFER');
    expect(state.holdings.find((h) => h.symbol === 'SOXX')?.status).toBe('SELL');
  });
});
