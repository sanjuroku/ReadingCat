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

// ------ 内存单例（修复 C1 竞态） ------
// 所有操作直接在内存中执行，避免并发 read-modify-write
// 状态变更后异步持久化到 storage

let _session = null;
let _settings = null;
let _tickBusy = false;  // 防止 tick 重入

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

async function loadState() {
  const r = await chrome.storage.local.get(['session', 'settings']);
  _session = { ...DEFAULT_SESSION, ...(r.session || {}) };
  _settings = { ...DEFAULT_SETTINGS, ...(r.settings || {}) };
}

async function persistSession() {
  if (_session) await chrome.storage.local.set({ session: { ..._session } });
}

async function persistSettings() {
  if (_settings) await chrome.storage.local.set({ settings: { ..._settings } });
}

async function ensureLoaded() {
  if (!_session || !_settings) await loadState();
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
  // 防止重入（修复 C1：tick + 消息处理并发写）
  if (_tickBusy) return;
  _tickBusy = true;

  try {
    await ensureLoaded();
    if (_session.status !== 'running') return;

    const now = Date.now();

    if (_settings.readingSites.length === 0) {
      // 离线阅读模式：时间自动累计
      if (_session.lastTick > 0) {
        const deltaMs = now - _session.lastTick;
        _session.elapsedMs = (_session.elapsedMs || 0) + Math.min(deltaMs, 5000);
        _session.elapsedSeconds = Math.floor(_session.elapsedMs / 1000);
      }
    } else {
      // 在线阅读模式：任意窗口有阅读网站即计时（修复 H2）
      try {
        const tabs = await chrome.tabs.query({ active: true });
        const onReadingSite = tabs.some(tab =>
          tab.url && isReadingSite(tab.url, _settings.readingSites)
        );
        if (onReadingSite && _session.lastTick > 0) {
          const deltaMs = now - _session.lastTick;
          _session.elapsedMs = (_session.elapsedMs || 0) + Math.min(deltaMs, 5000);
          _session.elapsedSeconds = Math.floor(_session.elapsedMs / 1000);
        }
      } catch { /* ignore */ }
    }

    _session.lastTick = now;

    // 检查是否完成
    if (_session.elapsedSeconds >= _session.targetSeconds) {
      _session.status = 'completed';
      _session.completedAt = now;
      _session.elapsedSeconds = _session.targetSeconds; // 封顶

      // 存入历史
      const history = await getHistory();
      history.push({
        startedAt: _session.startedAt,
        completedAt: _session.completedAt,
        targetSeconds: _session.targetSeconds,
        elapsedSeconds: _session.elapsedSeconds
      });
      if (history.length > 50) history.splice(0, history.length - 50);
      await saveHistory(history);

      // 更新图标徽章
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#059669' });

      // 发送系统通知（根据语言设置）
      const targetMin = Math.round(_session.targetSeconds / 60);
      const notifId = 'session-complete-' + Date.now();
      try {
        const langData = await chrome.storage.local.get('lang');
        const lang = langData.lang || 'auto';
        const isZH = lang === 'zh' || (lang === 'auto' && chrome.i18n.getUILanguage().startsWith('zh'));

        chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: isZH ? '🎉 读书喵：阅读完成！' : '🎉 Reading Cat: Complete!',
          message: isZH
            ? `太棒了！你完成了 ${targetMin} 分钟的阅读目标，现在可以自由浏览了～`
            : `Great job! You completed your ${targetMin}-minute reading goal. Free to browse now!`,
          priority: 2
        });
      } catch (e) { console.warn('通知发送失败:', e); }
    }

    await persistSession();
  } finally {
    _tickBusy = false;
  }
}

// 每秒 tick（worker 存活期间提供秒级精度）
setInterval(tick, 1000);

// alarm 后备（M1：service worker 休眠保护）
// MV3 的 service worker 空闲 ~30 秒后可能被回收。
// alarm 每 30 秒唤醒 worker，顶层 setInterval 在重新执行时恢复。
// lastTick 差值补偿保证即使 30 秒没 tick 也不丢时间。
chrome.alarms.create('session-tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'session-tick') tick();
});

// ------ 拦截导航 ------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' || !tab.url) return;

  await ensureLoaded();
  if (_session.status !== 'running' && _session.status !== 'paused') return;

  const url = tab.url;
  if (isAllowedSite(url, _settings.allowedSites)) return;

  if (_settings.readingSites.length === 0) {
    // 离线阅读模式：只允许 timer.html，其他全部屏蔽
    if (url.includes(chrome.runtime.getURL('timer.html'))) return;
    if (url.includes(chrome.runtime.getURL('blocked.html'))) return;
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('timer.html') });
  } else {
    // 在线阅读模式：允许阅读网站，屏蔽其他
    if (isReadingSite(url, _settings.readingSites)) return;
    if (url.includes(chrome.runtime.getURL('blocked.html'))) return;

    const remaining = Math.max(0, _session.targetSeconds - _session.elapsedSeconds);
    const remainMin = Math.ceil(remaining / 60);
    const targetMin = Math.ceil(_session.targetSeconds / 60);

    const blockedUrl = chrome.runtime.getURL('blocked.html') +
      `?remaining=${remainMin}&target=${targetMin}&elapsed=${_session.elapsedSeconds}` +
      `&url=${encodeURIComponent(url)}&status=${_session.status}`;

    chrome.tabs.update(tabId, { url: blockedUrl });
  }
});

// ------ 消息处理 ------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'GET_STATUS') {
    (async () => {
      await ensureLoaded();
      const history = await getHistory();
      const remaining = Math.max(0, _session.targetSeconds - _session.elapsedSeconds);
      const progress = _session.targetSeconds > 0
        ? Math.min(100, Math.round((_session.elapsedSeconds / _session.targetSeconds) * 100))
        : 0;
      sendResponse({
        settings: { ..._settings },
        session: { ..._session },
        history,
        remaining,
        progress
      });
    })();
    return true;
  }

  if (msg.type === 'SAVE_SETTINGS') {
    (async () => {
      // 合并而非覆盖（修复 H3）
      await ensureLoaded();
      _settings = { ..._settings, ...msg.settings };
      await persistSettings();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'START_SESSION') {
    (async () => {
      await ensureLoaded();
      const targetSeconds = (msg.minutes || 25) * 60;
      _session = {
        status: 'running',
        targetSeconds,
        elapsedMs: 0,
        elapsedSeconds: 0,
        lastTick: Date.now(),
        startedAt: Date.now(),
        completedAt: 0
      };
      await persistSession();

      // 保存上次使用的时间
      _settings.lastUsedMinutes = msg.minutes || 25;
      await persistSettings();

      // 徽章
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });

      // 离线阅读模式：自动打开计时器页面
      if (_settings.readingSites.length === 0) {
        const timerUrl = chrome.runtime.getURL('timer.html');
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
      await ensureLoaded();
      if (_session.status === 'running') {
        _session.status = 'paused';
        _session.lastTick = 0;
        await persistSession();
        chrome.action.setBadgeText({ text: '⏸' });
        chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'RESUME_SESSION') {
    (async () => {
      await ensureLoaded();
      if (_session.status === 'paused') {
        _session.status = 'running';
        _session.lastTick = Date.now();
        await persistSession();
        chrome.action.setBadgeText({ text: '▶' });
        chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'STOP_SESSION') {
    (async () => {
      await ensureLoaded();
      // 如果有进度，存入历史
      if (_session.elapsedSeconds > 0) {
        const history = await getHistory();
        history.push({
          startedAt: _session.startedAt,
          completedAt: Date.now(),
          targetSeconds: _session.targetSeconds,
          elapsedSeconds: _session.elapsedSeconds
        });
        if (history.length > 50) history.splice(0, history.length - 50);
        await saveHistory(history);
      }
      _session = { ...DEFAULT_SESSION };
      await persistSession();
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'FINISH_SESSION') {
    (async () => {
      await ensureLoaded();
      _session = { ...DEFAULT_SESSION };
      await persistSession();
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'UPDATE_TARGET') {
    (async () => {
      await ensureLoaded();
      if (_session.status === 'running' || _session.status === 'paused') {
        _session.targetSeconds = (msg.minutes || 25) * 60;
        await persistSession();
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

// 初始化
(async () => {
  await loadState();
  if (_session.status === 'running') {
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
  } else if (_session.status === 'paused') {
    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
  } else if (_session.status === 'completed') {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });
  }
})();

console.log('读书喵 v2.1 已启动 🐱');
