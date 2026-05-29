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
