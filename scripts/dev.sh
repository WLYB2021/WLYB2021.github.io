#!/usr/bin/env bash
# ============================================
# 本地一键预览：主题就位 → 兼容补丁 → hugo server
# ============================================
# 用法：./scripts/dev.sh   （或 make serve）
# 前置：已安装 Hugo extended（brew install hugo）
set -euo pipefail
cd "$(dirname "$0")/.."

THEME_REPO="https://github.com/adityatelange/hugo-PaperMod.git"
THEME_VERSION="v8.0"

if ! command -v hugo >/dev/null 2>&1; then
  echo "错误：未找到 hugo。请先安装 extended 版：" >&2
  echo "  brew install hugo        # macOS" >&2
  echo "  或从 https://github.com/gohugoio/hugo/releases 下载" >&2
  exit 1
fi

# 主题被 .gitignore 排除，新机器上首次运行需克隆
if [ ! -d "themes/PaperMod" ]; then
  echo "==> 克隆主题 ${THEME_VERSION}"
  git clone --depth 1 --branch "${THEME_VERSION}" "${THEME_REPO}" themes/PaperMod
fi

echo "==> 应用主题兼容性补丁（幂等）"
chmod +x scripts/patch-theme.sh
./scripts/patch-theme.sh themes/PaperMod

echo "==> 启动本地预览：http://localhost:1313"
exec hugo server --bind 127.0.0.1 --port 1313
