// ============================================================
// 读书喵 — 国际化 (i18n)
// 支持手动切换 / 自动跟随系统语言
// ============================================================

// 语言状态（先用系统语言，popup 会从 storage 覆盖）
let _IS_ZH = (() => {
  try { return (chrome.i18n?.getUILanguage?.() || navigator.language || 'zh').toLowerCase().startsWith('zh'); }
  catch { return true; }
})();

const _EN = {
  // -- 通用 --
  '读书喵': 'Reading Cat',
  '设置': 'Settings',
  '保存设置': 'Save Settings',

  // -- 个人设置 --
  '个人设置': 'Preferences',
  '外观': 'Theme',
  '跟随系统': 'System',
  '浅色': 'Light',
  '深色': 'Dark',
  '语言': 'Language',
  '自动': 'Auto',
  '中文': '中文',
  'English': 'English',

  // -- 计时器面板 --
  '准备开始': 'Ready',
  '阅读中': 'Reading',
  '已暂停': 'Paused',
  '完成！自由浏览': 'Done! Free browsing',
  '开始阅读': 'Start Reading',
  '暂停': 'Pause',
  '继续': 'Resume',
  '结束 Session': 'End Session',
  '开始新 Session': 'New Session',
  '选择阅读时长': 'Select reading duration',
  '自定义': 'Custom',
  '分钟': 'min',

  // -- 快捷添加按钮（L1 fix） --
  '📖 微信读书': '📖 WeRead',
  '📗 豆瓣阅读': '📗 Douban Read',
  '📘 豆瓣读书': '📘 Douban Books',
  '📕 知乎阅读': '📕 Zhihu Read',

  // -- 设置面板 --
  '阅读网站': 'Reading Sites',
  '只有在这些网站上花的时间才算阅读时间': 'Only time on these sites counts as reading',
  '输入域名，如 weread.qq.com': 'Enter domain, e.g. weread.qq.com',
  '快捷添加': 'Quick Add',
  '阅读记录': 'Reading History',
  '清除记录': 'Clear History',
  '暂无': 'None',
  '暂无记录': 'No records',

  // -- 统计 --
  '本周统计': 'This Week',
  '总阅读': 'Total',
  '完成': 'Done',
  '平均': 'Average',
  '连续': 'Streak',
  '次': 'sessions',
  '天': 'days',

  // -- Toast --
  '已存在': 'Already exists',
  'Session 已结束': 'Session ended',
  '✅ 设置已保存': '✅ Settings saved',
  '记录已清除': 'History cleared',
  '确定清除所有阅读记录吗？': 'Clear all reading history?',
  '✓ 完成': '✓ Done',
  '未完成': 'Incomplete',
  '目标调整为 {0} 分钟': 'Target set to {0} min',

  // -- 离线模式 --
  '📚 离线阅读模式（屏蔽所有网站）': '📚 Offline mode (all sites blocked)',
  '📚 离线阅读模式 · 计时自动进行': '📚 Offline mode · Auto timing',
  '专注阅读中喵～ 📖': 'Focus reading time~ 📖',
  '阅读计时中': 'Timer running',
  '剩余阅读时间': 'Time remaining',
  '剩余阅读时间（已暂停）': 'Time remaining (paused)',
  '阅读完成': 'Complete',
  '阅读完成喵！🎊': 'Reading complete! 🎊',
  '暂停中喵～ ⏸️': 'Paused~ ⏸️',
  '还没开始喵～ 🐱': 'Not started~ 🐱',
  '空闲': 'Idle',
  '分 : 秒': 'min : sec',
  '未开始': 'Not started',

  // -- 拦截页 --
  '先去阅读喵～ 📖': 'Go read first~ 📖',
  '距离解锁还需': 'Time until unlock',
  '被拦截：': 'Blocked: ',
  '未知页面': 'Unknown page',

  // -- 提示 --
  '🐱 小提示': '🐱 Tips',
  '切换到阅读网站标签页，计时器自动开始': 'Switch to a reading site tab to start the timer',
  '目标达成后这个页面会自动跳转': 'This page auto-redirects when done',
  '点击扩展图标可以调整剩余时间': 'Click extension icon to adjust time',
  '去读你的实体书或用其他软件阅读吧': 'Read your physical book or use other apps',
  '计时器会自动倒计时，不需要操作': 'Timer counts down automatically',
  '完成后所有网站将自动解锁': 'All sites unlock when complete',
  '点击扩展图标可以暂停或调整时间': 'Click extension icon to pause or adjust',
  '🐾 读书喵 · 和猫猫一起坚持阅读': '🐾 Reading Cat · Read with your cat',

  // -- 页面标题 --
  '读书喵': 'Reading Cat',
  '📖 先完成阅读喵～': '📖 Go read first~',
  '📖 读书喵 · 专注阅读中': '📖 Reading Cat · Focus Reading',

  // -- 通知 --
  '阅读完成！': 'Reading complete!',

  // -- 新手引导 --
  '欢迎使用读书喵！🐱': 'Welcome to Reading Cat! 🐱',
  '添加阅读网站进行在线阅读，或直接开始进入离线模式': 'Add reading sites for online reading, or start directly for offline mode',
  '在线阅读': 'Online Reading',
  '在阅读网站上读书，只有在这些网站上的时间才计入阅读时长': 'Read on websites — only time on these sites counts',
  '离线阅读': 'Offline Reading',
  '读实体书或用其他软件，计时器自动倒计时，所有网站被屏蔽': 'Physical books or other apps — auto timer, all sites blocked',
  '知道了': 'Got it',
};

/**
 * 设置语言（供 popup 调用）
 * @param {'auto'|'zh'|'en'} lang
 */
function setLang(lang) {
  if (lang === 'zh') {
    _IS_ZH = true;
  } else if (lang === 'en') {
    _IS_ZH = false;
  } else {
    // auto: 跟随系统
    try { _IS_ZH = (chrome.i18n?.getUILanguage?.() || navigator.language || 'zh').toLowerCase().startsWith('zh'); }
    catch { _IS_ZH = true; }
  }
}

/**
 * 翻译函数：传入中文，返回对应语言文本
 */
function t(zh, ...args) {
  let text = _IS_ZH ? zh : (_EN[zh] || zh);
  args.forEach((v, i) => { text = text.replace(`{${i}}`, v); });
  return text;
}

/**
 * 自动翻译页面中带 data-i18n 属性的元素
 */
function initI18n() {
  // 始终更新页面标题和 lang 属性
  updatePageMeta();

  if (_IS_ZH) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n || el.textContent.trim();
    const translated = _EN[key];
    if (translated) el.textContent = translated;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const translated = _EN[key];
    if (translated) el.placeholder = translated;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const translated = _EN[key];
    if (translated) el.title = translated;
  });
}

/**
 * 重新翻译整个页面（切换语言后调用）
 */
function reTranslatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = _IS_ZH ? key : (_EN[key] || key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    el.placeholder = _IS_ZH ? key : (_EN[key] || key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (!key) return;
    el.title = _IS_ZH ? key : (_EN[key] || key);
  });

  // 更新页面标题和 lang 属性
  updatePageMeta();
}

/**
 * 更新页面标题和 html lang 属性
 */
function updatePageMeta() {
  // 更新 html lang 属性
  document.documentElement.lang = _IS_ZH ? 'zh-CN' : 'en';

  // 更新 <title>（若有 data-i18n-title-page）
  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) {
    document.title = _IS_ZH ? titleKey : (_EN[titleKey] || titleKey);
  }
}
