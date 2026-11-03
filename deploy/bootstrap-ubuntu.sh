#!/usr/bin/env bash
# 阿里云香港 · Ubuntu 24.04 初始化脚本
#
#   bash bootstrap-ubuntu.sh                     # 只装环境（安全）
#   bash bootstrap-ubuntu.sh --harden            # 额外：建 deploy 用户 + 禁密码登录 + ufw
#
# 做六件事：时区 → swap → 中文字体 → Node 24 + pnpm → Caddy → 目录骨架
# 不碰你的代码，也不改 SSH（除非加 --harden）。
set -euo pipefail

HARDEN=0
[[ "${1:-}" == "--harden" ]] && HARDEN=1

log() { printf '\033[38;5;179m→\033[0m %s\n' "$*"; }
ok()  { printf '\033[38;5;108m✓\033[0m %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "请用 root 跑：sudo bash $0"; exit 1; }

# ---------- 1. 时区 ----------
log "设置时区 Asia/Shanghai"
timedatectl set-timezone Asia/Shanghai
ok "$(date '+%F %T %Z')"

# ---------- 2. swap（1.5G 内存的兜底，构建救命） ----------
if ! swapon --show | grep -q '/swapfile'; then
  log "创建 2G swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "swap 已启用：$(free -h | awk '/Swap:/{print $2}')"
else
  ok "swap 已存在，跳过"
fi

# ---------- 3. 基础依赖 + 中文字体 ----------
log "安装基础依赖与中文字体（分享图依赖）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git build-essential ca-certificates ufw \
  fonts-noto-cjk locales >/dev/null
locale-gen zh_CN.UTF-8 >/dev/null 2>&1 || true
ok "依赖与 fonts-noto-cjk 就绪"

# ---------- 4. Node 24 + pnpm ----------
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v24" ]]; then
  log "安装 Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v)"

if ! command -v pnpm >/dev/null; then
  log "启用 pnpm 10"
  corepack enable
  corepack prepare pnpm@10 --activate >/dev/null
fi
ok "pnpm $(pnpm -v)"

# ---------- 5. Caddy（自动 HTTPS） ----------
if ! command -v caddy >/dev/null; then
  log "安装 Caddy"
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
ok "caddy $(caddy version | cut -d' ' -f1)"

# ---------- 6. 目录骨架 ----------
log "建立站点目录 /var/www/xiaomo"
mkdir -p /var/www/xiaomo/data/{uploads,backups}
ok "目录就绪"

# ---------- 可选：安全加固 ----------
if [[ $HARDEN -eq 1 ]]; then
  log "安全加固：建 deploy 用户 + 禁密码登录 + ufw"
  id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy

  # 把 root 的 authorized_keys 复制给 deploy（确保你先放了公钥！）
  if [[ -f /root/.ssh/authorized_keys ]]; then
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys
    sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
    ok "已禁用密码登录（务必先确认 deploy 能登！）"
  else
    echo "  ! 没找到 /root/.ssh/authorized_keys，跳过禁用密码登录（否则会把自己锁在外面）"
  fi

  ufw allow 22,80,443/tcp >/dev/null
  ufw --force enable >/dev/null
  ok "ufw 已开启：$(ufw status | head -1)"
fi

# ---------- 汇总 ----------
cat <<EOF

────────────────────────────────────────
环境就绪
  node   $(node -v)
  pnpm   $(pnpm -v)
  caddy  $(caddy version | cut -d' ' -f1)
  内存   $(free -h | awk '/Mem:/{print $2}')   swap $(free -h | awk '/Swap:/{print $2}')
  磁盘   $(df -h / | awk 'NR==2{print $4" 可用"}')
  字体   $(fc-list :lang=zh | wc -l) 个中文字体

下一步：
  1. 把代码放到 /var/www/xiaomo（git clone 或 rsync）
  2. cp .env.example .env  → 填 SITE_URL（https://你的域名）与 AUTH_SECRET
  3. pnpm install --frozen-lockfile && pnpm db:migrate
  4. pnpm user:add 你的邮箱 强密码 --admin
  5. pnpm build
  6. cp deploy/xiaomo.service /etc/systemd/system/ && systemctl daemon-reload
     systemctl enable --now xiaomo
  7. 改 /etc/caddy/Caddyfile 里的域名 → systemctl reload caddy
  8. curl -fsS https://你的域名/api/health
────────────────────────────────────────
EOF
