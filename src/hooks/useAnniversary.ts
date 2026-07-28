import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BattleCampaign } from '../types';

// ============================================================
// 类型
// ============================================================
export interface AnniversaryMatch {
  battle: BattleCampaign;
  /** 纪念日类型 */
  kind: 'start' | 'end';
  /** 原始日期 */
  date: string;
  /** 距今年数 */
  yearsAgo: number;
}

// ============================================================
// localStorage 键
// ============================================================
const NOTIFY_PERMISSION_KEY = 'kmyc-notify-enabled';
const LAST_NOTIFY_DATE_KEY = 'kmyc-last-notify-date';

// ============================================================
// Hook
// ============================================================
export function useAnniversary(battles: BattleCampaign[]) {
  // 通知开关
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    try {
      return localStorage.getItem(NOTIFY_PERMISSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // 浏览器通知权限状态
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>('default');

  // ---- 今日月日 ----
  // 支持调试模式：在控制台执行
  //   localStorage.setItem('kmyc-debug-date', '10-25');
  //   然后刷新页面即可模拟 10 月 25 日
  //   清除：localStorage.removeItem('kmyc-debug-date'); 刷新
  const today = useMemo(() => {
    let debugDate: string | null = null;
    try {
      debugDate = localStorage.getItem('kmyc-debug-date');
    } catch { /* ignore */ }
    if (debugDate && /^\d{1,2}-\d{1,2}$/.test(debugDate)) {
      const [m, d] = debugDate.split('-').map(Number);
      return { month: m, day: d, year: new Date().getFullYear() };
    }
    const d = new Date();
    return { month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() };
  }, []);

  // ---- 匹配今日纪念日 ----
  const todayAnniversaries = useMemo<AnniversaryMatch[]>(() => {
    const results: AnniversaryMatch[] = [];
    for (const battle of battles) {
      for (const kind of ['start', 'end'] as const) {
        const dateStr = kind === 'start' ? battle.startDate : battle.endDate;
        const [y, m, d] = dateStr.split('-').map(Number);
        if (m === today.month && d === today.day) {
          results.push({
            battle,
            kind,
            date: dateStr,
            yearsAgo: today.year - y,
          });
        }
      }
    }
    console.log(
      `[纪念日] today=${today.month}-${today.day} | matched=${results.length} | battles=${battles.length}`,
    );
    return results;
  }, [battles, today]);

  // ---- 通知权限同步 ----
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPerm(Notification.permission);
    }
  }, []);

  // ---- 请求通知权限 ----
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
    const enabled = perm === 'granted';
    setNotifyEnabled(enabled);
    localStorage.setItem(NOTIFY_PERMISSION_KEY, String(enabled));
    return enabled;
  }, []);

  // ---- 开关通知 ----
  const toggleNotify = useCallback(async () => {
    if (notifyEnabled) {
      // 关闭
      setNotifyEnabled(false);
      localStorage.setItem(NOTIFY_PERMISSION_KEY, 'false');
    } else {
      // 开启 → 先请求权限
      await requestPermission();
    }
  }, [notifyEnabled, requestPermission]);

  // 调试模式标记
  const isDebugMode = (() => {
    try { return !!localStorage.getItem('kmyc-debug-date'); } catch { return false; }
  })();

  // ---- 调试模式：自动请求通知权限 ----
  useEffect(() => {
    if (isDebugMode && browserPerm === 'default' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        setBrowserPerm(perm);
        if (perm === 'granted') {
          setNotifyEnabled(true);
          localStorage.setItem(NOTIFY_PERMISSION_KEY, 'true');
        }
      });
    }
  }, [isDebugMode, browserPerm]);

  // ---- 页面加载后自动发通知 ----
  useEffect(() => {
    // 调试模式强制尝试发送（跳过 notifyEnabled 检查）
    const effectiveEnabled = isDebugMode ? browserPerm === 'granted' : notifyEnabled;
    if (!effectiveEnabled || todayAnniversaries.length === 0) return;

    const timer = setTimeout(() => {
      // 防重复
      const todayKey = `${today.year}-${today.month}-${today.day}`;
      try {
        if (localStorage.getItem(LAST_NOTIFY_DATE_KEY) === todayKey) return;
      } catch { /* ignore */ }
      localStorage.setItem(LAST_NOTIFY_DATE_KEY, todayKey);

      todayAnniversaries.forEach((ann, i) => {
        setTimeout(() => {
          new Notification(
            ann.kind === 'start'
              ? `🗓️ ${ann.battle.name}开战纪念日`
              : `🏁 ${ann.battle.name}胜利纪念日`,
            {
              body: ann.kind === 'start'
                ? `${ann.date}，${ann.battle.name}打响。距今${ann.yearsAgo}年。`
                : `${ann.date}，${ann.battle.name}胜利结束。距今${ann.yearsAgo}年。`,
              icon: '/favicon.svg',
              tag: `kmyc-${ann.battle.id}-${ann.kind}`,
              requireInteraction: i === 0,
            },
          );
        }, i * 800);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [isDebugMode, notifyEnabled, browserPerm, todayAnniversaries, today]);

  return {
    today,
    todayAnniversaries,
    hasAnniversary: todayAnniversaries.length > 0,
    isDebugMode,
    notifyEnabled,
    browserPerm,
    toggleNotify,
    requestPermission,
  };
}
