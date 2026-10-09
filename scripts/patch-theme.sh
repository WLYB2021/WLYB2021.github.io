#!/usr/bin/env bash
# ============================================
# PaperMod v8.0 兼容性补丁
# ============================================
# 背景：PaperMod v8.0 发布于 Hugo v0.15x 之前，其中 3 处partial 调用
#       使用了旧式 "partials/" 前缀。Hugo v0.146+ 已移除该兼容回退，
#       在新版 Hugo 上会直接渲染失败：
#         ERROR module "PaperMod" not found / partial not found
#
# 本脚本将旧前缀改为 Hugo 现行要求的写法：
#       partial "partials/templates/..." → partial "templates/..."
#
# 幂等：已打过补丁的文件不会重复修改。
# 幂等性通过校验修改后是否仍存在旧写法来保证。
#
# 另外顺带修复 2 处 Hugo v0.158+ 弃用调用（.Language.LanguageDirection
# 与 .Language.LanguageCode），它们会在新版 Hugo 中持续刷告警。
# ============================================
set -euo pipefail

THEME_DIR="${1:-themes/PaperMod}"

if [ ! -d "$THEME_DIR" ]; then
  echo "错误：主题目录不存在 -> $THEME_DIR" >&2
  exit 1
fi

FILES=(
  "layouts/partials/templates/opengraph.html"
  "layouts/partials/templates/schema_json.html"
  "layouts/partials/templates/twitter_cards.html"
)

OLD='partial "partials/templates/_funcs/get-page-images"'
NEW='partial "templates/_funcs/get-page-images"'

echo "==> 修补 PaperMod 兼容性（$THEME_DIR）"

for f in "${FILES[@]}"; do
  path="$THEME_DIR/$f"

  if [ ! -f "$path" ]; then
    echo "  跳过（文件不存在）: $f" >&2
    continue
  fi

  if grep -qF "$NEW" "$path"; then
    echo "  已修补，跳过: $f"
  elif grep -qF "$OLD" "$path"; then
    # 用 sed 精确替换，保持文件原有格式
    sed -i "s|$OLD|$NEW|g" "$path"
    echo "  已修补: $f"
  else
    echo "  警告：未找到预期的旧写法，请人工检查 -> $f" >&2
  fi
done

# 校验修补结果
if grep -rqF "$OLD" "$THEME_DIR/layouts/partials/templates/" 2>/dev/null; then
  echo "错误：仍有未修补的旧写法" >&2
  exit 1
fi

# ---- 修复弃用调用：.Language.LanguageDirection / .Language.LanguageCode ----
DEPRECATED_FILES=(
  "layouts/_default/baseof.html"
  "layouts/_default/rss.xml"
)

echo "==> 修补Hugo 弃用调用"

for f in "${DEPRECATED_FILES[@]}"; do
  path="$THEME_DIR/$f"

  if [ ! -f "$path" ]; then
    echo "  跳过（文件不存在）: $f" >&2
    continue
  fi

  if grep -qF ".Language.LanguageDirection" "$path" || grep -qF ".Language.LanguageCode" "$path"; then
    sed -i \
      -e "s|\.Language\.LanguageDirection|.Language.Direction|g" \
      -e "s|\.Language\.LanguageCode|.Language.Locale|g" \
      "$path"
    echo "  已修补: $f"
  else
    echo "  已修补，跳过: $f"
  fi
done

echo "==> 补丁完成"