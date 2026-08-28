#!/usr/bin/env bash
# ============================================================
# 读书喵 ReadingCat — Build Script
# 为 Chrome 和 Firefox 分别打包扩展
# ============================================================

set -euo pipefail

# In CI, derive version from the git tag (GITHUB_REF_NAME) so the zip
# filenames always match the tag.  Locally, fall back to manifest.json.
if [[ -n "${GITHUB_REF_NAME:-}" && "${GITHUB_REF_NAME:-}" == v* ]]; then
  VERSION="${GITHUB_REF_NAME#v}"
else
  VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
fi
DIST="dist"

# 扩展源文件列表
FILES=(
  background.js
  popup.html popup.css popup.js
  blocked.html blocked.js
  timer.html timer.js
  i18n.js utils.js stats.js
  theme.css
)
DIRS=(icons _locales)

echo "🐱 Building ReadingCat v${VERSION}..."
echo ""

# 清理
rm -rf "$DIST"
mkdir -p "$DIST/chrome" "$DIST/firefox"

# 复制公共文件
for target in chrome firefox; do
  for f in "${FILES[@]}"; do
    cp "$f" "$DIST/$target/"
  done
  for d in "${DIRS[@]}"; do
    cp -r "$d" "$DIST/$target/"
  done
done

# 生成 Chrome manifest（只有 service_worker，不含 browser_specific_settings）
node -e "
const m = require('./manifest.json');
m.background = { service_worker: m.background.service_worker };
delete m.browser_specific_settings;
process.stdout.write(JSON.stringify(m, null, 2) + '\n');
" > "$DIST/chrome/manifest.json"

# 生成 Firefox manifest（只有 scripts，保留 browser_specific_settings）
node -e "
const m = require('./manifest.json');
m.background = { scripts: m.background.scripts || [m.background.service_worker] };
process.stdout.write(JSON.stringify(m, null, 2) + '\n');
" > "$DIST/firefox/manifest.json"

# 打包 zip
(cd "$DIST/chrome"  && zip -r "../readingcat-${VERSION}-chrome.zip" . -x "*.DS_Store") > /dev/null
(cd "$DIST/firefox" && zip -r "../readingcat-${VERSION}-firefox.zip" . -x "*.DS_Store") > /dev/null

echo "✅ Chrome:  dist/readingcat-${VERSION}-chrome.zip"
echo "✅ Firefox: dist/readingcat-${VERSION}-firefox.zip"
echo ""
echo "📂 解压后的目录："
echo "   Chrome:  dist/chrome/"
echo "   Firefox: dist/firefox/"
