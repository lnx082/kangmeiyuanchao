import { useState, useCallback, useMemo } from 'react';
import type { ViewMode, BattleCampaign } from './types';
import { mockBattles } from './data';
import { useAnniversary } from './hooks/useAnniversary';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineView from './components/TimelineView';
import BattleInfoPanel from './components/BattleInfoPanel';
import BattleEditor from './components/BattleEditor';
import AnniversaryBanner from './components/AnniversaryBanner';
import CampaignCalendar from './components/CampaignCalendar';

// ============================================================
// localStorage 读写（含版本自动迁移）
// ============================================================
const STORAGE_KEY = 'kmyc-battles';
const VERSION_KEY = 'kmyc-data-version';

/** bump 此版本号即可触发所有用户自动合并最新 mock 数据 */
const DATA_VERSION = 2;

function loadBattles(): BattleCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const storedVersion = Number(localStorage.getItem(VERSION_KEY)) || 0;

    if (raw && storedVersion === DATA_VERSION) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // 版本不匹配 → 智能合并：保留用户自定义 + 更新 mock 数据
    if (raw && storedVersion < DATA_VERSION) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mockIds = new Set(mockBattles.map((b) => b.id));
        // 保留用户自建的战役（ID 不在 mock 中）
        const userBattles = parsed.filter((b: BattleCampaign) => !mockIds.has(b.id));
        // mock 条目以最新代码为准，用户条目追加在后面
        const merged = [...mockBattles, ...userBattles];
        saveBattles(merged, DATA_VERSION);
        return merged;
      }
    }
  } catch { /* ignore */ }

  // 首次使用 / 数据损坏 → 写入最新数据
  saveBattles(mockBattles, DATA_VERSION);
  return mockBattles;
}

function saveBattles(battles: BattleCampaign[], version = DATA_VERSION) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(battles));
    localStorage.setItem(VERSION_KEY, String(version));
  } catch { /* quota exceeded etc. */ }
}

// ============================================================
// App
// ============================================================
function App() {
  const [battles, setBattles] = useState<BattleCampaign[]>(loadBattles);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  // 编辑器状态
  const [editingBattle, setEditingBattle] = useState<BattleCampaign | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // 已有战役摘要（用于编辑器去重校验）
  const existingBattles = useMemo(
    () => battles.map((b) => ({ id: b.id, name: b.name, startDate: b.startDate })),
    [battles],
  );

  // ---- 选中逻辑 ----
  const handleBattleSelect = useCallback((id: string) => {
    setSelectedBattleId(id || null);
  }, []);

  const selectedBattle = selectedBattleId
    ? battles.find((b) => b.id === selectedBattleId) ?? null
    : null;

  // ---- 纪念日检测 + 通知 ----
  const {
    today,
    todayAnniversaries,
    notifyEnabled,
    browserPerm,
    isDebugMode,
    toggleNotify,
  } = useAnniversary(battles);

  // 今日纪念日涉及的所有战役 ID（用于时间线高亮）
  const anniversaryIds = useMemo(
    () => new Set(todayAnniversaries.map((a) => a.battle.id)),
    [todayAnniversaries],
  );

  // 横幅点击 → 切换到日历模式并选中对应战役
  const handleAnniversaryClick = useCallback((id: string) => {
    setSelectedBattleId(id);
    setViewMode('calendar');
  }, []);

  // ---- CRUD ----
  const persist = useCallback((updated: BattleCampaign[]) => {
    setBattles(updated);
    saveBattles(updated);
  }, []);

  const handleAddBattle = useCallback(() => {
    setEditingBattle(null);
    setShowEditor(true);
  }, []);

  const handleEditBattle = useCallback((id: string) => {
    const battle = battles.find((b) => b.id === id);
    if (battle) {
      setEditingBattle(battle);
      setShowEditor(true);
    }
  }, [battles]);

  const handleDeleteBattle = useCallback((id: string) => {
    if (!window.confirm('确定要删除这场战役的记录吗？此操作不可恢复。')) return;
    const updated = battles.filter((b) => b.id !== id);
    persist(updated);
    if (selectedBattleId === id) setSelectedBattleId(null);
  }, [battles, persist, selectedBattleId]);

  const handleSaveBattle = useCallback((battle: BattleCampaign) => {
    const existingIdx = battles.findIndex((b) => b.id === battle.id);

    // BugFix 1+4: 二次校验——编辑模式下 ID 不变，新增模式下确保 ID 不重复
    if (existingIdx < 0) {
      // 新增：最终确认 ID 不会覆盖已有记录
      if (battles.some((b) => b.id === battle.id)) {
        console.error('Duplicate ID detected, aborting save:', battle.id);
        return;
      }
      // BugFix 4: 同名+同日期最终检查
      const dup = battles.find(
        (b) => b.name === battle.name && b.startDate === battle.startDate,
      );
      if (dup) {
        console.error('Duplicate name+date detected, aborting save:', battle.name);
        return;
      }
    }

    const updated: BattleCampaign[] =
      existingIdx >= 0
        ? battles.map((b, i) => (i === existingIdx ? battle : b))
        : [...battles, battle];

    console.log('[保存]', existingIdx >= 0 ? '编辑' : '新增', battle.id, '总数:', updated.length);
    persist(updated);
    setShowEditor(false);
    setEditingBattle(null);
    setSelectedBattleId(battle.id);
  }, [battles, persist]);

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* 顶部导航栏 */}
      <Navbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddBattle={handleAddBattle}
      />

      {/* 纪念日横幅（Layer 1） */}
      <AnniversaryBanner
        anniversaries={todayAnniversaries}
        notifyEnabled={notifyEnabled}
        browserPerm={browserPerm}
        isDebugMode={isDebugMode}
        onToggleNotify={toggleNotify}
        onSelectBattle={handleAnniversaryClick}
      />

      {/* 主内容 */}
      {viewMode === 'calendar' ? (
        <main
          key="calendar"
          className="mode-transition flex-1 overflow-y-auto"
          style={{ background: 'var(--bg-app)' }}
        >
          <CampaignCalendar
            battles={battles}
            today={today}
            onSelectBattle={handleAnniversaryClick}
          />
          <TimelineView
            battles={battles}
            selectedBattleId={selectedBattleId}
            onBattleSelect={handleBattleSelect}
            onEditBattle={handleEditBattle}
            onDeleteBattle={handleDeleteBattle}
            onAddBattle={handleAddBattle}
            anniversaryIds={anniversaryIds}
          />
        </main>
      ) : (
        <main key="map" className="mode-transition relative flex flex-1 overflow-hidden">
          <MapView
            battles={battles}
            selectedBattleId={selectedBattleId}
            onBattleSelect={handleBattleSelect}
          />
          <BattleInfoPanel
            battle={selectedBattle}
            onClose={() => setSelectedBattleId(null)}
            onEdit={handleEditBattle}
            onDelete={handleDeleteBattle}
          />
        </main>
      )}

      {/* 战役编辑器模态框 */}
      {showEditor && (
        <BattleEditor
          battle={editingBattle}
          onSave={handleSaveBattle}
          onCancel={() => {
            setShowEditor(false);
            setEditingBattle(null);
          }}
          existingBattles={existingBattles}
        />
      )}
    </div>
  );
}

export default App;
