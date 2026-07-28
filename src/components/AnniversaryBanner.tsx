import { useState } from 'react';
import type { AnniversaryMatch } from '../hooks/useAnniversary';

interface Props {
  anniversaries: AnniversaryMatch[];
  notifyEnabled: boolean;
  browserPerm: NotificationPermission;
  isDebugMode: boolean;
  onToggleNotify: () => void;
  onSelectBattle: (id: string) => void;
}

export default function AnniversaryBanner({
  anniversaries,
  notifyEnabled,
  browserPerm,
  isDebugMode,
  onToggleNotify,
  onSelectBattle,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // 调试模式标记
  const debugNote = isDebugMode ? (
    <span className="ml-2 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] text-amber-300">
      🧪 调试模式
    </span>
  ) : null;

  // 非纪念日 + 非调试模式 → 不显示
  if (anniversaries.length === 0 && !isDebugMode) return null;
  if (anniversaries.length === 0 && dismissed) return null;

  return (
    <div
      className="relative border-b px-4 py-3 shadow-md sm:py-4"
      style={{
        background: 'linear-gradient(135deg, #8b1a1a 0%, #6b1010 40%, #4a0808 100%)',
        borderColor: '#c9a84c',
      }}
    >
      {/* 装饰金星背景 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]">
        {['★', '★', '★'].map((s, i) => (
          <span
            key={i}
            className="absolute text-6xl"
            style={{
              top: `${20 + i * 30}%`,
              left: `${10 + i * 35}%`,
              color: '#FFD700',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* 左侧：纪念日标题 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">🔔</span>
          <div>
            <p className="text-sm font-bold text-amber-300 sm:text-base">
              {anniversaries.length > 0
                ? '今日抗美援朝胜利纪念日'
                : '调试模式 — 模拟纪念日'}
              {debugNote}
            </p>
            <p className="text-[11px] text-amber-100/70 sm:text-xs">
              {anniversaries.length > 0
                ? anniversaries.map((a) => a.battle.name).join(' · ')
                : '当前日期未匹配到任何战役纪念日'}
            </p>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 通知开关 */}
          {browserPerm !== 'denied' && (
            <button
              type="button"
              onClick={onToggleNotify}
              className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition-all sm:text-xs ${
                notifyEnabled
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                  : 'border-white/20 bg-white/5 text-white/60 hover:border-white/40'
              }`}
            >
              {notifyEnabled ? '🔔 提醒已开' : '🔕 开启提醒'}
            </button>
          )}

          {/* 查看按钮列表 */}
          {anniversaries.map((ann) => (
            <button
              key={ann.battle.id}
              type="button"
              onClick={() => onSelectBattle(ann.battle.id)}
              className="cursor-pointer rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium text-white transition-all hover:bg-white/20 sm:text-xs"
            >
              {ann.kind === 'start' ? '🗓️' : '🏁'} {ann.battle.name}
              <span className="ml-1 opacity-60">{ann.yearsAgo}周年</span>
            </button>
          ))}

          {/* 关闭横幅 */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="cursor-pointer ml-1 flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white sm:h-7 sm:w-7"
            aria-label="关闭横幅"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
