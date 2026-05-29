'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import Chart from 'chart.js/auto';
import { SymbolLatest } from '@/lib/types';
import { fetcher, urls } from '@/lib/api';

interface Props {
  symbol: string | null;
}

const BD_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];

export function ScoreBreakdownBar({ symbol }: Props) {
  const { data } = useSWR<SymbolLatest>(
    symbol ? urls.symbolLatest(symbol) : null,
    fetcher,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const vals = [data.score_1m, data.score_3m, data.score_6m, data.score_12m];

    if (chartRef.current) {
      // 데이터만 업데이트 (차트 재생성 불필요)
      (chartRef.current.data.datasets[0] as any).data = vals;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: ['1M', '3M', '6M', '12M'],
        datasets: [{ data: vals, backgroundColor: BD_COLORS, borderRadius: 3, barThickness: 13 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, bodyColor: '#f1f5f9',
            callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(3)}` },
          },
        },
        scales: {
          x: {
            grid: { color: '#1a2840' },
            ticks: { color: '#475569', font: { size: 9 } },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 10, family: 'ui-monospace, Menlo, monospace' },
            },
            border: { display: false },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  // 선택 없거나 데이터 로딩 중
  if (!symbol || !data) {
    return (
      <div className="flex items-center h-full px-5 text-[12px] text-slate-500 border-t border-slate-700">
        ETF를 클릭하면 기간별 모멘텀 스코어가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="h-full px-5 py-2.5 border-t border-slate-700">
      {/* 헤더: 심볼 + 통계 */}
      <div className="flex items-center gap-3 mb-1.5 overflow-hidden">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {symbol} — Score Breakdown
        </span>
        <span className="text-[11px] text-slate-400">
          Total: <strong className="text-slate-100 tabular-nums">{data.total_score.toFixed(2)}</strong>
        </span>
        <span className="text-[11px] text-slate-400">
          Rank: <strong className="text-slate-100 tabular-nums">#{data.rank}</strong>
        </span>
        <span className="ml-auto text-[10px] text-slate-500 tabular-nums">{data.date}</span>
      </div>
      {/* 차트 영역 */}
      <div className="relative" style={{ height: '62px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
