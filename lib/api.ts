const API = process.env.NEXT_PUBLIC_API_URL || 'http://120.142.101.230:3000';

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

export const urls = {
  latest: () => `${API}/ranking/latest`,
  history: (days = 90, limit = 10) =>
    `${API}/ranking/history?days=${days}&limit=${limit}`,
  symbolLatest: (symbol: string) =>
    `${API}/ranking/symbol/${symbol}/latest`,
};

export const CHART_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#a78bfa',
];
