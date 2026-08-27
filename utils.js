// ============================================================
// 读书喵 — 共享工具函数
// 供 popup.js / stats.js 引用
// ============================================================

/**
 * 格式化日期时间戳为 MM-DD HH:MM
 */
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

/**
 * 格式化秒数为 MM:SS
 */
function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 计算阅读统计数据（本周总时长、完成次数、平均、连续天数）
 * @param {Array} history - 历史记录数组
 * @returns {{ totalDisplay: string, completedCount: number, avgMin: number, streak: number }}
 */
function calcStats(history) {
  if (!history || history.length === 0) {
    return { totalDisplay: '0 min', completedCount: 0, avgMin: 0, streak: 0 };
  }

  // 本周起始（周一 00:00）
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  // 本周数据
  const weekItems = history.filter(h => h.startedAt >= weekStartTs);
  const completedThisWeek = weekItems.filter(h => h.elapsedSeconds >= h.targetSeconds);
  const totalMinutes = Math.round(weekItems.reduce((sum, h) => sum + h.elapsedSeconds, 0) / 60);

  // 格式化总时长
  let totalDisplay;
  if (totalMinutes >= 60) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    totalDisplay = mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
  } else {
    totalDisplay = `${totalMinutes} min`;
  }

  // 平均每次
  const avgMin = completedThisWeek.length > 0
    ? Math.round(completedThisWeek.reduce((s, h) => s + h.elapsedSeconds, 0) / completedThisWeek.length / 60)
    : 0;

  // 连续天数（从今天往回数，正确处理 DST）
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < 365; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    const dayStart = checkDate.getTime();
    // 用 setDate 计算次日边界，正确处理夏令时（M4 fix）
    const nextDay = new Date(checkDate);
    nextDay.setDate(checkDate.getDate() + 1);
    const dayEnd = nextDay.getTime();

    const hasCompleted = history.some(h =>
      h.startedAt >= dayStart && h.startedAt < dayEnd && h.elapsedSeconds >= h.targetSeconds
    );
    if (hasCompleted) {
      streak++;
    } else if (d > 0) {
      break;
    }
  }

  return {
    totalDisplay,
    completedCount: completedThisWeek.length,
    avgMin,
    streak
  };
}

/**
 * HTML 转义，防止 XSS
 */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
