interface HeaderProps {
  updatedAt: string;
  universeCount?: number;
  periodDays?: number;
}

export function Header({ updatedAt, universeCount = 10, periodDays = 90 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-12 px-5 bg-slate-800 border-b border-slate-700 flex-shrink-0">
      {/* Left: Title + Badge */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold tracking-tight text-slate-100">
          ETF Momentum
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full text-blue-400 bg-blue-500/10 border border-blue-500/20">
          Dashboard
        </span>
      </div>

      {/* Right: Stats + Live + Updated */}
      <div className="flex items-center gap-4">
        {/* Universe */}
        <div className="flex flex-col items-end gap-0">
          <span className="text-[9px] uppercase tracking-widest text-slate-500">Universe</span>
          <span className="text-[12px] font-semibold text-slate-100 tabular-nums">{universeCount} ETFs</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-700" />

        {/* Period */}
        <div className="flex flex-col items-end gap-0">
          <span className="text-[9px] uppercase tracking-widest text-slate-500">Period</span>
          <span className="text-[12px] font-semibold text-slate-100 tabular-nums">{periodDays} days</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-700" />

        {/* Live dot */}
        <div className="flex items-center gap-1 text-[11px] text-green-400">
          <div className="live-dot" />
          <span>Live</span>
        </div>

        {/* Updated timestamp */}
        <span className="text-[11px] text-slate-500 tabular-nums">
          Updated: {updatedAt}
        </span>
      </div>
    </header>
  );
}
