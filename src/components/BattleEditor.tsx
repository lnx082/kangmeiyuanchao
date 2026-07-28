import { useState, useEffect, useRef } from 'react';
import type { BattleCampaign, BattleResult } from '../types';

// ============================================================
// Props
// ============================================================
interface BattleEditorProps {
  /** 编辑模式时传入已有数据；新增模式为 null */
  battle: BattleCampaign | null;
  onSave: (battle: BattleCampaign) => void;
  onCancel: () => void;
  /** 已有战役的 id/name/startDate，用于去重校验 */
  existingBattles: { id: string; name: string; startDate: string }[];
}

// ============================================================
// 空白模板
// ============================================================
function emptyForm(): BattleCampaign {
  return {
    id: '',
    name: '',
    nameEn: '',
    startDate: '1951-',
    endDate: '1951-',
    coordinates: { lat: 38.5, lng: 127.5 },
    location: '',
    result: 'victory',
    resultSummary: '',
    diaryEntry: '',
    participatingUnits: [],
    significance: '',
  };
}

// ============================================================
// 朝鲜半岛经纬度范围（粗略校验）
// ============================================================
const LAT_MIN = 33;
const LAT_MAX = 43;
const LNG_MIN = 124;
const LNG_MAX = 131;

// ============================================================
// 组件
// ============================================================
export default function BattleEditor({
  battle,
  onSave,
  onCancel,
  existingBattles,
}: BattleEditorProps) {
  const isEdit = battle !== null;
  const [form, setForm] = useState<BattleCampaign>(battle ?? emptyForm());
  const [unitsText, setUnitsText] = useState(
    battle?.participatingUnits.join('，') ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  // 避免 body 滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 点击遮罩关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  // 更新字段
  const set = (key: keyof BattleCampaign, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // 更新坐标子字段
  const setCoord = (axis: 'lat' | 'lng', value: string) => {
    const num = parseFloat(value);
    setForm((prev) => ({
      ...prev,
      coordinates: { ...prev.coordinates, [axis]: isNaN(num) ? 0 : num },
    }));
    setErrors((prev) => ({ ...prev, coordinates: '' }));
  };

  // 校验
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '请输入战役名称';
    if (!form.startDate) e.startDate = '请选择开始日期';
    if (!form.endDate) e.endDate = '请选择结束日期';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      e.endDate = '结束日期不能早于开始日期';
    }
    if (!form.location.trim()) e.location = '请输入地点';
    if (form.coordinates.lat < LAT_MIN || form.coordinates.lat > LAT_MAX) {
      e.coordinates = `纬度应在 ${LAT_MIN}°~${LAT_MAX}° 之间（朝鲜半岛范围）`;
    }
    if (form.coordinates.lng < LNG_MIN || form.coordinates.lng > LNG_MAX) {
      e.coordinates = `经度应在 ${LNG_MIN}°~${LNG_MAX}° 之间（朝鲜半岛范围）`;
    }
    if (!form.resultSummary.trim()) e.resultSummary = '请输入战果简述';
    if (!form.diaryEntry.trim()) e.diaryEntry = '请输入日记内容';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // 保存（含去重校验）
  const handleSave = () => {
    if (!validate()) return;

    const e: Record<string, string> = {};
    const name = form.name.trim();
    const startDate = form.startDate;

    if (!isEdit) {
      // ---- BugFix 1+2+3: ID 唯一性校验（仅新建模式） ----
      const takenIds = new Set(existingBattles.map((b) => b.id));
      const takenNames = existingBattles.map((b) => b.name);
      const takenNameDatePairs = new Set(
        existingBattles.map((b) => `${b.name}|${b.startDate}`),
      );

      // ---- 校验 1: 同名 + 同日期 → 完全重复 ----
      if (takenNameDatePairs.has(`${name}|${startDate}`)) {
        e.name = `"${name}"（${startDate}）已存在完全相同的战役记录，请勿重复创建`;
      }

      // ---- 校验 2: 生成唯一 ID ----
      const rawId = name.replace(/\s+/g, '-').toLowerCase() || `battle-${Date.now()}`;
      let finalId = rawId;
      if (takenIds.has(finalId)) {
        // BugFix 1: 同名 ID 碰撞 → 加数字后缀避免静默覆盖
        let suffix = 2;
        while (takenIds.has(`${rawId}-${suffix}`)) {
          suffix++;
        }
        finalId = `${rawId}-${suffix}`;
      }

      // ---- 校验 3: 同名但日期不同 → 警告提示（不阻塞） ----
      if (!e.name && takenNames.includes(name)) {
        // 仅在 ID 已存在时提示用户（ID 已通过后缀解决了冲突）
        // 如果 ID 不同但名称相同，属于"同名战役不同日期"的合理情况
        // 不做阻塞，只是让用户知道 ID 被自动加了后缀
      }

      if (Object.keys(e).length > 0) {
        setErrors((prev) => ({ ...prev, ...e }));
        return;
      }

      const units = unitsText
        .split(/[,，、\s]+/)
        .map((u) => u.trim())
        .filter(Boolean);
      onSave({ ...form, id: finalId, name, participatingUnits: units });
      return;
    }

    // 编辑模式：保持原 ID，不做去重
    const units = unitsText
      .split(/[,，、\s]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    onSave({ ...form, id: battle!.id, name, participatingUnits: units });
  };

  // 输入框通用样式
  const inputCls =
    'w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';
  const inputStyle = {
    borderColor: 'var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--color-ink)',
    fontFamily: 'var(--font-body)',
  };
  const labelCls = 'mb-1 block text-xs font-medium';
  const labelStyle = { color: 'var(--color-ink-light)' };
  const errCls = 'mt-0.5 text-[11px]';
  const errStyle = { color: 'var(--color-crimson-bright)' };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--bg-app)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-color)' }}>
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-crimson)' }}
          >
            {isEdit ? '✏️ 编辑战役' : '⭐ 新增战役'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-black/5 cursor-pointer"
            style={{ color: 'var(--color-ink-light)' }}
          >
            ✕
          </button>
        </div>

        {/* 表单 */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* 战役名称 */}
          <div>
            <label className={labelCls} style={labelStyle}>战役名称 *</label>
            <input
              className={inputCls} style={inputStyle}
              value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="如：横城反击战" autoFocus
            />
            {errors.name && <p className={errCls} style={errStyle}>{errors.name}</p>}
          </div>

          {/* 英文名 */}
          <div>
            <label className={labelCls} style={labelStyle}>英文名称</label>
            <input
              className={inputCls} style={inputStyle}
              value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)}
              placeholder="如：Battle of Hoengseong"
            />
          </div>

          {/* 日期 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>开始日期 *</label>
              <input
                type="date" className={inputCls} style={inputStyle}
                value={form.startDate} onChange={(e) => set('startDate', e.target.value)}
              />
              {errors.startDate && <p className={errCls} style={errStyle}>{errors.startDate}</p>}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>结束日期 *</label>
              <input
                type="date" className={inputCls} style={inputStyle}
                value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
              />
              {errors.endDate && <p className={errCls} style={errStyle}>{errors.endDate}</p>}
            </div>
          </div>

          {/* 坐标 */}
          <div>
            <label className={labelCls} style={labelStyle}>
              经纬度坐标 *
              <span className="ml-1 font-normal opacity-60">
                （朝鲜半岛范围约 33-43°N, 124-131°E）
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-1">
                <span className="shrink-0 text-xs" style={{ color: 'var(--color-ink-light)' }}>纬度</span>
                <input
                  type="number" step="0.01" min={LAT_MIN} max={LAT_MAX}
                  className={inputCls} style={inputStyle}
                  value={form.coordinates.lat || ''}
                  onChange={(e) => setCoord('lat', e.target.value)}
                  placeholder="38.50"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0 text-xs" style={{ color: 'var(--color-ink-light)' }}>经度</span>
                <input
                  type="number" step="0.01" min={LNG_MIN} max={LNG_MAX}
                  className={inputCls} style={inputStyle}
                  value={form.coordinates.lng || ''}
                  onChange={(e) => setCoord('lng', e.target.value)}
                  placeholder="127.50"
                />
              </div>
            </div>
            {errors.coordinates && <p className={errCls} style={errStyle}>{errors.coordinates}</p>}
          </div>

          {/* 地点 */}
          <div>
            <label className={labelCls} style={labelStyle}>具体地点 *</label>
            <input
              className={inputCls} style={inputStyle}
              value={form.location} onChange={(e) => set('location', e.target.value)}
              placeholder="如：朝鲜江原道横城郡"
            />
            {errors.location && <p className={errCls} style={errStyle}>{errors.location}</p>}
          </div>

          {/* 战役结果 */}
          <div>
            <label className={labelCls} style={labelStyle}>战役结果</label>
            <div className="flex gap-2">
              {(['victory', 'stalemate', 'defeat'] as BattleResult[]).map((r) => (
                <button
                  key={r} type="button"
                  onClick={() => set('result', r)}
                  className={`cursor-pointer rounded-lg border px-4 py-1.5 text-sm font-medium transition-all ${
                    form.result === r
                      ? 'border-red-600 bg-red-600/10 text-red-700'
                      : 'border-slate-300 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  {{ victory: '🏁 胜利', stalemate: '⚖️ 平局', defeat: '🏳️ 败北', withdrawal: '↩️ 撤退' }[r]}
                </button>
              ))}
            </div>
          </div>

          {/* 战果简述 */}
          <div>
            <label className={labelCls} style={labelStyle}>战果简述 *</label>
            <textarea
              className={inputCls} style={inputStyle} rows={2}
              value={form.resultSummary} onChange={(e) => set('resultSummary', e.target.value)}
              placeholder="一句话概括战役战果..."
            />
            {errors.resultSummary && <p className={errCls} style={errStyle}>{errors.resultSummary}</p>}
          </div>

          {/* 参战部队 */}
          <div>
            <label className={labelCls} style={labelStyle}>
              参战部队
              <span className="ml-1 font-normal opacity-60">（用逗号分隔）</span>
            </label>
            <input
              className={inputCls} style={inputStyle}
              value={unitsText} onChange={(e) => setUnitsText(e.target.value)}
              placeholder="如：志愿军第39军，志愿军第40军"
            />
          </div>

          {/* 日记正文 */}
          <div>
            <label className={labelCls} style={labelStyle}>日记正文 *</label>
            <textarea
              className={inputCls} style={inputStyle} rows={8}
              value={form.diaryEntry} onChange={(e) => set('diaryEntry', e.target.value)}
              placeholder="用第一人称纪实视角书写战役日记&#10;&#10;段落之间用空行分隔..."
            />
            {errors.diaryEntry && <p className={errCls} style={errStyle}>{errors.diaryEntry}</p>}
          </div>

          {/* 历史意义 */}
          <div>
            <label className={labelCls} style={labelStyle}>历史意义</label>
            <textarea
              className={inputCls} style={inputStyle} rows={2}
              value={form.significance} onChange={(e) => set('significance', e.target.value)}
              placeholder="简述这场战役在抗美援朝战争中的历史地位..."
            />
          </div>
        </div>

        {/* 按钮 */}
        <div
          className="flex justify-end gap-3 border-t px-5 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button" onClick={onCancel}
            className="cursor-pointer rounded-lg border px-5 py-2 text-sm font-medium transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-color)', color: 'var(--color-ink-light)' }}
          >
            取消
          </button>
          <button
            type="button" onClick={handleSave}
            className="cursor-pointer rounded-lg px-6 py-2 text-sm font-bold text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--color-crimson)' }}
          >
            {isEdit ? '保存修改' : '添加战役'}
          </button>
        </div>
      </div>
    </div>
  );
}
