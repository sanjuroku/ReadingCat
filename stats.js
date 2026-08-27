// ============================================================
// 读书喵 — 统计 + 历史 共用脚本
// 供 blocked.html / timer.html 引用
// 依赖：utils.js（calcStats, fmtDate, esc）
// ============================================================

function renderPageStats(history) {
  const statsGrid = document.getElementById('statsGrid');
  const historyList = document.getElementById('historyList');
  if (!statsGrid || !historyList) return;

  // 使用 calcStats 统一计算（M5 fix：DRY）
  const s = calcStats(history);

  statsGrid.querySelector('#pgStatTotal').textContent = s.totalDisplay;
  statsGrid.querySelector('#pgStatSessions').innerHTML = `${s.completedCount} <small>${t('次')}</small>`;
  statsGrid.querySelector('#pgStatAvg').textContent = `${s.avgMin} min`;
  statsGrid.querySelector('#pgStatStreak').innerHTML = `${s.streak} <small>${t('天')}</small>`;

  if (!history || history.length === 0) {
    historyList.innerHTML = `<div class="history-empty">${t('暂无记录')}</div>`;
    return;
  }

  // 历史列表（最近 10 条）
  const sorted = [...history].reverse().slice(0, 10);
  historyList.innerHTML = sorted.map(h => {
    const readMin = Math.floor(h.elapsedSeconds / 60);
    const targetMin = Math.floor(h.targetSeconds / 60);
    const done = h.elapsedSeconds >= h.targetSeconds;
    return `
      <div class="history-item">
        <span class="history-date">${esc(fmtDate(h.startedAt))}</span>
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
