// ============================================================
// 读书喵 — 统计 + 历史 共用脚本
// 供 blocked.html / timer.html 引用
// ============================================================

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

function renderPageStats(history) {
  const statsGrid = document.getElementById('statsGrid');
  const historyList = document.getElementById('historyList');
  if (!statsGrid || !historyList) return;

  if (!history || history.length === 0) {
    statsGrid.querySelector('#pgStatTotal').textContent = '0 min';
    statsGrid.querySelector('#pgStatSessions').innerHTML = `0 <small>${t('次')}</small>`;
    statsGrid.querySelector('#pgStatAvg').textContent = '0 min';
    statsGrid.querySelector('#pgStatStreak').innerHTML = `0 <small>${t('天')}</small>`;
    historyList.innerHTML = `<div class="history-empty">${t('暂无记录')}</div>`;
    return;
  }

  // 本周起始（周一）
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  const weekItems = history.filter(h => h.startedAt >= weekStartTs);
  const completedThisWeek = weekItems.filter(h => h.elapsedSeconds >= h.targetSeconds);
  const totalMinutes = Math.round(weekItems.reduce((sum, h) => sum + h.elapsedSeconds, 0) / 60);

  let totalDisplay;
  if (totalMinutes >= 60) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    totalDisplay = mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
  } else {
    totalDisplay = `${totalMinutes} min`;
  }

  const avgMin = completedThisWeek.length > 0
    ? Math.round(completedThisWeek.reduce((s, h) => s + h.elapsedSeconds, 0) / completedThisWeek.length / 60)
    : 0;

  // 连续天数
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 0; d < 365; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    const dayStart = checkDate.getTime();
    const dayEnd = dayStart + 86400000;
    const hasCompleted = history.some(h =>
      h.startedAt >= dayStart && h.startedAt < dayEnd && h.elapsedSeconds >= h.targetSeconds
    );
    if (hasCompleted) streak++;
    else if (d > 0) break;
  }

  statsGrid.querySelector('#pgStatTotal').textContent = totalDisplay;
  statsGrid.querySelector('#pgStatSessions').innerHTML = `${completedThisWeek.length} <small>${t('次')}</small>`;
  statsGrid.querySelector('#pgStatAvg').textContent = `${avgMin} min`;
  statsGrid.querySelector('#pgStatStreak').innerHTML = `${streak} <small>${t('天')}</small>`;

  // 历史列表（最近 10 条）
  const sorted = [...history].reverse().slice(0, 10);
  historyList.innerHTML = sorted.map(h => {
    const readMin = Math.floor(h.elapsedSeconds / 60);
    const targetMin = Math.floor(h.targetSeconds / 60);
    const done = h.elapsedSeconds >= h.targetSeconds;
    return `
      <div class="history-item">
        <span class="history-date">${fmtDate(h.startedAt)}</span>
        <span class="history-dur">${readMin}/${targetMin} min</span>
        <span class="history-tag ${done ? 'done' : 'partial'}">${done ? t('✓ 完成') : t('未完成')}</span>
      </div>`;
  }).join('');
}

function loadPageStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;
    renderPageStats(res.history);
  });
}

// 清除历史按钮
document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('pgClearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm(t('确定清除所有阅读记录吗？'))) {
        chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
          renderPageStats([]);
        });
      }
    });
  }
  // 初始加载
  loadPageStats();
});
