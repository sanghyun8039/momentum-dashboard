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
