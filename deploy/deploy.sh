#!/usr/bin/env bash
# 一键部署 / 更新：sudo bash deploy/deploy.sh
#
# 目标：能在 2C2G 的机器上 40–70 秒跑完（首次装依赖除外）
#
# 省时间的三件事：
#   1. pnpm-lock.yaml 没变就跳过 pnpm install（省 20–60 秒）
#   2. 构建前不删整个 .next，只删 server/static，保留 .next/cache（编译缓存）
#   3. 每一步打印耗时，卡在哪一眼看得出
#
# 为什么之前要 rm -rf .next：构建时服务还在跑，新旧 chunk 混用会导致 CSS 500。
# 现在改成"先停服务再构建"，就不会有混用，缓存可以放心留。
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/xiaomo}"
SERVICE="${SERVICE:-xiaomo}"
STATE=".deploy-state"

cd "$APP_DIR"

T0=$(date +%s)
step() { printf '\n\033[38;5;179m→ %s\033[0m\n' "$*"; }
done_step() { printf '\033[38;5;108m  ✓ %s（%ss）\033[0m\n' "$1" "$2"; }
since() { echo $(( $(date +%s) - $1 )); }

# ── 1. 备份 ──
step "1/7 备份数据库"
S=$(date +%s)
node scripts/backup.mjs --keep 14 >/dev/null 2>&1 || echo "  （首次部署可忽略）"
done_step "备份" "$(since $S)"

# ── 2. 拉代码 ──
step "2/7 拉取代码"
S=$(date +%s)
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)
done_step "代码 $(echo "$BEFORE" | cut -c1-7) → $(echo "$AFTER" | cut -c1-7)" "$(since $S)"

# ── 3. 依赖（锁文件没变就跳过） ──
step "3/7 安装依赖"
S=$(date +%s)
LOCK_HASH=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
LAST_HASH=$(cat "$STATE" 2>/dev/null || echo "")
if [[ "$LOCK_HASH" == "$LAST_HASH" && -d node_modules ]]; then
  done_step "依赖无变化，跳过" "$(since $S)"
else
  pnpm install --frozen-lockfile
  echo "$LOCK_HASH" > "$STATE"
  done_step "依赖已安装" "$(since $S)"
fi

# ── 4. 迁移 ──
step "4/7 迁移数据库"
S=$(date +%s)
pnpm db:migrate
done_step "迁移" "$(since $S)"

# ── 5. 停服务 + 构建 ──
step "5/7 停服务并构建（保留编译缓存）"
S=$(date +%s)
sudo systemctl stop "$SERVICE" || true
rm -rf .next/server .next/static
pnpm build
done_step "构建" "$(since $S)"

# ── 6. 交权 + 启动 ──
step "6/7 交权并启动"
S=$(date +%s)
sudo chown -R www-data:www-data .next data
sudo systemctl start "$SERVICE"
sleep 2
done_step "启动" "$(since $S)"

# ── 7. 冒烟 ──
step "7/7 冒烟检查"
S=$(date +%s)
node scripts/smoke.mjs
done_step "冒烟" "$(since $S)"

printf '\n\033[38;5;108m✓ 部署完成（总耗时 %ss）：%s\033[0m\n' "$(since $T0)" "$(git log --oneline -1)"
