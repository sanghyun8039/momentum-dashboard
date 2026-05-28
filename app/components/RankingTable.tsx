import { LatestRanking } from '@/lib/types';
import { CHART_COLORS } from '@/lib/api';

interface Props {
  data: LatestRanking[];
  selectedSymbol: string | null;
  onSelect: (symbol: string | null) => void; // null = 선택 해제
}

export function RankingTable({ data, selectedSymbol, onSelect }: Props) {
  const maxScore = Math.max(...data.map((d) => d.total_score));

  return (
    <div className="flex flex-col p-3 overflow-y-auto h-full table-scroll">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
        Today&apos;s Ranking
      </p>
      <div className="flex flex-col gap-0.5">
        {data.map((item, i) => (
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
                  width: `${(item.total_score / maxScore) * 100}%`,
                  backgroundColor: CHART_COLORS[i] ?? '#475569',
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 w-9 text-right shrink-0 tabular-nums">
              {item.total_score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
