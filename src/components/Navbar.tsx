import type { ViewMode } from '../types';

interface NavbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function Navbar({ viewMode, onViewModeChange }: NavbarProps) {
  return (
    <nav
      className="sticky top-0 z-50 border-b px-3 shadow-sm"
      style={{
        background: 'rgba(247, 242, 233, 0.92)',
        borderColor: '#d9cfb8',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between sm:h-16">
        {/* 左侧：品牌 */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* 红星徽章 */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-base font-bold text-white sm:h-9 sm:w-9 sm:text-lg"
            style={{ background: 'var(--accent)' }}
            aria-hidden="true"
          >
            记
          </div>
          {/* 标题 */}
          <h1
            className="text-sm font-bold tracking-wide sm:text-lg"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-ink)',
            }}
          >
            <span className="hidden sm:inline">抗美援朝胜利战役日记</span>
            <span className="sm:hidden">抗美援朝战役日记</span>
          </h1>
        </div>

        {/* 右侧：模式切换 */}
        <div
          className="flex items-center rounded-lg p-0.5 sm:p-1"
          style={{ background: '#ede4d3' }}
        >
          <ToggleButton
            active={viewMode === 'calendar'}
            onClick={() => onViewModeChange('calendar')}
            label="日历"
            icon="📅"
          />
          <ToggleButton
            active={viewMode === 'map'}
            onClick={() => onViewModeChange('map')}
            label="位置"
            icon="🌍"
          />
        </div>
      </div>
    </nav>
  );
}

/** Toggle 按钮子组件 */
function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm"
      style={
        active
          ? {
              background: '#fff',
              color: 'var(--color-crimson)',
              boxShadow: '0 1px 3px rgba(60, 36, 21, 0.15)',
            }
          : {
              background: 'transparent',
              color: 'var(--color-ink-light)',
            }
      }
    >
      <span className="sm:hidden">{icon}</span>
      <span className="hidden sm:inline">
        {icon} {label}模式
      </span>
    </button>
  );
}
