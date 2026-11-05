#!/usr/bin/env bash
# 一键部署 / 更新：sudo bash deploy/deploy.sh
#
# 设计目标：
#   1. 快 —— 锁文件没变跳过 install；保留 .next/cache；每步打印耗时
#   2. 挂了能自己收场 —— 任何一步失败，自动尝试把服务拉起来（哪怕还是旧版本），
#      绝不留"站点 502 + systemd 重启 45 次"这种局面
#   3. 内存不够自动降级 —— 构建失败自动用 1GB 堆重试一次
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/xiaomo}"
SERVICE="${SERVICE:-xiaomo}"
STATE=".deploy-state"

cd "$APP_DIR"

T0=$(date +%s)
step() { printf '\n\033[38;5;179m→ %s\033[0m\n' "$*"; }
ok_step() { printf '\033[38;5;108m  ✓ %s（%ss）\033[0m\n' "$1" "$2"; }
since() { echo $(( $(date +%s) - $1 )); }

# ─────────── 失败兜底 ───────────
# 不管因为什么退出，只要服务没在跑，就尝试用现有的 .next 拉起来。
# 旧构建还能用的话，站点至少是活的（版本旧一点，好过 502）。
on_exit() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    printf '\n\033[38;5;203m✗ 部署失败（exit %s）\033[0m\n' "$code"
    if systemctl is-active --quiet "$SERVICE"; then
      printf '  服务仍在运行（旧版本），站点未中断\n'
    else
      printf '  → 尝试用现有构建拉起服务，避免长时间 502\n'
      if sudo systemctl start "$SERVICE" 2>/dev/null; then
        sleep 2
        if curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1; then
          printf '  ✓ 站点已恢复（旧版本），修复后再跑一次 deploy.sh\n'
        else
          printf '  ！服务起来了但健康检查不通过，看：sudo journalctl -u %s -n 30\n' "$SERVICE"
        fi
      else
        printf '  ！服务启动失败，看：sudo journalctl -u %s -n 30\n' "$SERVICE"
      fi
    fi
    printf '\n  部署日志：/tmp/deploy.log\n'
  fi
}
trap on_exit EXIT

exec > >(tee /tmp/deploy.log) 2>&1

# ─────────── 1. 备份 ───────────
step "1/7 备份数据库"
S=$(date +%s)
node scripts/backup.mjs --keep 14 >/dev/null 2>&1 || echo "  （首次部署可忽略）"
ok_step "备份" "$(since $S)"

# ─────────── 2. 拉代码 ───────────
step "2/7 拉取代码"
S=$(date +%s)
BEFORE=$(git rev-parse --short HEAD)
git pull --ff-only
AFTER=$(git rev-parse --short HEAD)
ok_step "代码 $BEFORE → $AFTER" "$(since $S)"

# ─────────── 3. 依赖 ───────────
step "3/7 安装依赖"
S=$(date +%s)
LOCK_HASH=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
LAST_HASH=$(cat "$STATE" 2>/dev/null || echo "")
if [[ "$LOCK_HASH" == "$LAST_HASH" && -d node_modules ]]; then
  ok_step "依赖无变化，跳过" "$(since $S)"
else
  pnpm install --frozen-lockfile
  echo "$LOCK_HASH" > "$STATE"
  ok_step "依赖已安装" "$(since $S)"
fi

# ─────────── 4. 迁移 ───────────
step "4/7 迁移数据库"
S=$(date +%s)
pnpm db:migrate
ok_step "迁移" "$(since $S)"

# ─────────── 4.5 让 systemd 一定读到 .env ───────────
# Next 的 env 加载在部分构建模式下不可靠，而 SMTP 这类只在运行时用的变量
# 必须确保进程真的拿到。这里给 unit 补一行 EnvironmentFile（幂等）。
UNIT="/etc/systemd/system/${SERVICE}.service"
if [[ -f "$UNIT" ]] && ! sudo grep -q "^EnvironmentFile=" "$UNIT"; then
  sudo sed -i "/^\[Service\]/a EnvironmentFile=-${APP_DIR}/.env" "$UNIT"
  sudo systemctl daemon-reload
  printf '  ✓ 已给 %s 补上 EnvironmentFile\n' "$UNIT"
fi

# ─────────── 5. 停服务 + 构建 ───────────
step "5/7 停服务并构建"
S=$(date +%s)
sudo systemctl stop "$SERVICE" || true
rm -rf .next/server .next/static

build_ok=0
if pnpm build; then
  build_ok=1
else
  printf '\n\033[38;5;179m→ 构建失败，改用低内存模式重试（2G 机器常见 OOM）\033[0m\n'
  rm -rf .next/server .next/static
  if NODE_OPTIONS="--max-old-space-size=1024" pnpm build; then
    build_ok=1
  fi
fi

if [[ $build_ok -ne 1 ]]; then
  echo "  ！两次构建都失败。若日志里有 Killed/heap out of memory，先加 swap 再试："
  echo "    sudo fallocate -l 2G /swapfile2 && sudo chmod 600 /swapfile2"
  echo "    sudo mkswap /swapfile2 && sudo swapon /swapfile2"
  exit 1
fi
ok_step "构建" "$(since $S)"

# ─────────── 6. 交权 + 启动 ───────────
step "6/7 交权并启动"
S=$(date +%s)
sudo chown -R www-data:www-data .next data
sudo systemctl start "$SERVICE"
sleep 3
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "  ！服务没起来，最近日志："
  sudo journalctl -u "$SERVICE" -n 15 --no-pager || true
  exit 1
fi
ok_step "启动" "$(since $S)"

# ─────────── 7. 冒烟 ───────────
step "7/7 冒烟检查"
S=$(date +%s)
node scripts/smoke.mjs
ok_step "冒烟" "$(since $S)"

printf '\n\033[38;5;108m✓ 部署完成（总耗时 %ss）：%s\033[0m\n' "$(since $T0)" "$(git log --oneline -1)"
