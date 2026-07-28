import type { BattleCampaign } from '../types';

interface Props {
  battles: BattleCampaign[];
  today: { month: number; day: number; year: number };
  onSelectBattle: (id: string) => void;
}

/** 每月天数 */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 构建「月-日」→ 战役列表 的映射 */
function buildDateMap(battles: BattleCampaign[]) {
  const map = new Map<string, { battle: BattleCampaign; kind: 'start' | 'end' }[]>();
  for (const battle of battles) {
    for (const kind of ['start', 'end'] as const) {
      const dateStr = kind === 'start' ? battle.startDate : battle.endDate;
      const [, m, d] = dateStr.split('-').map(Number);
      const key = `${m}-${d}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ battle, kind });
    }
  }
  return map;
}

export default function CampaignCalendar({
  battles,
  today,
  onSelectBattle,
}: Props) {
  const dateMap = buildDateMap(battles);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* 标题 */}
      <h2
        className="mb-5 text-center text-base font-bold tracking-wide sm:text-lg"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-crimson)' }}
      >
        📅 战役纪念日历
        <span
          className="ml-2 text-xs font-normal"
          style={{ color: 'var(--color-khaki)' }}
        >
          {today.year} 年
        </span>
      </h2>

      {/* 12 个月网格 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {MONTH_NAMES.map((name, monthIdx) => {
          const month = monthIdx + 1;
          const isCurrentMonth = month === today.month;
          const totalDays = DAYS_IN_MONTH[monthIdx];

          return (
            <div
              key={month}
              className={`rounded-lg border p-2 sm:p-3 transition-colors ${
                isCurrentMonth ? 'border-red-400/40 bg-red-50/40' : 'border-[#d9cfb8]'
              }`}
              style={isCurrentMonth ? {} : { background: 'var(--bg-card)' }}
            >
              {/* 月名 */}
              <p
                className="mb-1.5 text-center text-[11px] font-bold tracking-wide sm:text-xs"
                style={{
                  color: isCurrentMonth ? 'var(--color-crimson)' : 'var(--color-khaki)',
                }}
              >
                {isCurrentMonth ? '▶ ' : ''}{name}{isCurrentMonth ? ' ◀' : ''}
              </p>

              {/* 星期头 */}
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((wd) => (
                  <span
                    key={wd}
                    className="text-center text-[9px] font-medium"
                    style={{ color: 'var(--color-khaki-light)' }}
                  >
                    {wd}
                  </span>
                ))}
              </div>

              {/* 日期格 */}
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const key = `${month}-${day}`;
                  const entries = dateMap.get(key);

                  // 标记：今日 / 纪念日 / 普通
                  const isToday = isCurrentMonth && day === today.day;
                  const isAnniversary = entries && entries.length > 0;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!isAnniversary}
                      onClick={() => {
                        if (entries) onSelectBattle(entries[0].battle.id);
                      }}
                      className={`relative flex aspect-square items-center justify-center rounded text-[10px] transition-all sm:text-xs ${
                        isToday
                          ? 'font-extrabold text-white shadow-md'
                          : isAnniversary
                            ? 'cursor-pointer font-bold hover:scale-110'
                            : 'text-slate-400'
                      }`}
                      style={
                        isToday
                          ? { background: 'var(--color-crimson)' }
                          : isAnniversary
                            ? { color: 'var(--color-crimson)' }
                            : {}
                      }
                      title={
                        entries
                          ? entries.map((e) => `${e.kind === 'start' ? '开战' : '胜利'}：${e.battle.name}`).join(' / ')
                          : undefined
                      }
                    >
                      {isAnniversary && (
                        <span className="absolute -top-0.5 right-0 text-[7px]">⭐</span>
                      )}
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-4 flex justify-center gap-4 text-[10px] sm:text-xs">
        <span className="flex items-center gap-1" style={{ color: 'var(--color-khaki)' }}>
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-crimson)' }} />
          今日
        </span>
        <span className="flex items-center gap-1" style={{ color: 'var(--color-khaki)' }}>
          <span style={{ color: 'var(--color-crimson)' }}>⭐ 25</span>
          纪念日
        </span>
      </div>
    </div>
  );
}
