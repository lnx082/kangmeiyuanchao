import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ViewMode, BattleCampaign } from './types';
import { mockBattles } from './data';
import { useAnniversary } from './hooks/useAnniversary';
import * as api from './api/battlesApi';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineView from './components/TimelineView';
import BattleInfoPanel from './components/BattleInfoPanel';
import BattleEditor from './components/BattleEditor';
import AnniversaryBanner from './components/AnniversaryBanner';
import CampaignCalendar from './components/CampaignCalendar';

// ============================================================
// 数据版本 — bump 即可触发所有用户自动合并最新 mock
// ============================================================
const DATA_VERSION = 2;

function mergeWithMock(local: BattleCampaign[]): BattleCampaign[] {
  const mockIds = new Set(mockBattles.map((b) => b.id));
  const userBattles = local.filter((b) => !mockIds.has(b.id));
  return [...mockBattles, ...userBattles];
}

// ============================================================
// App
// ============================================================
function App() {
  const [battles, setBattles] = useState<BattleCampaign[]>(() => {
    const { battles: local } = api.loadLocal();
    const merged = local.length === 0 ? mockBattles : mergeWithMock(local);
    api.saveLocal(merged, DATA_VERSION);
    return merged;
  });
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
  const persist = useCallback(async (updated: BattleCampaign[]) => {
    setBattles(updated);
    const result = await api.saveBattleBoth(updated, DATA_VERSION);
    if (!result.ok) {
      console.warn('推送 KV 失败，将在下次同步时重试');
    }
  }, []);

  // ---- 启动时从远程同步（时间戳比对） ----
  const [syncStatus, setSyncStatus] = useState<'🔄 同步中…' | '☁️ 已同步' | '📡 离线'>('🔄 同步中…');
  useEffect(() => {
    const { updatedAt } = api.loadLocal();
    const timer = setTimeout(() => setSyncStatus('📡 离线'), 8000); // 8秒没完成=离线
    api.syncBattles(battles, updatedAt).then((result) => {
      clearTimeout(timer);
      if (result !== battles) {
        setBattles(result);
      }
      setSyncStatus('☁️ 已同步');
    }).catch(() => {
      clearTimeout(timer);
      setSyncStatus('📡 离线');
    });
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

  const handleDeleteBattle = useCallback(async (id: string) => {
    if (!window.confirm('确定要删除这场战役的记录吗？此操作不可恢复。')) return;
    const updated = battles.filter((b) => b.id !== id);
    await persist(updated);
    if (selectedBattleId === id) setSelectedBattleId(null);
  }, [battles, persist, selectedBattleId]);

  const handleSaveBattle = useCallback(async (battle: BattleCampaign) => {
    const existingIdx = battles.findIndex((b) => b.id === battle.id);

    if (existingIdx < 0) {
      if (battles.some((b) => b.id === battle.id)) {
        console.error('Duplicate ID detected, aborting save:', battle.id);
        return;
      }
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
    await persist(updated);
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
          <div className="mx-auto max-w-2xl px-4 text-center">
            <button
              onClick={async () => {
                setSyncStatus('🔄 同步中…');
                const { updatedAt } = api.loadLocal();
                const result = await api.syncBattles(battles, updatedAt);
                if (result !== battles) setBattles(result);
                setSyncStatus('☁️ 已同步');
              }}
              className="cursor-pointer text-[10px] transition-colors hover:opacity-70"
              style={{ color: 'var(--color-khaki-light)', opacity: syncStatus === '☁️ 已同步' ? 0.5 : 0.8 }}
            >
              v2.3 · {syncStatus} · 点击同步
            </button>
          </div>
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
