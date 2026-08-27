// ============================================================
// 读书喵 — Popup 脚本
// ============================================================

// --- DOM ---
const $ = id => document.getElementById(id);
const panelTimer    = $('panelTimer');
const panelSettings = $('panelSettings');

const ringFill     = $('ringFill');
const timerDisplay = $('timerDisplay');
const timerLabel   = $('timerLabel');
const timePicker   = $('timePicker');
const presetGrid   = $('presetGrid');
const customInput  = $('customMinutes');

const btnStart  = $('btnStart');
const btnPause  = $('btnPause');
const btnResume = $('btnResume');
const btnStop   = $('btnStop');
const btnDone   = $('btnDone');
const adjustRow = $('adjustRow');
const sitesStrip = $('sitesStrip');

let selectedMinutes = 25;
let currentSites = [];
let settingsOpen = false;
let initialized = false;
let presetsRendered = false;

// ------ 深色模式 ------

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.querySelectorAll('#themeSwitcher .theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function loadTheme() {
  chrome.storage.local.get('theme', (r) => {
    applyTheme(r.theme || 'auto');
  });
}

// ------ 语言切换 ------

function applyLang(lang) {
  if (typeof setLang === 'function') setLang(lang);
  document.querySelectorAll('#langSwitcher .theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  // 重新翻译页面
  if (typeof reTranslatePage === 'function') reTranslatePage();
}

function loadLang() {
  chrome.storage.local.get('lang', (r) => {
    const lang = r.lang || 'auto';
    applyLang(lang);
  });
}

// ------ SVG 渐变注入 ------

function injectGradients() {
  const svg = document.querySelector('.timer-ring');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  const grad1 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad1.id = 'grad-primary';
  grad1.setAttribute('x1', '0%'); grad1.setAttribute('y1', '0%');
  grad1.setAttribute('x2', '100%'); grad1.setAttribute('y2', '100%');
  const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#f5a623');
  const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#f7c948');
  grad1.appendChild(s1); grad1.appendChild(s2);

  const grad2 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad2.id = 'grad-success';
  grad2.setAttribute('x1', '0%'); grad2.setAttribute('y1', '0%');
  grad2.setAttribute('x2', '100%'); grad2.setAttribute('y2', '100%');
  const s3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s3.setAttribute('offset', '0%'); s3.setAttribute('stop-color', '#059669');
  const s4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s4.setAttribute('offset', '100%'); s4.setAttribute('stop-color', '#34d399');
  grad2.appendChild(s3); grad2.appendChild(s4);

  defs.appendChild(grad1);
  defs.appendChild(grad2);
  svg.insertBefore(defs, svg.firstChild);
}

// ------ 安全工具 ------

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ------ 格式化 ------

function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

// ------ 渲染：只更新计时器/圆环/按钮状态 ------

function renderTimer(data) {
  const { session, remaining, progress } = data;
  const circumference = 2 * Math.PI * 88;

  const offset = circumference - (progress / 100) * circumference;
  ringFill.style.strokeDasharray = circumference;
  ringFill.style.strokeDashoffset = offset;

  if (session.status === 'completed') {
    ringFill.classList.add('complete');
  } else {
    ringFill.classList.remove('complete');
  }

  switch (session.status) {
    case 'idle':
      timerDisplay.textContent = fmtTime(selectedMinutes * 60);
      timerLabel.textContent = t('准备开始');
      show(timePicker); show(btnStart);
      hide(btnPause); hide(btnResume); hide(btnStop); hide(btnDone); hide(adjustRow);
      break;

    case 'running':
      timerDisplay.textContent = fmtTime(remaining);
      timerLabel.textContent = t('阅读中');
      hide(timePicker); hide(btnStart); hide(btnResume); hide(btnDone);
      show(btnPause); show(btnStop); show(adjustRow);
      break;

    case 'paused':
      timerDisplay.textContent = fmtTime(remaining);
      timerLabel.textContent = t('已暂停');
      hide(timePicker); hide(btnStart); hide(btnPause); hide(btnDone);
      show(btnResume); show(btnStop); show(adjustRow);
      break;

    case 'completed':
      timerDisplay.textContent = '🎉';
      timerLabel.textContent = t('完成！自由浏览');
      hide(timePicker); hide(btnStart); hide(btnPause); hide(btnResume);
      hide(btnStop); hide(adjustRow);
      show(btnDone);
      break;
  }
}

function renderSitesStrip(sites) {
  if (sites.length === 0) {
    sitesStrip.innerHTML = `<span class="empty-msg">${esc(t('📚 离线阅读模式（屏蔽所有网站）'))}</span>`;
  } else {
    sitesStrip.innerHTML = sites.map(s =>
      `<span class="site-chip">🌐 ${esc(s)}</span>`
    ).join('');
  }
}

function renderPresets(presets, active) {
  presetGrid.innerHTML = presets.map(m =>
    `<button class="preset-btn${m === active ? ' active' : ''}" data-min="${m}">${m} min</button>`
  ).join('');

  presetGrid.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMinutes = parseInt(btn.dataset.min);
      customInput.value = '';
      presetGrid.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timerDisplay.textContent = fmtTime(selectedMinutes * 60);
    });
  });
}

// ------ 统计面板 ------

function renderStats(history) {
  if (!history || history.length === 0) {
    $('statTotal').textContent = '0 min';
    $('statSessions').innerHTML = `0 <small>${t('次')}</small>`;
    $('statAvg').textContent = '0 min';
    $('statStreak').innerHTML = `0 <small>${t('天')}</small>`;
    return;
  }

  // 本周起始（周一）
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周日=7
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  // 本周数据
  const weekItems = history.filter(h => h.startedAt >= weekStartTs);
  const completedThisWeek = weekItems.filter(h => h.elapsedSeconds >= h.targetSeconds);
  const totalMinutes = Math.round(weekItems.reduce((sum, h) => sum + h.elapsedSeconds, 0) / 60);

  // 显示时长
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

  // 连续天数（从今天往回数）
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
    if (hasCompleted) {
      streak++;
    } else if (d > 0) {
      // 今天还没完成不算断，但昨天没完成就断了
      break;
    }
  }

  $('statTotal').textContent = totalDisplay;
  $('statSessions').innerHTML = `${completedThisWeek.length} <small>${t('次')}</small>`;
  $('statAvg').textContent = `${avgMin} min`;
  $('statStreak').innerHTML = `${streak} <small>${t('天')}</small>`;
}

// ------ 设置面板渲染 ------

function renderSitesEdit() {
  const container = $('sitesListEdit');
  if (currentSites.length === 0) {
    container.innerHTML = `<span class="empty-msg">${t('暂无')}</span>`;
    return;
  }
  container.innerHTML = currentSites.map((s, i) =>
    `<span class="site-tag">🌐 ${esc(s)}<button class="remove" data-idx="${i}">✕</button></span>`
  ).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSites.splice(parseInt(btn.dataset.idx), 1);
      renderSitesEdit();
      updateQuickBtns();
    });
  });
}

function updateQuickBtns() {
  document.querySelectorAll('#quickGrid .chip').forEach(btn => {
    btn.classList.toggle('added', currentSites.includes(btn.dataset.site));
  });
}

function renderHistory(history) {
  const list = $('historyList');
  if (!history || history.length === 0) {
    list.innerHTML = `<div class="history-empty">${t('暂无记录')}</div>`;
    return;
  }
  const sorted = [...history].reverse();
  list.innerHTML = sorted.map(h => {
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

// ------ 新手引导 ------

function checkOnboarding() {
  chrome.storage.local.get('onboardDone', (r) => {
    if (!r.onboardDone) {
      show($('onboarding'));
    }
  });
}

// ------ 工具 ------

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showToast(msg) {
  const toastEl = $('toast');
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ------ 首次加载（只跑一次） ------

function initFromStorage() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;

    selectedMinutes = res.settings.lastUsedMinutes || 25;
    currentSites = [...res.settings.readingSites];

    renderPresets(res.settings.presetMinutes || [15, 25, 30, 45, 60, 90], selectedMinutes);
    presetsRendered = true;

    renderSitesEdit();
    updateQuickBtns();
    renderHistory(res.history);
    renderStats(res.history);

    renderTimer(res);
    renderSitesStrip(res.settings.readingSites);

    initialized = true;
  });
}

// ------ 定时刷新 ------

function refreshTimer() {
  if (!initialized) return;

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;
    renderTimer(res);
    renderSitesStrip(res.settings.readingSites);
  });
}

// ------ 事件绑定 ------

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadLang();
  injectGradients();
  initFromStorage();
  checkOnboarding();

  setInterval(refreshTimer, 1000);

  // 新手引导关闭
  $('onboardDismiss').addEventListener('click', () => {
    hide($('onboarding'));
    chrome.storage.local.set({ onboardDone: true });
  });

  // 面板切换
  $('settingsToggle').addEventListener('click', () => {
    settingsOpen = true;
    hide(panelTimer); show(panelSettings);
    // 刷新统计
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res) {
        renderStats(res.history);
        renderHistory(res.history);
      }
    });
  });
  $('settingsBack').addEventListener('click', () => {
    settingsOpen = false;
    hide(panelSettings); show(panelTimer);
  });

  // 深色模式切换
  document.querySelectorAll('#themeSwitcher .theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      chrome.storage.local.set({ theme });
    });
  });

  // 语言切换
  document.querySelectorAll('#langSwitcher .theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      applyLang(lang);
      chrome.storage.local.set({ lang });
      // 刷新动态渲染的内容
      if (initialized) {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
          if (!res) return;
          renderTimer(res);
          renderSitesStrip(res.settings.readingSites);
          renderSitesEdit();
          renderHistory(res.history);
          renderStats(res.history);
        });
      }
    });
  });

  // 自定义时间输入
  customInput.addEventListener('input', () => {
    const v = parseInt(customInput.value);
    if (v > 0) {
      selectedMinutes = Math.min(480, v);
      presetGrid.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      timerDisplay.textContent = fmtTime(selectedMinutes * 60);
    }
  });

  // 开始
  btnStart.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START_SESSION', minutes: selectedMinutes }, () => {
      refreshTimer();
    });
  });

  // 暂停
  btnPause.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'PAUSE_SESSION' }, () => refreshTimer());
  });

  // 继续
  btnResume.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESUME_SESSION' }, () => refreshTimer());
  });

  // 停止
  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
      showToast(t('Session 已结束'));
      refreshTimer();
    });
  });

  // 完成 → 新 session
  btnDone.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'FINISH_SESSION' }, () => refreshTimer());
  });

  // 调整目标时间
  $('adjDown5').addEventListener('click', () => adjustTarget(-5));
  $('adjDown1').addEventListener('click', () => adjustTarget(-1));
  $('adjUp1').addEventListener('click',   () => adjustTarget(1));
  $('adjUp5').addEventListener('click',   () => adjustTarget(5));

  // 添加网站
  $('addSiteBtn').addEventListener('click', addSite);
  $('newSiteInput').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

  // 快捷添加
  document.querySelectorAll('#quickGrid .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.dataset.site;
      if (currentSites.includes(site)) {
        currentSites = currentSites.filter(s => s !== site);
      } else {
        currentSites.push(site);
      }
      renderSitesEdit();
      updateQuickBtns();
    });
  });

  // 保存设置
  $('saveBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: {
        readingSites: [...currentSites],
        presetMinutes: [15, 25, 30, 45, 60, 90],
        lastUsedMinutes: selectedMinutes,
        allowedSites: ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://']
      }
    }, () => {
      settingsOpen = false;
      showToast(t('✅ 设置已保存'));
      refreshTimer();
    });
  });

  // 清除历史
  $('clearHistoryBtn').addEventListener('click', () => {
    if (confirm(t('确定清除所有阅读记录吗？'))) {
      chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
        showToast(t('记录已清除'));
        renderHistory([]);
        renderStats([]);
      });
    }
  });
});

// ------ 调整目标 ------

function adjustTarget(delta) {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;
    const currentMin = Math.ceil(res.session.targetSeconds / 60);
    const newMin = Math.max(1, currentMin + delta);
    chrome.runtime.sendMessage({ type: 'UPDATE_TARGET', minutes: newMin }, () => {
      showToast(t('目标调整为 {0} 分钟', newMin));
      refreshTimer();
    });
  });
}

// ------ 添加网站 ------

function addSite() {
  const input = $('newSiteInput');
  let site = input.value.trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  if (!site) return;
  if (currentSites.includes(site)) {
    showToast(t('已存在'));
    return;
  }
  currentSites.push(site);
  input.value = '';
  renderSitesEdit();
  updateQuickBtns();
}
