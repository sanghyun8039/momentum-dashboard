'use client';

import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { HistoryDataPoint } from '@/lib/types';
import { CHART_COLORS } from '@/lib/api';

interface Props {
  symbols: string[];
  data: HistoryDataPoint[];
  selectedSymbol: string | null;
  highlightSymbols?: string[]; // 포트폴리오 보유 종목 — 굵게 강조
}

export function RankTrendChart({ symbols, data, selectedSymbol, highlightSymbols = [] }: Props) {
  const [topN, setTopN] = useState<5 | 10>(10);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

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

  // 데이터가 바뀔 때 차트 초기화
  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const labels = data.map((d) => (d.date as string).slice(5)); // MM-DD

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets: buildDatasets(topN, selectedSymbol, highlightSymbols) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8', font: { size: 11 }, boxWidth: 20,
              padding: 14, usePointStyle: true, pointStyleWidth: 10,
            },
          },
          tooltip: {
            backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
            titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}  #${ctx.raw}` },
          },
        },
        scales: {
          x: {
            grid: { color: '#1a2840' },
            ticks: { color: '#475569', font: { size: 10 }, maxTicksLimit: 10, maxRotation: 0 },
            border: { display: false },
          },
          y: {
            reverse: true, min: 1, max: topN,
            grid: { color: '#1a2840' },
            ticks: {
              color: '#475569',
              font: { size: 10, family: 'ui-monospace, Menlo, monospace' },
              stepSize: 1,
              callback: (v) => `#${v}`,
            },
            border: { display: false },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // topN 또는 selectedSymbol 변경 시 데이터셋만 업데이트
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.data.datasets = buildDatasets(topN, selectedSymbol, highlightSymbols);
    (chartRef.current.options.scales as any).y.max = topN;
    chartRef.current.update('none');
  }, [topN, selectedSymbol, highlightSymbols]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Rank Trend — 90 Days
        </span>
        <div className="flex gap-1">
          {([5, 10] as const).map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`text-[11px] px-3 py-1 rounded border transition-all ${
                topN === n
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-transparent border-slate-700 text-slate-500 hover:bg-slate-800 hover:text-slate-400'
              }`}
            >
              TOP {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative min-h-0">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
