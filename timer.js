// ============================================================
// 读书喵 — 离线阅读计时器页面脚本
// ============================================================

// 读取主题 + 语言设置
chrome.storage.local.get(['theme', 'lang'], (r) => {
  const theme = r.theme || 'auto';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

  if (typeof setLang === 'function') setLang(r.lang || 'auto');
  if (typeof initI18n === 'function') initI18n();
});

function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimer() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;

    const { session, remaining, progress } = res;
    const timerBig    = document.getElementById('timerBig');
    const progressBar = document.getElementById('progressBar');
    const progressPct = document.getElementById('progressPct');
    const statusChip  = document.getElementById('statusChip');
    const statusText  = document.getElementById('statusText');
    const bubbleTitle = document.getElementById('bubbleTitle');
    const timerLabel  = document.getElementById('timerLabel');
    const timerUnit   = document.getElementById('timerUnit');
    const tipsBox     = document.getElementById('tipsBox');
    const doneMsg     = document.getElementById('doneMsg');

    progressBar.style.width = progress + '%';
    progressPct.textContent = progress + '%';

    switch (session.status) {
      case 'running':
        timerBig.textContent = fmtTime(remaining);
        timerBig.classList.remove('done');
        timerLabel.textContent = t('剩余阅读时间');
        timerUnit.textContent = t('分 : 秒');
        bubbleTitle.textContent = t('专注阅读中喵～ 📖');
        bubbleTitle.classList.remove('done');
        statusChip.className = 'status-chip running';
        statusText.textContent = t('阅读计时中');
        progressBar.classList.remove('done');
        progressPct.classList.remove('done');
        tipsBox.classList.remove('hidden');
        doneMsg.classList.add('hidden');
        break;

      case 'paused':
        timerBig.textContent = fmtTime(remaining);
        timerBig.classList.remove('done');
        timerLabel.textContent = t('剩余阅读时间（已暂停）');
        timerUnit.textContent = t('分 : 秒');
        bubbleTitle.textContent = t('暂停中喵～ ⏸️');
        bubbleTitle.classList.remove('done');
        statusChip.className = 'status-chip paused';
        statusText.textContent = t('已暂停');
        progressBar.classList.remove('done');
        progressPct.classList.remove('done');
        tipsBox.classList.remove('hidden');
        doneMsg.classList.add('hidden');
        break;

      case 'completed':
        timerBig.textContent = '🎉';
        timerBig.classList.add('done');
        timerLabel.textContent = t('阅读完成');
        timerUnit.textContent = '';
        bubbleTitle.textContent = t('阅读完成喵！🎊');
        bubbleTitle.classList.add('done');
        statusChip.className = 'status-chip completed';
        statusText.textContent = t('完成！自由浏览');
        progressBar.style.width = '100%';
        progressBar.classList.add('done');
        progressPct.textContent = '100%';
        progressPct.classList.add('done');
        tipsBox.classList.add('hidden');
        doneMsg.classList.remove('hidden');
        break;

      case 'idle':
        timerBig.textContent = '--:--';
        timerBig.classList.remove('done');
        timerLabel.textContent = t('未开始');
        timerUnit.textContent = '';
        bubbleTitle.textContent = t('还没开始喵～ 🐱');
        bubbleTitle.classList.remove('done');
        statusChip.className = 'status-chip paused';
        statusText.textContent = t('空闲');
        tipsBox.classList.remove('hidden');
        doneMsg.classList.add('hidden');
        break;
    }
  });
}

updateTimer();
setInterval(updateTimer, 1000);
