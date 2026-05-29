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
