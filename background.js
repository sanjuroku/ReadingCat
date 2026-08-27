// ============================================================
// 读书喵 — Background Service Worker
// 番茄钟式 Session 模式 + 离线阅读模式
// ============================================================

// Session 状态: idle / running / paused / completed
const DEFAULT_SESSION = {
  status: 'idle',          // idle | running | paused | completed
  targetSeconds: 25 * 60,  // 本次 session 目标秒数
  elapsedMs: 0,            // 已阅读毫秒数（精确累计）
  elapsedSeconds: 0,       // 已阅读秒数（= Math.floor(elapsedMs/1000)，用于显示）
  lastTick: 0,             // 上次计时时间戳
  startedAt: 0,            // session 开始时间戳
  completedAt: 0           // session 完成时间戳
};

const DEFAULT_SETTINGS = {
  readingSites: [],
  presetMinutes: [15, 25, 30, 45, 60, 90],  // 预设时间选项
  lastUsedMinutes: 25,                        // 上次使用的时间
  allowedSites: [
    'chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://'
  ]
};

// 历史记录
// history: [ { startedAt, completedAt, targetSeconds, elapsedSeconds } ]

// ------ 工具函数 ------

function extractDomain(url) {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ''; }
}

function isReadingSite(url, readingSites) {
  const domain = extractDomain(url);
  if (!domain) return false;
  return readingSites.some(site => {
    const s = site.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return domain === s || domain.endsWith('.' + s);
  });
}

function isAllowedSite(url, allowedSites) {
  return allowedSites.some(prefix => url.startsWith(prefix));
}

// ------ 存储 ------

async function getSettings() {
  const r = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(r.settings || {}) };
}

async function getSession() {
  const r = await chrome.storage.local.get('session');
  return { ...DEFAULT_SESSION, ...(r.session || {}) };
}

async function saveSession(session) {
  await chrome.storage.local.set({ session });
}

async function getHistory() {
  const r = await chrome.storage.local.get('history');
  return r.history || [];
}

async function saveHistory(history) {
  await chrome.storage.local.set({ history });
}

// ------ 计时核心 ------

async function tick() {
  const session = await getSession();
  if (session.status !== 'running') return;

  const settings = await getSettings();
  const now = Date.now();

  if (settings.readingSites.length === 0) {
    // 离线阅读模式：时间自动累计（不需要在阅读网站上）
    if (session.lastTick > 0) {
      const deltaMs = now - session.lastTick;
      session.elapsedMs = (session.elapsedMs || 0) + Math.min(deltaMs, 5000);
      session.elapsedSeconds = Math.floor(session.elapsedMs / 1000);
    }
  } else {
    // 在线阅读模式：只在阅读网站上累加
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && tab.url && isReadingSite(tab.url, settings.readingSites)) {
        if (session.lastTick > 0) {
          const deltaMs = now - session.lastTick;
          session.elapsedMs = (session.elapsedMs || 0) + Math.min(deltaMs, 5000);
          session.elapsedSeconds = Math.floor(session.elapsedMs / 1000);
        }
      }
    } catch { /* ignore */ }
  }

  session.lastTick = now;

  // 检查是否完成
  if (session.elapsedSeconds >= session.targetSeconds) {
    session.status = 'completed';
    session.completedAt = now;
    session.elapsedSeconds = session.targetSeconds; // 封顶

    // 存入历史
    const history = await getHistory();
    history.push({
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      targetSeconds: session.targetSeconds,
      elapsedSeconds: session.elapsedSeconds
    });
    // 只保留最近 50 条
    if (history.length > 50) history.splice(0, history.length - 50);
    await saveHistory(history);

    // 更新图标徽章
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });

    // 发送系统通知
    const targetMin = Math.round(session.targetSeconds / 60);
    chrome.notifications.create('session-complete', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🎉 读书喵：阅读完成！',
      message: `太棒了！你完成了 ${targetMin} 分钟的阅读目标，现在可以自由浏览了～`,
      priority: 2
    });
  }

  await saveSession(session);
}

// 每秒 tick
setInterval(tick, 1000);

// alarm 后备（service worker 休眠保护）
chrome.alarms.create('session-tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'session-tick') tick();
});

// ------ 拦截导航 ------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' || !tab.url) return;

  const session = await getSession();
  // 只在 running 或 paused 状态才拦截
  if (session.status !== 'running' && session.status !== 'paused') return;

  const settings = await getSettings();
  const url = tab.url;

  if (isAllowedSite(url, settings.allowedSites)) return;

  if (settings.readingSites.length === 0) {
    // 离线阅读模式：只允许 timer.html，其他全部屏蔽
    if (url.includes(chrome.runtime.getURL('timer.html'))) return;
    if (url.includes(chrome.runtime.getURL('blocked.html'))) return;

    // 重定向到计时器页面
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('timer.html') });
  } else {
    // 在线阅读模式：允许阅读网站，屏蔽其他
    if (isReadingSite(url, settings.readingSites)) return;
    if (url.includes(chrome.runtime.getURL('blocked.html'))) return;

    const remaining = Math.max(0, session.targetSeconds - session.elapsedSeconds);
    const remainMin = Math.ceil(remaining / 60);
    const targetMin = Math.ceil(session.targetSeconds / 60);

    const blockedUrl = chrome.runtime.getURL('blocked.html') +
      `?remaining=${remainMin}&target=${targetMin}&elapsed=${session.elapsedSeconds}` +
      `&url=${encodeURIComponent(url)}&status=${session.status}`;

    chrome.tabs.update(tabId, { url: blockedUrl });
  }
});

// ------ 消息处理 ------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'GET_STATUS') {
    (async () => {
      const settings = await getSettings();
      const session = await getSession();
      const history = await getHistory();
      const remaining = Math.max(0, session.targetSeconds - session.elapsedSeconds);
      const progress = session.targetSeconds > 0
        ? Math.min(100, Math.round((session.elapsedSeconds / session.targetSeconds) * 100))
        : 0;

      sendResponse({ settings, session, history, remaining, progress });
    })();
    return true;
  }

  if (msg.type === 'SAVE_SETTINGS') {
    (async () => {
      await chrome.storage.local.set({ settings: msg.settings });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'START_SESSION') {
    (async () => {
      const targetSeconds = (msg.minutes || 25) * 60;
      const session = {
        status: 'running',
        targetSeconds,
        elapsedMs: 0,
        elapsedSeconds: 0,
        lastTick: Date.now(),
        startedAt: Date.now(),
        completedAt: 0
      };
      await saveSession(session);

      // 保存上次使用的时间
      const settings = await getSettings();
      settings.lastUsedMinutes = msg.minutes || 25;
      await chrome.storage.local.set({ settings });

      // 徽章
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });

      // 离线阅读模式：自动打开计时器页面
      if (settings.readingSites.length === 0) {
        const timerUrl = chrome.runtime.getURL('timer.html');
        // 检查是否已有 timer 页面打开
        const tabs = await chrome.tabs.query({});
        const existing = tabs.find(t => t.url && t.url.includes(timerUrl));
        if (existing) {
          chrome.tabs.update(existing.id, { active: true });
        } else {
          chrome.tabs.create({ url: timerUrl });
        }
      }

      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'PAUSE_SESSION') {
    (async () => {
      const session = await getSession();
      if (session.status === 'running') {
        session.status = 'paused';
        session.lastTick = 0;
        await saveSession(session);
        chrome.action.setBadgeText({ text: '⏸' });
        chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'RESUME_SESSION') {
    (async () => {
      const session = await getSession();
      if (session.status === 'paused') {
        session.status = 'running';
        session.lastTick = Date.now();
        await saveSession(session);
        chrome.action.setBadgeText({ text: '▶' });
        chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'STOP_SESSION') {
    (async () => {
      const session = await getSession();
      // 如果有进度，存入历史
      if (session.elapsedSeconds > 0) {
        const history = await getHistory();
        history.push({
          startedAt: session.startedAt,
          completedAt: Date.now(),
          targetSeconds: session.targetSeconds,
          elapsedSeconds: session.elapsedSeconds
        });
        if (history.length > 50) history.splice(0, history.length - 50);
        await saveHistory(history);
      }
      await saveSession({ ...DEFAULT_SESSION });
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'FINISH_SESSION') {
    // 完成后回到 idle（清除 completed 状态）
    (async () => {
      await saveSession({ ...DEFAULT_SESSION });
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'UPDATE_TARGET') {
    (async () => {
      const session = await getSession();
      if (session.status === 'running' || session.status === 'paused') {
        session.targetSeconds = (msg.minutes || 25) * 60;
        await saveSession(session);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'CLEAR_HISTORY') {
    (async () => {
      await saveHistory([]);
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// 初始化徽章
(async () => {
  const session = await getSession();
  if (session.status === 'running') {
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
  } else if (session.status === 'paused') {
    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
  } else if (session.status === 'completed') {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });
  }
})();

console.log('读书喵 v2.1 已启动 🐱');
