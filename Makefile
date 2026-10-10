# 常用命令。 serve 首次运行会自动克隆主题并打补丁。
.PHONY: serve build clean

serve:
	./scripts/dev.sh

build:
	hugo --minify --gc

clean:
	rm -rf public resources
