#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
正文排版校验 —— 规则见 docs/typography.md

校验的是「空行」这一层（Markdown 语法必需），不是视觉间距（那由 CSS 管）：

  1. 连续 2 个及以上空行          → 多余（N 个空行渲染结果与 1 个相同）
  2. 行尾多余空格                 → 多余（代码块内不查）
  3. 标题前没有空行               → 缺分隔
  4. 列表前没有空行               → 列表会被并进上一段
  5. 列表项之间有空行             → 会变成 loose list（行距突变）
  6. 代码围栏前后没有空行 / 未闭合

用法：
    python3 scripts/lint-prose.py             # 校验 content/posts/*.md
    python3 scripts/lint-prose.py a.md b.md   # 校验指定文件

退出码：0 = 通过；1 = 有问题。
"""
import re
import sys
import pathlib

HEADING = re.compile(r'^#{1,6}\s')
LIST = re.compile(r'^(?:[-*+]|\d+[.)])\s')          # 顶格列表项
FENCE = re.compile(r'^(`{3,}|~{3,})')


def body_start(lines):
    """front matter（首尾 ---）之后正文的第一行下标；无 front matter 则 0。"""
    if lines and lines[0].strip() == '---':
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                return i + 1
    return 0


def lint(path):
    errs = []
    lines = pathlib.Path(path).read_text(encoding='utf-8').split('\n')
    start = body_start(lines)
    in_fence = False
    fence_line = 0
    blank_run = 0
    prev_nonblank = -1          # 上一个非空行的下标（正文内）
    i = start
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        m = FENCE.match(raw)
        if m and not in_fence:
            # 围栏开始：前一行须为空行，或正文起点
            if i > start and lines[i - 1].strip() != '':
                errs.append((i + 1, '代码块开始前缺空行'))
            in_fence = True
            fence_line = i + 1
            blank_run = 0
            i += 1
            continue
        if m and in_fence:
            in_fence = False
            # 围栏结束：后一行须为空行，或文件末尾
            if i + 1 < len(lines) and lines[i + 1].strip() != '':
                errs.append((i + 1, '代码块结束后缺空行'))
            blank_run = 0
            i += 1
            continue

        if in_fence:
            i += 1
            continue                    # 代码块内部不校验

        if stripped == '':
            blank_run += 1
            if blank_run >= 2:
                errs.append((i + 1, '连续空行（多于 1 个）'))
            i += 1
            continue

        # —— 以下仅正文（围栏之外、非空行）——
        if raw != raw.rstrip():
            errs.append((i + 1, '行尾有多余空格'))

        prev = lines[i - 1] if i > start else ''

        if HEADING.match(raw) and prev.strip() != '':
            errs.append((i + 1, '标题前缺空行'))

        if LIST.match(raw):
            if prev.strip() != '' and not prev.startswith((' ', '\t')) \
               and not LIST.match(prev) and not HEADING.match(prev):
                errs.append((i + 1, '列表前缺空行'))
            # 与上一个非空行之间隔着空行、且两者同为顶格列表项 → loose list
            if prev.strip() == '' and prev_nonblank >= 0 \
               and LIST.match(lines[prev_nonblank]):
                errs.append((i + 1, '列表项之间有空行（会变成 loose list）'))

        blank_run = 0
        prev_nonblank = i
        i += 1

    if in_fence:
        errs.append((fence_line, '代码围栏未闭合'))
    return errs


def main(argv):
    paths = [a for a in argv[1:] if not a.startswith('-')]
    if paths:
        files = [pathlib.Path(p) for p in paths]
    else:
        files = sorted(pathlib.Path('content/posts').glob('*.md'))

    total = 0
    for f in files:
        try:
            errs = lint(f)
        except FileNotFoundError:
            print(f"找不到文件：{f}")
            return 2
        if errs:
            total += len(errs)
            print(f"\n{f}")
            for ln, msg in errs:
                print(f"  第 {ln} 行：{msg}")

    print()
    if total:
        print(f"✗ 发现 {total} 个问题（规则见 docs/typography.md）")
        return 1
    print(f"✓ 排版检查通过（{len(files)} 个文件）")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
