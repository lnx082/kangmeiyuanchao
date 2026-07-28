import type { BattleCampaign } from '../types';

// ============================================================
const API_BASE = 'https://kmyc-api.24wddp.workers.dev';
const STORAGE_KEY = 'kmyc-battles';
const VERSION_KEY = 'kmyc-data-version';
const TIMESTAMP_KEY = 'kmyc-updated-at';

// ============================================================
// 本地读写
// ============================================================
export function loadLocal(): { battles: BattleCampaign[]; updatedAt: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ts = Number(localStorage.getItem(TIMESTAMP_KEY)) || 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { battles: parsed, updatedAt: ts };
      }
    }
  } catch { /* ignore */ }
  return { battles: [], updatedAt: 0 };
}

export function saveLocal(battles: BattleCampaign[], version = 1) {
  const now = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(battles));
    localStorage.setItem(VERSION_KEY, String(version));
    localStorage.setItem(TIMESTAMP_KEY, String(now));
  } catch { /* ignore */ }
}

// ============================================================
// 远程 API
// ============================================================
export async function fetchRemote(): Promise<{
  battles: BattleCampaign[];
  updatedAt: number;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/battles`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.battles)) {
      return { battles: data.battles, updatedAt: data.updatedAt || 0 };
    }
  } catch { /* offline */ }
  return null;
}

export async function pushRemote(
  battles: BattleCampaign[],
  updatedAt: number,
): Promise<{ ok: boolean; conflict: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/battles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battles, updatedAt }),
    });
    await res.json(); // consume body
    if (res.status === 409) {
      return { ok: false, conflict: true };
    }
    return { ok: res.ok, conflict: false };
  } catch {
    return { ok: false, conflict: false };
  }
}

// ============================================================
// 同步逻辑：时间戳严格比对
// ============================================================
export async function syncBattles(
  localBattles: BattleCampaign[],
  localTs: number,
): Promise<BattleCampaign[]> {
  const remote = await fetchRemote();
  if (!remote || remote.battles.length === 0) {
    // 远程为空 → 推送本地上去
    await pushRemote(localBattles, localTs);
    return localBattles;
  }

  if (remote.updatedAt === localTs) {
    // 时间戳完全一致 → 已同步，无需操作
    return localBattles;
  }

  if (remote.updatedAt > localTs) {
    // 远程更新 → 拉取远程覆盖本地
    saveLocal(remote.battles);
    return remote.battles;
  }

  // 本地更新 → 推送本地覆盖远程
  await pushRemote(localBattles, localTs);
  return localBattles;
}

// ============================================================
// 保存：写本地 + 推远程
// ============================================================
export function saveBattleBoth(battles: BattleCampaign[], version?: number) {
  saveLocal(battles, version);
  const { updatedAt } = loadLocal();
  // 异步推，不阻塞 UI
  pushRemote(battles, updatedAt);
}
