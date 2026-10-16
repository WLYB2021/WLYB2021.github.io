# 常用命令。 serve 首次运行会自动克隆主题并打补丁。
.PHONY: serve build drafts clean

serve:
	./scripts/dev.sh

# 列出所有草稿（draft: true）——判断"哪些还没发"的唯一视图
drafts:
	hugo list drafts

build:
	hugo --minify --gc

clean:
	rm -rf public resources
