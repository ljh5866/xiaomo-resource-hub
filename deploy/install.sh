#!/usr/bin/env bash
# 服务器端一键安装（在 /var/www/xiaomo 目录里、代码已经 clone 好之后跑）
#
#   sudo DOMAIN=ttals.com ADMIN_EMAIL=you@example.com ADMIN_PASS='强密码' bash deploy/install.sh
#
# 做：写 .env（没有就生成随机 AUTH_SECRET）→ 装依赖 → 迁移 → 建管理员
#     → 构建 → 装 systemd → 启服务 → 配 Caddy → 本地 + 外部健康检查
#
# 幂等：重复跑不会重复建管理员，.env 已存在则不覆盖。
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASS="${ADMIN_PASS:-}"

log() { printf '\033[38;5;179m→\033[0m %s\n' "$*"; }
ok()  { printf '\033[38;5;108m✓\033[0m %s\n' "$*"; }
die() { printf '\033[38;5;203m✗\033[0m %s\n' "$*"; exit 1; }

[[ -f package.json ]] || die "请在项目根目录跑（没找到 package.json）"
[[ -n "$DOMAIN" ]] || die "缺少 DOMAIN，例如：DOMAIN=ttals.com bash deploy/install.sh"

# ---------- 0. 依赖自检 ----------
log "检查运行环境"
command -v node >/dev/null || die "没装 Node（先跑 deploy/bootstrap-ubuntu.sh）"
command -v pnpm >/dev/null || die "没装 pnpm（corepack enable）"
command -v caddy >/dev/null || die "没装 Caddy（apt install caddy）"
ok "node $(node -v) / pnpm $(pnpm -v) / caddy $(caddy version | cut -d' ' -f1)"

# ---------- 1. .env ----------
if [[ -f .env ]]; then
  ok ".env 已存在，保留不变"
else
  log "生成 .env"
  SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
SITE_URL=https://${DOMAIN}
DATABASE_URL=${APP_DIR}/data/app.db
AUTH_SECRET=${SECRET}
EOF
  ok ".env 已写入（AUTH_SECRET 随机生成）"
fi

mkdir -p data/uploads data/backups

# ---------- 2. 依赖 + 数据库 ----------
log "安装依赖（首次约 1–2 分钟）"
pnpm install --frozen-lockfile

log "迁移数据库"
pnpm db:migrate

# ---------- 3. 管理员 ----------
if [[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASS" ]]; then
  log "确保管理员账号存在：$ADMIN_EMAIL"
  pnpm user:add "$ADMIN_EMAIL" "$ADMIN_PASS" --admin
else
  log "没给 ADMIN_EMAIL/ADMIN_PASS，跳过建账号（之后可 pnpm user:add 邮箱 密码 --admin）"
fi

# ---------- 4. 构建 ----------
log "构建（2C2G 约 40–60 秒；1G 机器请改用 deploy/build-lowmem.sh）"
if [[ "$(free -m | awk '/Mem:/{print $2}')" -lt 1800 ]]; then
  NODE_OPTIONS="--max-old-space-size=1024" pnpm build
else
  pnpm build
fi

# ---------- 5. systemd ----------
log "安装 systemd 单元"
for unit in xiaomo.service xiaomo-maintenance.service xiaomo-maintenance.timer; do
  if [[ -f "deploy/$unit" ]]; then
    cp "deploy/$unit" /etc/systemd/system/
  fi
done
systemctl daemon-reload

chown -R www-data:www-data "$APP_DIR/data" "$APP_DIR/.next"
systemctl enable --now xiaomo >/dev/null 2>&1 || systemctl restart xiaomo
systemctl restart xiaomo
ok "xiaomo 已启动"

if [[ -f /etc/systemd/system/xiaomo-maintenance.timer ]]; then
  systemctl enable --now xiaomo-maintenance.timer >/dev/null 2>&1 || true
  ok "维护定时器已启用（每天 03:20 巡检 + 备份 + 清理孤儿图）"
fi

# ---------- 6. Caddy ----------
DOMAIN_FILE="deploy/Caddyfile.${DOMAIN}"
if [[ -f "$DOMAIN_FILE" ]]; then
  log "使用现成配置：$DOMAIN_FILE"
  cp "$DOMAIN_FILE" /etc/caddy/Caddyfile
elif [[ -f deploy/Caddyfile.domain ]]; then
  log "从模板生成：deploy/Caddyfile.domain（替换域名）"
  sed "s/xiaomo\.example\.com/${DOMAIN}/g" deploy/Caddyfile.domain > /etc/caddy/Caddyfile
else
  log "只配反向代理（没有现成 Caddyfile）"
  printf '%s {\n\treverse_proxy 127.0.0.1:3100\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
fi

mkdir -p /var/log/caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy
ok "Caddy 已重载"

# ---------- 7. 验收 ----------
sleep 3

log "本地健康检查"
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3100/api/health || die "服务没起来：journalctl -u xiaomo -n 50"

log "HTTPS 检查（证书签发最多等 40 秒）"
HTTPS_OK=0
for i in $(seq 1 20); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then HTTPS_OK=1; break; fi
  sleep 2
done

if [[ "$HTTPS_OK" -eq 1 ]]; then
  ok "https://${DOMAIN} 已可访问"
else
  echo "  ! HTTPS 还没通，看看日志：journalctl -u caddy -n 40 --no-pager"
  echo "    常见原因：防火墙没放 80/443、DNS 还没生效"
fi

cat <<EOF

────────────────────────────────────────
部署完成
  站点     https://${DOMAIN}
  后台     https://${DOMAIN}/login
  服务状态 systemctl status xiaomo
  访问日志 journalctl -u xiaomo -f
  Caddy   journalctl -u caddy -f
  更新     bash deploy/deploy.sh

下一步：登录后台 → 批量导入资源 → pnpm links:check
────────────────────────────────────────
EOF
