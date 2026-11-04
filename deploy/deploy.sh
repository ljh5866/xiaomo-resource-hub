#!/usr/bin/env bash
# 一键部署 / 更新：sudo bash deploy/deploy.sh
# 前置：服务器已装 Node、pnpm、Caddy，代码在 /var/www/xiaomo
#
# 顺序：备份 → 拉代码 → 装依赖 → 迁移 → stop 服务 → 清 .next → 构建
#       → 交权 → start 服务 → 冒烟检查
#
# 为什么先 stop 再构建：2C2G 上服务占着 200MB，构建容易 OOM；
# 而且构建期间新旧 chunk 混在一起，会出现 HTML 指向不存在的 CSS（500）。
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/xiaomo}"
SERVICE="${SERVICE:-xiaomo}"

cd "$APP_DIR"

echo "→ 1/8 备份当前数据库"
node scripts/backup.mjs --keep 14 || echo "  （首次部署可忽略）"

echo "→ 2/8 拉取代码"
git pull --ff-only

echo "→ 3/8 安装依赖"
pnpm install --frozen-lockfile

echo "→ 4/8 迁移数据库"
pnpm db:migrate

echo "→ 5/8 停服务（释放内存，避免构建 OOM 与 chunk 混用）"
sudo systemctl stop "$SERVICE" || true

echo "→ 6/8 清理旧构建产物并构建"
rm -rf .next
pnpm build

echo "→ 7/8 交权并启动"
sudo chown -R www-data:www-data .next data
sudo systemctl start "$SERVICE"
sleep 3

echo "→ 8/8 冒烟检查（页面 / 静态资源 / 健康检查 / 鉴权拦截）"
node scripts/smoke.mjs

echo "✓ 部署完成：$(git log --oneline -1)"
