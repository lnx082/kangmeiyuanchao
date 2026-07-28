import { useState, useCallback, useMemo } from 'react';
import type { ViewMode, BattleCampaign } from './types';
import { mockBattles } from './data';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineView from './components/TimelineView';
import BattleInfoPanel from './components/BattleInfoPanel';
import BattleEditor from './components/BattleEditor';

// ============================================================
// localStorage 读写
// ============================================================
const STORAGE_KEY = 'kmyc-battles';

function loadBattles(): BattleCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  // 首次使用 → 存入默认数据
  saveBattles(mockBattles);
  return mockBattles;
}

function saveBattles(battles: BattleCampaign[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(battles));
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

  // 现有 ID 列表（用于新 ID 去重）
  const existingIds = useMemo(() => battles.map((b) => b.id), [battles]);

  // ---- 选中逻辑 ----
  const handleBattleSelect = useCallback((id: string) => {
    setSelectedBattleId(id || null);
  }, []);

  const selectedBattle = selectedBattleId
    ? battles.find((b) => b.id === selectedBattleId) ?? null
    : null;

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
    let updated: BattleCampaign[];
    const idx = battles.findIndex((b) => b.id === battle.id);
    if (idx >= 0) {
      // 编辑
      updated = [...battles];
      updated[idx] = battle;
    } else {
      // 新增
      updated = [...battles, battle];
    }
    persist(updated);
    setShowEditor(false);
    setEditingBattle(null);
    // 自动选中新添加的战役
    setSelectedBattleId(battle.id);
    // 如果在地图模式，切回日历让用户看到新卡片；日历模式则保持
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

      {/* 主内容 */}
      {viewMode === 'calendar' ? (
        <main
          key="calendar"
          className="mode-transition flex-1 overflow-y-auto"
          style={{ background: 'var(--bg-app)' }}
        >
          <TimelineView
            battles={battles}
            selectedBattleId={selectedBattleId}
            onBattleSelect={handleBattleSelect}
            onEditBattle={handleEditBattle}
            onDeleteBattle={handleDeleteBattle}
            onAddBattle={handleAddBattle}
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
          existingIds={existingIds}
        />
      )}
    </div>
  );
}

export default App;
