import { useState, useCallback } from 'react';
import type { ViewMode } from './types';
import { mockBattles } from './data';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineView from './components/TimelineView';
import BattleInfoPanel from './components/BattleInfoPanel';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  const handleBattleSelect = useCallback((id: string) => {
    setSelectedBattleId(id || null);
  }, []);

  const selectedBattle = selectedBattleId
    ? mockBattles.find((b) => b.id === selectedBattleId) ?? null
    : null;

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* 顶部导航栏 */}
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* 主内容 — key 驱动淡入淡出动画 */}
      {viewMode === 'calendar' ? (
        <main
          key="calendar"
          className="mode-transition flex-1 overflow-y-auto"
          style={{ background: 'var(--bg-app)' }}
        >
          <TimelineView
            battles={mockBattles}
            selectedBattleId={selectedBattleId}
            onBattleSelect={handleBattleSelect}
          />
        </main>
      ) : (
        <main key="map" className="mode-transition relative flex flex-1 overflow-hidden">
          <MapView
            battles={mockBattles}
            selectedBattleId={selectedBattleId}
            onBattleSelect={handleBattleSelect}
          />
          <BattleInfoPanel
            battle={selectedBattle}
            onClose={() => setSelectedBattleId(null)}
          />
        </main>
      )}
    </div>
  );
}

export default App;
