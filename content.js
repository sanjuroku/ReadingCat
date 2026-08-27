// ============================================================
// 读书喵 — Content Script
// 在阅读页面中注入，检测页面可见性
// ============================================================

(function () {
  let isActive = true;

  // 页面可见性变化 → 通知 background
  document.addEventListener('visibilitychange', () => {
    isActive = !document.hidden;
  });

  // 可以在这里做更多"防挂机"检测，比如要求滚动、鼠标移动等
  // 目前保持简单，只要页面在前台就计时
})();
