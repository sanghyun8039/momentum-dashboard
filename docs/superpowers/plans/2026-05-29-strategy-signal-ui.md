# Strategy Signal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하단 ScoreBreakdownBar를 포트폴리오 상태 바로 교체하고, 랭킹 테이블과 추이 차트에 보유 종목 상태를 시각화한다.

**Architecture:** `lib/strategy.ts`의 순수 함수 `computePortfolioStatus`가 전략 로직을 전담한다. `page.tsx`가 `latest`, `history`, `today`를 주입하여 `PortfolioState`를 계산하고, 이를 `PortfolioStatusBar` / `RankingTable` / `RankTrendChart` 세 컴포넌트에 전달한다.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Chart.js

---

## 파일 맵

| 파일 | 변경 | 역할 |
|------|------|------|
| `lib/types.ts` | 수정 | `HoldingStatus`, `HoldingItem`, `PortfolioState` 타입 추가 |
| `lib/strategy.ts` | 신규 | `computePortfolioStatus` 순수 함수 |
| `app/components/PortfolioStatusBar.tsx` | 신규 | 하단 110px 포트폴리오 상태 바 |
| `app/components/RankingTable.tsx` | 수정 | 상태 태그 컬럼 추가, `portfolioState` prop 수신 |
| `app/components/RankTrendChart.tsx` | 수정 | `highlightSymbols` prop 추가 |
| `app/page.tsx` | 수정 | `ScoreBreakdownBar` → `PortfolioStatusBar`, `PortfolioState` 계산 및 전달 |
| `app/components/ScoreBreakdownBar.tsx` | 삭제 | 더 이상 사용하지 않음 |

---

### Task 1: 타입 정의 추가

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: `lib/types.ts`에 타입 추가**

파일 하단에 아래 타입들을 추가한다:

```typescript
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
```

- [ ] **Step 2: 커밋**

```bash
git add lib/types.ts
git commit -m "feat: PortfolioState 타입 정의 추가"
```

---

### Task 2: 전략 로직 순수 함수 구현

**Files:**
- Create: `lib/strategy.ts`

- [ ] **Step 1: `lib/strategy.ts` 생성**

```typescript
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

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

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
  return lastFriday.toISOString().slice(0, 10);
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
    replacements,
    actionRequired,
    nextCheckDate: getLastFridayOfMonth(today),
    allCashWarning,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add lib/strategy.ts
git commit -m "feat: computePortfolioStatus 순수 함수 구현"
```

---

### Task 3: 전략 로직 유닛 테스트

**Files:**
- Create: `lib/strategy.test.ts`

- [ ] **Step 1: 테스트 파일 생성**

```typescript
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
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/research/Documents/momentum-dashboard-main
npx jest lib/strategy.test.ts --no-coverage 2>&1 | tail -20
```

기대 결과: 테스트 파일은 통과해야 함 (strategy.ts가 이미 구현됨)

- [ ] **Step 3: 커밋**

```bash
git add lib/strategy.test.ts
git commit -m "test: computePortfolioStatus 유닛 테스트 추가"
```

---

### Task 4: PortfolioStatusBar 컴포넌트 구현

**Files:**
- Create: `app/components/PortfolioStatusBar.tsx`

- [ ] **Step 1: 컴포넌트 생성**

```typescript
'use client';

import { PortfolioState, HoldingItem, HoldingStatus } from '@/lib/types';
import { CHART_COLORS } from '@/lib/api';

interface Props {
  portfolioState: PortfolioState | null;
}

const STATUS_STYLES: Record<HoldingStatus, { tag: string; sym: string }> = {
  HOLD:   { tag: 'bg-green-900/60 text-green-400',  sym: '' },
  BUFFER: { tag: 'bg-yellow-900/60 text-yellow-400', sym: '' },
  SELL:   { tag: 'bg-red-900/60 text-red-400',       sym: '' },
  WATCH:  { tag: 'bg-slate-800 text-slate-500',       sym: '' },
};

function HoldingCard({ item, index }: { item: HoldingItem; index: number }) {
  const color = CHART_COLORS[index] ?? '#475569';
  const { tag } = STATUS_STYLES[item.status];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[14px] font-extrabold font-mono leading-none" style={{ color }}>
        {item.symbol}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-slate-500">#{item.rank}</span>
        <span className="text-[9px] text-slate-600 tabular-nums">{item.total_score.toFixed(2)}</span>
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${tag}`}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

function ActionBox({ state }: { state: PortfolioState }) {
  if (state.allCashWarning) {
    return (
      <div className="rounded-md px-3 py-2 text-center min-w-[130px] bg-red-950/50 border border-red-800">
        <div className="text-[8px] font-bold uppercase tracking-widest text-red-700 mb-1">이번 달 액션</div>
        <div className="text-[12px] font-bold text-red-400">현금 보유 권장</div>
        <div className="text-[9px] text-red-900 mt-0.5">전체 모멘텀 음수</div>
      </div>
    );
  }

  const sells = state.holdings.filter((h) => h.status === 'SELL');
  const buffers = state.holdings.filter((h) => h.status === 'BUFFER');

  if (sells.length > 0) {
    const sellSyms = sells.map((h) => h.symbol).join(', ');
    const replaceSyms = state.replacements.map((r) => r.symbol).join(', ') || '후보 없음';
    return (
      <div className="rounded-md px-3 py-2 text-center min-w-[130px] bg-red-950/50 border border-red-800">
        <div className="text-[8px] font-bold uppercase tracking-widest text-red-700 mb-1">이번 달 액션</div>
        <div className="text-[12px] font-bold text-red-400">{sellSyms} 매도 신호</div>
        <div className="text-[9px] text-red-800 mt-0.5">{replaceSyms} 편입 예정</div>
      </div>
    );
  }

  if (buffers.length > 0) {
    const bufSyms = buffers.map((h) => h.symbol).join(', ');
    return (
      <div className="rounded-md px-3 py-2 text-center min-w-[130px] bg-yellow-950/50 border border-yellow-800">
        <div className="text-[8px] font-bold uppercase tracking-widest text-yellow-700 mb-1">이번 달 액션</div>
        <div className="text-[12px] font-bold text-yellow-400">{bufSyms} 주시 ⚠</div>
        <div className="text-[9px] text-yellow-900 mt-0.5">7위↓ 시 교체</div>
      </div>
    );
  }

  return (
    <div className="rounded-md px-3 py-2 text-center min-w-[130px] bg-slate-900 border border-slate-700">
      <div className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">이번 달 액션</div>
      <div className="text-[12px] font-bold text-green-400">변동 없음 ✓</div>
      <div className="text-[9px] text-slate-600 mt-0.5">다음 체크: {state.nextCheckDate}</div>
    </div>
  );
}

export function PortfolioStatusBar({ portfolioState }: Props) {
  if (!portfolioState) {
    return (
      <div className="flex items-center h-full px-5 text-[12px] text-slate-600 border-t border-slate-700">
        전략 데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="h-full px-5 border-t border-slate-700 flex items-center gap-0">
      {/* 레이블 */}
      <span
        className="text-[8px] font-bold uppercase tracking-widest text-slate-700 mr-4"
        style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
      >
        Portfolio
      </span>

      {/* 보유 종목 */}
      <div className="flex items-center gap-5 flex-1">
        {portfolioState.holdings.map((item, i) => (
          <div key={item.symbol} className="flex items-center gap-5">
            <HoldingCard item={item} index={i} />
            {i < portfolioState.holdings.length - 1 && (
              <div className="w-px h-8 bg-slate-700" />
            )}
          </div>
        ))}
      </div>

      {/* 액션 박스 */}
      <div className="mx-4">
        <ActionBox state={portfolioState} />
      </div>

      {/* 전략 기준 요약 */}
      <div className="pl-4 border-l border-slate-700">
        <div className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">전략 기준</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500">보유 <span className="text-slate-400">Top 3 (각 33.3%)</span></span>
          <span className="text-[9px] text-slate-500">청산 <span className="text-slate-400">7위↓ or score &lt; 0</span></span>
          <span className="text-[9px] text-slate-500">주기 <span className="text-slate-400">월 1회 체크</span></span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/components/PortfolioStatusBar.tsx
git commit -m "feat: PortfolioStatusBar 컴포넌트 구현"
```

---

### Task 5: RankingTable에 상태 태그 추가

**Files:**
- Modify: `app/components/RankingTable.tsx`

- [ ] **Step 1: `portfolioState` prop 추가 및 태그 렌더링**

`RankingTable.tsx` 전체를 다음으로 교체한다:

```typescript
import { LatestRanking, PortfolioState, HoldingStatus } from '@/lib/types';
import { CHART_COLORS } from '@/lib/api';

interface Props {
  data: LatestRanking[];
  selectedSymbol: string | null;
  onSelect: (symbol: string | null) => void;
  portfolioState: PortfolioState | null;
}

const STATUS_TAG: Record<HoldingStatus, { label: string; cls: string }> = {
  HOLD:   { label: 'HOLD',   cls: 'bg-green-900/60 text-green-400' },
  BUFFER: { label: 'BUFFER', cls: 'bg-yellow-900/60 text-yellow-400' },
  SELL:   { label: 'SELL',   cls: 'bg-red-900/60 text-red-400' },
  WATCH:  { label: '대기',   cls: 'bg-slate-800 text-slate-500' },
};

export function RankingTable({ data, selectedSymbol, onSelect, portfolioState }: Props) {
  const maxScore = Math.max(...data.map((d) => d.total_score));
  const minScore = Math.min(0, ...data.map((d) => d.total_score));
  const range = maxScore - minScore;

  // 보유 종목 상태 맵
  const statusMap = new Map<string, HoldingStatus>();
  if (portfolioState) {
    portfolioState.holdings.forEach((h) => statusMap.set(h.symbol, h.status));
    // Top 10 미보유 종목은 WATCH
    data.slice(0, 10).forEach((item) => {
      if (!statusMap.has(item.symbol)) {
        statusMap.set(item.symbol, 'WATCH');
      }
    });
  }

  return (
    <div className="flex flex-col p-3 overflow-y-auto h-full table-scroll">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
        Today&apos;s Ranking
      </p>
      <div className="flex flex-col gap-0.5">
        {data.map((item, i) => {
          const status = statusMap.get(item.symbol);
          const tag = status ? STATUS_TAG[status] : null;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelect(item.symbol === selectedSymbol ? null : item.symbol)}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
              style={{
                borderLeft: `2.5px solid ${CHART_COLORS[i] ?? '#334155'}`,
                background: selectedSymbol === item.symbol ? 'var(--s3)' : undefined,
              }}
              onMouseEnter={(e) => {
                if (selectedSymbol !== item.symbol)
                  (e.currentTarget as HTMLElement).style.background = 'var(--s2)';
              }}
              onMouseLeave={(e) => {
                if (selectedSymbol !== item.symbol)
                  (e.currentTarget as HTMLElement).style.background = '';
              }}
            >
              <span
                className="text-[11px] font-bold w-5 shrink-0 text-right tabular-nums"
                style={{ color: i < 3 ? CHART_COLORS[i] : '#64748b' }}
              >
                {item.rank}
              </span>
              <span className="text-[12px] font-semibold w-10 shrink-0" style={{ color: CHART_COLORS[i] }}>
                {item.symbol}
              </span>
              <div className="flex-1 h-1 rounded overflow-hidden" style={{ background: '#1a2840' }}>
                <div
                  className="h-1 rounded transition-all duration-300"
                  style={{
                    width: `${Math.max(0, (item.total_score - minScore) / range) * 100}%`,
                    backgroundColor: CHART_COLORS[i] ?? '#475569',
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500 w-9 text-right shrink-0 tabular-nums">
                {item.total_score.toFixed(2)}
              </span>
              <div className="w-12 flex justify-end shrink-0">
                {tag && (
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${tag.cls}`}>
                    {tag.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/components/RankingTable.tsx
git commit -m "feat: RankingTable에 포트폴리오 상태 태그 추가"
```

---

### Task 6: RankTrendChart에 highlightSymbols prop 추가

**Files:**
- Modify: `app/components/RankTrendChart.tsx`

- [ ] **Step 1: `highlightSymbols` prop 추가**

`RankTrendChart.tsx`의 Props 인터페이스와 `buildDatasets` 함수를 수정한다:

```typescript
interface Props {
  symbols: string[];
  data: HistoryDataPoint[];
  selectedSymbol: string | null;
  highlightSymbols?: string[]; // 포트폴리오 보유 종목 — 굵게 강조
}

export function RankTrendChart({ symbols, data, selectedSymbol, highlightSymbols = [] }: Props) {
```

그리고 `buildDatasets` 함수를 다음으로 교체한다:

```typescript
function buildDatasets(n: number, selected: string | null, highlights: string[]) {
  return symbols.slice(0, n).map((sym, i) => {
    const isSelected = selected === null || selected === sym;
    const isHighlighted = highlights.length === 0 || highlights.includes(sym);
    const isActive = isSelected && isHighlighted;

    return {
      label: sym,
      data: data.map((d) => d[sym] as number),
      borderColor: isActive
        ? CHART_COLORS[i]
        : CHART_COLORS[i] + '22',
      backgroundColor: 'transparent',
      borderWidth: highlights.includes(sym) ? 3 : isActive ? 2.5 : 0.8,
      pointRadius: 0,
      pointHoverRadius: isActive ? 4 : 0,
      tension: 0.35,
    };
  });
}
```

`useEffect` 내부에서 `buildDatasets` 호출 부분도 업데이트한다:

```typescript
// 데이터가 바뀔 때 차트 초기화 (useEffect #1)
chartRef.current = new Chart(canvasRef.current, {
  type: 'line',
  data: { labels, datasets: buildDatasets(topN, selectedSymbol, highlightSymbols) },
  // ...나머지 options 동일
});

// topN, selectedSymbol, highlightSymbols 변경 시 데이터셋 업데이트 (useEffect #2)
useEffect(() => {
  if (!chartRef.current) return;
  chartRef.current.data.datasets = buildDatasets(topN, selectedSymbol, highlightSymbols);
  (chartRef.current.options.scales as any).y.max = topN;
  chartRef.current.update('none');
}, [topN, selectedSymbol, highlightSymbols]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: 커밋**

```bash
git add app/components/RankTrendChart.tsx
git commit -m "feat: RankTrendChart에 highlightSymbols prop 추가"
```

---

### Task 7: page.tsx 조합 — PortfolioState 계산 및 컴포넌트 연결

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: `page.tsx` 전체 교체**

```typescript
'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Header } from './components/Header';
import { RankingTable } from './components/RankingTable';
import { RankTrendChart } from './components/RankTrendChart';
import { PortfolioStatusBar } from './components/PortfolioStatusBar';
import { fetcher, urls } from '@/lib/api';
import { LatestRanking, HistoryResponse } from '@/lib/types';
import { computePortfolioStatus } from '@/lib/strategy';

const SWR_OPTIONS = { refreshInterval: 60 * 60 * 1000 }; // 1시간

function ApiError({ apiUrl }: { apiUrl: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 text-sm">
      <span>백엔드 API 연결 실패</span>
      <span className="text-xs text-slate-600">{apiUrl} — RPi 상태를 확인하세요</span>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const { data: latest, error: latestError } = useSWR<LatestRanking[]>(
    urls.latest(),
    fetcher,
    SWR_OPTIONS,
  );
  const { data: history, error: historyError } = useSWR<HistoryResponse>(
    urls.history(),
    fetcher,
    SWR_OPTIONS,
  );

  // 전략 상태 계산 (순수 함수, today 주입)
  const portfolioState = useMemo(() => {
    if (!latest) return null;
    return computePortfolioStatus(latest, history, new Date());
  }, [latest, history]);

  const activeSymbol = selectedSymbol ?? (latest?.[0]?.symbol ?? null);
  const updatedAt = latest?.[0]?.date ?? '—';
  const highlightSymbols = portfolioState?.holdings.map((h) => h.symbol) ?? [];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <Header
        updatedAt={updatedAt}
        universeCount={latest?.length ?? 0}
        periodDays={90}
      />

      {/* 메인: 차트 65% + 테이블 35% */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[65] border-r border-slate-700 overflow-hidden">
          {historyError ? (
            <ApiError apiUrl={apiUrl} />
          ) : history ? (
            <RankTrendChart
              symbols={history.symbols}
              data={history.data}
              selectedSymbol={selectedSymbol}
              highlightSymbols={highlightSymbols}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              데이터 로딩 중...
            </div>
          )}
        </div>

        <div className="flex-[35] overflow-y-auto">
          {latestError ? (
            <ApiError apiUrl={apiUrl} />
          ) : latest ? (
            <RankingTable
              data={latest}
              selectedSymbol={selectedSymbol}
              onSelect={setSelectedSymbol}
              portfolioState={portfolioState}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              데이터 로딩 중...
            </div>
          )}
        </div>
      </div>

      {/* 하단: 포트폴리오 상태 바 — 110px 고정 */}
      <div className="flex-shrink-0 h-[110px]">
        <PortfolioStatusBar portfolioState={portfolioState} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: page.tsx에 PortfolioState 계산 및 컴포넌트 연결"
```

---

### Task 8: ScoreBreakdownBar 삭제 및 빌드 검증

**Files:**
- Delete: `app/components/ScoreBreakdownBar.tsx`

- [ ] **Step 1: ScoreBreakdownBar 삭제**

```bash
rm app/components/ScoreBreakdownBar.tsx
```

- [ ] **Step 2: 타입스크립트 빌드 검증**

```bash
npx tsc --noEmit 2>&1
```

기대 결과: 에러 없음. 에러 있으면 해당 파일 수정 후 재실행.

- [ ] **Step 3: Next.js 프로덕션 빌드**

```bash
npm run build 2>&1 | tail -30
```

기대 결과: `✓ Compiled successfully` 포함, 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: ScoreBreakdownBar 제거, 전략 신호 UI 완성"
```

---

### Task 9: RPi 배포

- [ ] **Step 1: 로컬에서 push**

```bash
git push origin main
```

- [ ] **Step 2: RPi에서 pull 및 재빌드**

RPi SSH 접속 후:

```bash
cd ~/momentum-dashboard
git pull
npm run build
pm2 restart momentum-dashboard
```

- [ ] **Step 3: 브라우저에서 확인**

`http://120.142.101.230:3002` 접속 후:
- 하단 바에 EWY / UFO / SOXX 3개 종목과 상태 태그(HOLD/BUFFER/SELL) 표시 확인
- 차트에서 보유 종목 라인이 굵게 하이라이트 확인
- 랭킹 테이블 상위 행에 태그 표시 확인
- "이번 달 액션" 박스 텍스트 확인
