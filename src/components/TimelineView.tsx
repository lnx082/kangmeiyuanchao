import { useEffect, useRef } from 'react';
import type { BattleCampaign, BattleResult } from '../types';

interface TimelineViewProps {
  battles: BattleCampaign[];
  selectedBattleId: string | null;
  onBattleSelect: (id: string) => void;
}

/** 结果徽章配置 — 使用设计令牌色 */
const resultConfig: Record<BattleResult, { label: string; dotClass: string; badgeClass: string }> = {
  victory: {
    label: '胜利',
    dotClass: 'bg-red-700',
    badgeClass: 'bg-red-50 text-red-800 border-red-300',
  },
  stalemate: {
    label: '平局',
    dotClass: 'bg-amber-600',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  defeat: {
    label: '败北',
    dotClass: 'bg-slate-600',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-300',
  },
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

function battleDuration(start: string, end: string): number {
  return (
    Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1
  );
}

export default function TimelineView({
  battles,
  selectedBattleId,
  onBattleSelect,
}: TimelineViewProps) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 外部选中 → 自动滚动
  useEffect(() => {
    if (!selectedBattleId) return;
    const el = itemRefs.current.get(selectedBattleId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedBattleId]);

  const sorted = [...battles].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const isSelected = (id: string) => id === selectedBattleId;

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* ======== 桌面端：居中脊柱 ======== */}
      <div
        className="absolute top-0 bottom-0 left-1/2 hidden w-0.5 -translate-x-1/2 bg-gradient-to-b from-red-800 via-red-700 to-amber-700 sm:block"
      />

      {/* ======== 移动端：左侧脊柱 ======== */}
      <div
        className="absolute top-0 bottom-0 left-5 w-0.5 bg-gradient-to-b from-red-800 via-red-700 to-amber-700 sm:hidden"
      />

      <ol className="relative space-y-10 sm:space-y-14">
        {sorted.map((battle, index) => {
          const selected = isSelected(battle.id);
          const config = resultConfig[battle.result];
          const isEven = index % 2 === 0;

          return (
            <li key={battle.id} className="relative">
              {/* ---- 时间线节点 ---- */}
              {/* 桌面：居中 */}
              <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2 hidden sm:block">
                <TimelineDot selected={selected} dotClass={config.dotClass} />
              </div>
              {/* 移动：左对齐 */}
              <div className="absolute left-[14px] top-5 z-10 sm:hidden">
                <TimelineDot selected={selected} dotClass={config.dotClass} size="sm" />
              </div>

              {/* ---- 卡片 ---- */}
              <div
                ref={(el) => {
                  if (el) itemRefs.current.set(battle.id, el);
                  else itemRefs.current.delete(battle.id);
                }}
                onClick={() => onBattleSelect(selected ? '' : battle.id)}
                className={
                  /* 桌面：交替左右 / 移动：全宽 */
                  `relative cursor-pointer transition-all duration-300 sm:w-[calc(50%-1.75rem)] ${
                    isEven
                      ? 'sm:mr-auto sm:pr-2'
                      : 'sm:ml-auto sm:pl-2'
                  } ml-10 sm:ml-0`
                }
              >
                {/* 桌面连接线 */}
                <div
                  className={`absolute top-5 hidden w-4 border-t-2 border-dashed sm:block ${
                    isEven ? '-right-2' : '-left-2'
                  }`}
                  style={{ borderColor: 'var(--color-khaki-light)' }}
                />

                {/* 卡片本体 */}
                <BattleCard battle={battle} selected={selected} config={config} />
              </div>
            </li>
          );
        })}
      </ol>

      {/* 底部年份标注 */}
      <div className="mt-12 flex items-center gap-3 sm:mt-16">
        <div
          className="h-px flex-1"
          style={{
            background:
              'linear-gradient(to right, transparent, var(--color-khaki-light), transparent)',
          }}
        />
        <span
          className="shrink-0 text-[10px] tracking-[0.3em] sm:text-xs"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-khaki)',
          }}
        >
          1950 — 1953
        </span>
        <div
          className="h-px flex-1"
          style={{
            background:
              'linear-gradient(to right, transparent, var(--color-khaki-light), transparent)',
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   子组件：时间线圆点
   ============================================================ */
function TimelineDot({
  selected,
  dotClass,
  size = 'md',
}: {
  selected: boolean;
  dotClass: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6 sm:h-7 sm:w-7';
  const border = size === 'sm' ? 'border-[3px]' : 'border-[3px] sm:border-4';
  const ring = selected ? 'scale-125 ring-2 ring-red-500/40 sm:ring-4 sm:ring-red-500/50' : '';

  return (
    <div
      className={`flex items-center justify-center rounded-full shadow-md transition-all duration-300 ${dim} ${border} ${ring} ${dotClass}`}
      style={{ borderColor: 'var(--bg-app)' }}
    >
      {selected && (
        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse sm:h-2 sm:w-2" />
      )}
    </div>
  );
}

/* ============================================================
   子组件：战役卡片
   ============================================================ */
function BattleCard({
  battle,
  selected,
  config,
}: {
  battle: BattleCampaign;
  selected: boolean;
  config: (typeof resultConfig)[BattleResult];
}) {
  return (
    <div
      className={`group rounded-xl border bg-gradient-to-b p-4 shadow-sm transition-all duration-300 hover:shadow-lg sm:p-5 ${
        selected
          ? 'border-red-400/50 from-red-50/70 to-amber-50/60 shadow-red-200/30 scale-[1.01] sm:scale-[1.02]'
          : 'border-[#d9cfb8] from-[#faf6ee] to-[#f5f0e8] hover:border-[#c4a97d]'
      }`}
      style={selected ? { boxShadow: '0 0 0 1px rgba(139, 26, 26, 0.15), 0 8px 24px rgba(139, 26, 26, 0.1)' } : undefined}
    >
      {/* 日期 */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] tracking-wider sm:mb-2 sm:text-xs">
        <span className="font-mono" style={{ color: 'var(--color-crimson)' }}>
          {formatDate(battle.startDate)}
        </span>
        <span className="text-[#c4a97d]">→</span>
        <span className="font-mono" style={{ color: 'var(--color-crimson)' }}>
          {formatDate(battle.endDate)}
        </span>
        <span
          className="ml-auto rounded-full border px-2 py-0.5 text-[10px]"
          style={{
            background: '#f5f0e8',
            borderColor: '#d9cfb8',
            color: 'var(--color-khaki)',
          }}
        >
          {battleDuration(battle.startDate, battle.endDate)} 天
        </span>
      </div>

      {/* 标题 + 结果 */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2 sm:mb-2">
        <h3
          className="text-base font-bold tracking-wide sm:text-lg"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-ink)',
          }}
        >
          {battle.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${config.badgeClass}`}
        >
          {config.label}
        </span>
      </div>

      {/* 英文名 */}
      <p className="mb-1.5 text-[11px] font-light tracking-wider text-[#8b7355] uppercase sm:text-xs">
        {battle.nameEn}
      </p>

      {/* 地点 */}
      <p
        className="mb-2 flex items-center gap-1 text-[11px] sm:mb-3 sm:text-xs"
        style={{ color: 'var(--color-ink-light)' }}
      >
        <span>📍</span>
        <span>{battle.location}</span>
      </p>

      {/* 战果 */}
      <p
        className="text-[13px] leading-relaxed sm:text-sm"
        style={{ color: 'var(--color-ink-light)' }}
      >
        {battle.resultSummary}
      </p>

      {/* ---- 展开内容 ---- */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          selected ? 'mt-4 max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
          <span className="shrink-0 text-[10px] font-medium tracking-[0.2em] text-red-500/60 uppercase sm:text-xs">
            战 役 日 记
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </div>

        <div
          className="space-y-3 text-[13px] leading-relaxed sm:text-sm"
          style={{ color: 'var(--color-ink)' }}
        >
          {battle.diaryEntry.split('\n\n').map((para, i) => (
            <p
              key={i}
              className="indent-5 first:indent-0 first:font-semibold"
              style={{ color: i === 0 ? 'var(--color-crimson)' : undefined }}
            >
              {para}
            </p>
          ))}
        </div>

        {/* 历史意义 */}
        <div
          className="mt-4 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3"
          style={{
            background: 'rgba(201, 168, 76, 0.06)',
            borderColor: 'rgba(201, 168, 76, 0.2)',
          }}
        >
          <p
            className="text-[10px] font-medium tracking-wide uppercase sm:text-xs"
            style={{ color: 'var(--color-gold)' }}
          >
            📖 历史意义
          </p>
          <p
            className="mt-1 text-[12px] leading-relaxed sm:text-sm"
            style={{ color: 'var(--color-ink-light)' }}
          >
            {battle.significance}
          </p>
        </div>

        {/* 参战部队 */}
        <div className="mt-3">
          <p
            className="text-[10px] font-medium tracking-wide uppercase sm:text-xs"
            style={{ color: 'var(--color-khaki)' }}
          >
            ⚔️ 参战部队
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1 sm:gap-1.5">
            {battle.participatingUnits.map((unit) => (
              <span
                key={unit}
                className="rounded border px-2 py-0.5 text-[10px] sm:text-xs"
                style={{
                  background: 'var(--bg-app)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--color-khaki)',
                }}
              >
                {unit}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 展开/收起提示 */}
      <div className="mt-3 text-center">
        <span
          className="text-[10px] tracking-wider transition-colors sm:text-xs"
          style={{
            color: selected ? 'var(--color-crimson)' : 'var(--color-khaki-light)',
          }}
        >
          {selected ? '▲ 收起' : '▼ 展开日记'}
        </span>
      </div>
    </div>
  );
}
