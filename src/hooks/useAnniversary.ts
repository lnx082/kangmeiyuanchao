import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

  // 当天已通知标记（防重复）
  const notifiedToday = useRef(false);

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

  // ---- Layer2: 浏览器通知 ----
  const sendNotifications = useCallback(() => {
    if (
      !notifyEnabled ||
      browserPerm !== 'granted' ||
      !('Notification' in window) ||
      todayAnniversaries.length === 0 ||
      notifiedToday.current
    ) {
      return;
    }

    // 检查上次通知日期
    const todayKey = `${today.year}-${today.month}-${today.day}`;
    try {
      if (localStorage.getItem(LAST_NOTIFY_DATE_KEY) === todayKey) {
        notifiedToday.current = true;
        return;
      }
    } catch { /* ignore */ }

    notifiedToday.current = true;
    localStorage.setItem(LAST_NOTIFY_DATE_KEY, todayKey);

    // 逐条发送通知
    todayAnniversaries.forEach((ann, i) => {
      // 延迟发送多条，避免浏览器合并
      setTimeout(() => {
        const title =
          ann.kind === 'start'
            ? `🗓️ ${ann.battle.name}开战纪念日`
            : `🏁 ${ann.battle.name}胜利纪念日`;

        const body =
          ann.kind === 'start'
            ? `${ann.date}，${ann.battle.name}打响。距今${ann.yearsAgo}年。${ann.battle.resultSummary.slice(0, 60)}…`
            : `${ann.date}，${ann.battle.name}胜利结束。距今${ann.yearsAgo}年。${ann.battle.resultSummary.slice(0, 60)}…`;

        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `kmyc-${ann.battle.id}-${ann.kind}`,
          requireInteraction: i === 0, // 第一条需要用户手动关闭
        });
      }, i * 800);
    });
  }, [notifyEnabled, browserPerm, todayAnniversaries, today]);

  // ---- 页面加载后自动发通知 ----
  useEffect(() => {
    const timer = setTimeout(sendNotifications, 2000);
    return () => clearTimeout(timer);
  }, [sendNotifications]);

  return {
    /** 今日匹配到的纪念日列表 */
    todayAnniversaries,
    /** 今天是否是某个纪念日 */
    hasAnniversary: todayAnniversaries.length > 0,
    /** 是否处于调试模式 */
    isDebugMode: (() => {
      try { return !!localStorage.getItem('kmyc-debug-date'); } catch { return false; }
    })(),
    /** 通知开关 */
    notifyEnabled,
    /** 浏览器通知权限状态 */
    browserPerm,
    /** 切换通知开关 */
    toggleNotify,
    /** 请求通知权限 */
    requestPermission,
  };
}
