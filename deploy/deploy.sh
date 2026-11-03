#!/usr/bin/env bash
# 一键部署 / 更新：deploy/deploy.sh
# 前置：服务器已装 Node 20+、pnpm、Caddy，代码在 /var/www/xiaomo
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/xiaomo}"
SERVICE="${SERVICE:-xiaomo}"

cd "$APP_DIR"

echo "→ 1/6 备份当前数据库"
node scripts/backup.mjs --keep 14 || echo "  （首次部署可忽略）"

echo "→ 2/6 拉取代码"
git pull --ff-only

echo "→ 3/6 安装依赖"
pnpm install --frozen-lockfile

echo "→ 4/6 迁移数据库"
pnpm db:migrate

echo "→ 5/6 构建"
pnpm build

echo "→ 6/6 重启服务"
sudo systemctl restart "$SERVICE"
sleep 2
curl -fsS http://127.0.0.1:3100/api/health && echo "" && echo "✓ 部署完成"
