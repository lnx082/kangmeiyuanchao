import type { BattleCampaign } from '../types';

// ============================================================
// API 端点 — 部署 Worker 后替换为实际域名
// 开发阶段不填 → 自动回退到 localStorage only
// ============================================================
const API_BASE = 'https://kmyc-api.24wddp.workers.dev';

// ============================================================
// 本地存储（始终作为离线兜底）
// ============================================================
const STORAGE_KEY = 'kmyc-battles';
const VERSION_KEY = 'kmyc-data-version';
const SYNC_FLAG_KEY = 'kmyc-last-sync';

export function loadLocal(): BattleCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveLocal(battles: BattleCampaign[], version = 1) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(battles));
    localStorage.setItem(VERSION_KEY, String(version));
  } catch { /* ignore */ }
}

// ============================================================
// 远程 API
// ============================================================

/** 从远程拉取全部战役 */
export async function fetchRemote(): Promise<BattleCampaign[] | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/battles`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.battles)) return data.battles;
  } catch { /* network error — offline */ }
  return null;
}

/** 推送全部战役到远程 */
export async function pushRemote(battles: BattleCampaign[]): Promise<boolean> {
  if (!API_BASE) return false;
  try {
    const res = await fetch(`${API_BASE}/api/battles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battles }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// 智能合并：local 条数优先，再按最后同步时间
// 策略：启动时同时拉取远程和本地，取二者中条目多的那一份
// ============================================================
export async function syncBattles(local: BattleCampaign[]): Promise<BattleCampaign[]> {
  const remote = await fetchRemote();
  if (!remote) return local;

  // 远程有新数据（其他设备写入的）→ 用远程
  if (remote.length >= local.length) {
    saveLocal(remote);
    localStorage.setItem(SYNC_FLAG_KEY, String(Date.now()));
    return remote;
  }

  // 本地更多 → 推送到远程
  const ok = await pushRemote(local);
  if (ok) {
    localStorage.setItem(SYNC_FLAG_KEY, String(Date.now()));
  }
  return local;
}

/** 保存：同时写本地 + 异步推远程（不阻塞 UI） */
export function saveBattleBoth(battles: BattleCampaign[], version?: number) {
  saveLocal(battles, version);
  // 后台推送
  pushRemote(battles).then((ok) => {
    if (ok) localStorage.setItem(SYNC_FLAG_KEY, String(Date.now()));
  });
}
