import type { BattleCampaign, BattleResult } from '../types';

interface BattleInfoPanelProps {
  battle: BattleCampaign | null;
  onClose: () => void;
}

const resultLabel: Record<BattleResult, string> = {
  victory: '胜利',
  stalemate: '平局',
  defeat: '败北',
};

const resultColor: Record<BattleResult, string> = {
  victory: 'bg-red-700',
  stalemate: 'bg-amber-700',
  defeat: 'bg-slate-600',
};

/** 格式化日期 */
function formatDateRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey) {
    return `${sy} 年 ${Number(sm)} 月 ${Number(sd)} 日 — ${Number(em)} 月 ${Number(ed)} 日`;
  }
  return `${sy} 年 ${Number(sm)} 月 ${Number(sd)} 日 — ${ey} 年 ${Number(em)} 月 ${Number(ed)} 日`;
}

export default function BattleInfoPanel({ battle, onClose }: BattleInfoPanelProps) {
  if (!battle) return null;

  // 共用内容渲染
  const content = (
    <>
      {/* 装饰条纹 */}
      <div className="h-1 shrink-0 bg-gradient-to-r from-red-800 via-amber-600 to-red-800" />

      {/* 头部 */}
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-bold tracking-wide text-white sm:text-xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {battle.name}
          </h2>
          <p className="mt-1 text-[11px] font-light tracking-wider text-slate-400 uppercase sm:text-xs">
            {battle.nameEn}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/50 transition-colors hover:border-white/40 hover:text-white sm:h-8 sm:w-8 cursor-pointer"
          aria-label="关闭面板"
        >
          ✕
        </button>
      </div>

      {/* 标签行 */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-5 py-2.5 sm:px-6 sm:py-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white sm:text-xs ${resultColor[battle.result]}`}>
          🏁 {resultLabel[battle.result]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300 sm:text-xs">
          📅 {formatDateRange(battle.startDate, battle.endDate)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300 sm:text-xs">
          📍 {battle.location}
        </span>
      </div>

      {/* 战果 */}
      <div className="border-b border-white/5 px-5 py-2.5 sm:px-6 sm:py-3">
        <p className="text-xs leading-relaxed text-amber-200/85 sm:text-sm">
          {battle.resultSummary}
        </p>
      </div>

      {/* 日记正文（可滚动） */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6 sm:py-4">
        {/* 标题装饰 */}
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
          <span className="shrink-0 text-[10px] font-medium tracking-[0.2em] text-red-400/60 uppercase sm:text-xs">
            战 役 日 记
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </div>

        <div className="space-y-3 text-[13px] leading-relaxed text-slate-300 sm:text-sm">
          {battle.diaryEntry.split('\n\n').map((para, i) => (
            <p key={i} className="indent-5 first:indent-0 first:font-medium first:text-white/85">
              {para}
            </p>
          ))}
        </div>

        {/* 历史意义 */}
        <div className="mt-5 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium tracking-wide text-amber-400/70 uppercase sm:text-xs">
            📖 历史意义
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400 sm:text-sm">
            {battle.significance}
          </p>
        </div>

        {/* 参战部队 */}
        <div className="mt-4">
          <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase sm:text-xs">
            ⚔️ 参战部队
          </p>
          <div className="mt-2 flex flex-wrap gap-1 sm:gap-1.5">
            {battle.participatingUnits.map((unit) => (
              <span
                key={unit}
                className="rounded border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400 sm:text-xs"
              >
                {unit}
              </span>
            ))}
          </div>
        </div>

        <div className="h-4 sm:h-6" />
      </div>
    </>
  );

  return (
    <>
      {/* ========= 桌面：右侧侧边栏 ========= */}
      <aside
        className="absolute top-0 right-0 z-10 hidden h-full w-full max-w-md animate-slide-in flex-col border-l border-white/10 bg-gradient-to-b from-slate-900/96 via-slate-900/98 to-slate-950/96 shadow-2xl backdrop-blur-xl md:flex"
        role="dialog"
        aria-label={`${battle.name} 详细信息`}
      >
        {content}
      </aside>

      {/* ========= 移动端：底部抽屉 ========= */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end md:hidden">
        {/* 遮罩 */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-slide-in"
          onClick={onClose}
        />
        {/* 抽屉本体 */}
        <aside
          className="animate-slide-up relative flex max-h-[70vh] flex-col rounded-t-2xl border-t border-white/10 bg-gradient-to-b from-slate-900/98 to-slate-950 shadow-2xl"
          role="dialog"
          aria-label={`${battle.name} 详细信息`}
        >
          {/* 拖拽指示条 */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
          {content}
        </aside>
      </div>
    </>
  );
}
