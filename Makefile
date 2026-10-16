# 常用命令。 serve 首次运行会自动克隆主题并打补丁。
.PHONY: serve build drafts lint clean

# 校验脚本用的解释器。Windows 上没有 python3 时可 make lint PYTHON=python
PYTHON ?= python3

serve:
	./scripts/dev.sh

# 列出所有草稿（draft: true）——判断"哪些还没发"的唯一视图
drafts:
	hugo list drafts

# 正文排版校验（空行 / 行尾空格 / 围栏）——规则见 docs/typography.md
lint:
	$(PYTHON) scripts/lint-prose.py

build:
	hugo --minify --gc

clean:
	rm -rf public resources
