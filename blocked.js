// ============================================================
// 读书喵 — 拦截页脚本
// ============================================================

// 读取主题 + 语言设置
chrome.storage.local.get(['theme', 'lang'], (r) => {
  const theme = r.theme || 'auto';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

  if (typeof setLang === 'function') setLang(r.lang || 'auto');
  if (typeof initI18n === 'function') initI18n();
});

const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get('url') || '';
const status = params.get('status') || 'running';
const initialRemaining = parseInt(params.get('remaining')) || 0;
const targetMin = parseInt(params.get('target')) || 25;

// 初始显示：URL
const urlEl = document.getElementById('blockedUrl');
urlEl.innerHTML = `<span class="blocked-url-label">${t('被拦截：')}</span>` +
  (blockedUrl ? decodeURIComponent(blockedUrl) : t('未知页面'));

// 初始显示：用 URL 参数先填一次时间
const initMin = Math.floor(initialRemaining);
document.getElementById('timerBig').textContent =
  String(initMin).padStart(2, '0') + ':00';

// 初始进度
const initProgress = targetMin > 0
  ? Math.max(0, Math.round(((targetMin - initialRemaining) / targetMin) * 100))
  : 0;
document.getElementById('progressBar').style.width = initProgress + '%';
document.getElementById('progressPct').textContent = initProgress + '%';

// 状态标签
const chip = document.getElementById('statusChip');
const chipText = chip.querySelector('span:last-child') || chip;

if (status === 'paused') {
  chipText.textContent = t('已暂停');
  chip.className = 'status-chip paused';
}

// 轮询状态
function updateStatus() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (chrome.runtime.lastError) return;
    if (!res) return;

    const { session, remaining } = res;

    // 已完成或 idle → 跳转
    if (session.status === 'completed' || session.status === 'idle') {
      if (blockedUrl) {
        window.location.href = decodeURIComponent(blockedUrl);
      } else {
        window.location.href = 'about:blank';
      }
      return;
    }

    // 更新倒计时
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    document.getElementById('timerBig').textContent =
      String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');

    // 进度条
    const progress = session.targetSeconds > 0
      ? Math.round((session.elapsedSeconds / session.targetSeconds) * 100) : 0;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('progressPct').textContent = progress + '%';

    // 状态标签
    if (session.status === 'paused') {
      chipText.textContent = t('已暂停');
      chip.className = 'status-chip paused';
    } else {
      chipText.textContent = t('阅读中');
      chip.className = 'status-chip running';
    }
  });
}

updateStatus();
setInterval(updateStatus, 1000);

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
