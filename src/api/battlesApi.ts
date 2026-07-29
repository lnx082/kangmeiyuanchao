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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // 5秒超时
    const res = await fetch(`${API_BASE}/api/battles`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.battles)) {
      return { battles: data.battles, updatedAt: data.updatedAt || 0 };
    }
  } catch { /* offline / timeout */ }
  return null;
}

export async function pushRemote(
  battles: BattleCampaign[],
  updatedAt: number,
): Promise<{ ok: boolean; conflict: boolean }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API_BASE}/api/battles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battles, updatedAt }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    await res.json();
    if (res.status === 409) {
      return { ok: false, conflict: true };
    }
    return { ok: res.ok, conflict: false };
  } catch {
    return { ok: false, conflict: false };
  }
}

// ============================================================
// 同步逻辑：远程优先，条数+时间戳双重比对
// ============================================================
export async function syncBattles(
  localBattles: BattleCampaign[],
  localTs: number,
): Promise<BattleCampaign[]> {
  const remote = await fetchRemote();

  // 远程不可达 → 保持本地
  if (!remote) return localBattles;

  // 远程为空、本地有数据 → 推上去
  if (remote.battles.length === 0 && localBattles.length > 0) {
    await pushRemote(localBattles, localTs);
    return localBattles;
  }

  // 远程有数据 → 以远程为准（服务端是单一数据源）
  saveLocal(remote.battles);
  return remote.battles;
}

// ============================================================
// 保存：写本地 + 立即推远程
// ============================================================
export async function saveBattleBoth(battles: BattleCampaign[], version?: number) {
  saveLocal(battles, version);
  const { updatedAt } = loadLocal();
  // 等待推送确认
  const result = await pushRemote(battles, updatedAt);
  return result; // { ok, conflict }
}
