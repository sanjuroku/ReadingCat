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

// DOM 缓存（修复 L2：避免每秒重新 getElementById）
const _dom = {
  timerBig:    null,
  progressBar: null,
  progressPct: null,
  statusChip:  null,
  statusText:  null,
  bubbleTitle: null,
  timerLabel:  null,
  timerUnit:   null,
  tipsBox:     null,
  doneMsg:     null,
  doneMsgText: null
};

function cacheDom() {
  _dom.timerBig    = document.getElementById('timerBig');
  _dom.progressBar = document.getElementById('progressBar');
  _dom.progressPct = document.getElementById('progressPct');
  _dom.statusChip  = document.getElementById('statusChip');
  _dom.statusText  = document.getElementById('statusText');
  _dom.bubbleTitle = document.getElementById('bubbleTitle');
  _dom.timerLabel  = document.getElementById('timerLabel');
  _dom.timerUnit   = document.getElementById('timerUnit');
  _dom.tipsBox     = document.getElementById('tipsBox');
  _dom.doneMsg     = document.getElementById('doneMsg');
  _dom.doneMsgText = document.getElementById('doneMsgText');
}

cacheDom();

function updateTimer() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;

    const { session, remaining, progress } = res;

    _dom.progressBar.style.width = progress + '%';
    _dom.progressPct.textContent = progress + '%';

    switch (session.status) {
      case 'running':
        _dom.timerBig.textContent = fmtTime(remaining);
        _dom.timerBig.classList.remove('done');
        _dom.timerLabel.textContent = t('剩余阅读时间');
        _dom.timerUnit.textContent = t('分 : 秒');
        _dom.bubbleTitle.textContent = t('专注阅读中喵～ 📖');
        _dom.bubbleTitle.classList.remove('done');
        _dom.statusChip.className = 'status-chip running';
        _dom.statusText.textContent = t('阅读计时中');
        _dom.progressBar.classList.remove('done');
        _dom.progressPct.classList.remove('done');
        _dom.tipsBox.classList.remove('hidden');
        _dom.doneMsg.classList.add('hidden');
        break;

      case 'paused':
        _dom.timerBig.textContent = fmtTime(remaining);
        _dom.timerBig.classList.remove('done');
        _dom.timerLabel.textContent = t('剩余阅读时间（已暂停）');
        _dom.timerUnit.textContent = t('分 : 秒');
        _dom.bubbleTitle.textContent = t('暂停中喵～ ⏸️');
        _dom.bubbleTitle.classList.remove('done');
        _dom.statusChip.className = 'status-chip paused';
        _dom.statusText.textContent = t('已暂停');
        _dom.progressBar.classList.remove('done');
        _dom.progressPct.classList.remove('done');
        _dom.tipsBox.classList.remove('hidden');
        _dom.doneMsg.classList.add('hidden');
        break;

      case 'completed':
        _dom.timerBig.textContent = '🎉';
        _dom.timerBig.classList.add('done');
        _dom.timerLabel.textContent = t('阅读完成');
        _dom.timerUnit.textContent = '';
        _dom.bubbleTitle.textContent = t('阅读完成喵！🎊');
        _dom.bubbleTitle.classList.add('done');
        _dom.statusChip.className = 'status-chip completed';
        _dom.statusText.textContent = t('完成！自由浏览');
        _dom.progressBar.style.width = '100%';
        _dom.progressBar.classList.add('done');
        _dom.progressPct.textContent = '100%';
        _dom.progressPct.classList.add('done');
        _dom.tipsBox.classList.add('hidden');
        _dom.doneMsg.classList.remove('hidden');
        if (_dom.doneMsgText) {
          _dom.doneMsgText.innerHTML = _IS_ZH
            ? '🎉 阅读目标达成！<br>现在可以自由浏览啦～'
            : '🎉 Reading goal achieved!<br>Free to browse now~';
        }
        break;

      case 'idle':
        _dom.timerBig.textContent = '--:--';
        _dom.timerBig.classList.remove('done');
        _dom.timerLabel.textContent = t('未开始');
        _dom.timerUnit.textContent = '';
        _dom.bubbleTitle.textContent = t('还没开始喵～ 🐱');
        _dom.bubbleTitle.classList.remove('done');
        _dom.statusChip.className = 'status-chip paused';
        _dom.statusText.textContent = t('空闲');
        _dom.tipsBox.classList.remove('hidden');
        _dom.doneMsg.classList.add('hidden');
        break;
    }
  });
}

updateTimer();
setInterval(updateTimer, 1000);

// 实时监听主题 + 语言变更
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.theme) {
    const theme = changes.theme.newValue || 'auto';
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }
  if (changes.lang) {
    if (typeof setLang === 'function') setLang(changes.lang.newValue || 'auto');
    if (typeof reTranslatePage === 'function') reTranslatePage();
  }
});
