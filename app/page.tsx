'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Header } from './components/Header';
import { RankingTable } from './components/RankingTable';
import { RankTrendChart } from './components/RankTrendChart';
import { ScoreBreakdownBar } from './components/ScoreBreakdownBar';
import { fetcher, urls } from '@/lib/api';
import { LatestRanking, HistoryResponse } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SWR_OPTIONS = { refreshInterval: 60 * 60 * 1000 }; // 1시간

function ApiError() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 text-sm">
      <span>백엔드 API 연결 실패</span>
      <span className="text-xs text-slate-600">{API_URL} — RPi 상태를 확인하세요</span>
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

  // 선택 없으면 1위 ETF를 기본으로
  const activeSymbol = selectedSymbol ?? (latest?.[0]?.symbol ?? null);
  const updatedAt = latest?.[0]?.date ?? '—';

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
            <ApiError />
          ) : history ? (
            <RankTrendChart
              symbols={history.symbols}
              data={history.data}
              selectedSymbol={selectedSymbol}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              데이터 로딩 중...
            </div>
          )}
        </div>

        <div className="flex-[35] overflow-y-auto">
          {latestError ? (
            <ApiError />
          ) : latest ? (
            <RankingTable
              data={latest}
              selectedSymbol={selectedSymbol}
              onSelect={setSelectedSymbol}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              데이터 로딩 중...
            </div>
          )}
        </div>
      </div>

      {/* 하단: 점수 분해 — 110px 고정 (프로토타입 확인된 값) */}
      <div className="flex-shrink-0 h-[110px]">
        <ScoreBreakdownBar symbol={activeSymbol} />
      </div>
    </div>
  );
}
