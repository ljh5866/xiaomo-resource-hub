#!/usr/bin/env bash
# 低内存机型（1G）构建辅助：确保 swap 存在 → 限堆 → 构建 → 报告内存
#
#   bash deploy/build-lowmem.sh
#
# Next 构建峰值 1.2–1.8G，1G 机器必须靠 swap 顶住；这个脚本把最容易踩的两件事做掉：
#   1. 没有 swap 就先建 2G
#   2. 用 NODE_OPTIONS 限制 V8 堆，避免 OOM killer 直接杀掉构建进程
set -euo pipefail

cd "$(dirname "$0")/.."

SWAP_MB="${SWAP_MB:-2048}"
HEAP_MB="${HEAP_MB:-1024}"

log() { printf '\033[38;5;179m→\033[0m %s\n' "$*"; }

# ---------- swap ----------
if swapon --show | grep -q '/swapfile'; then
  log "swap 已存在：$(free -h | awk '/Swap:/{print $2}')"
else
  if [[ $EUID -eq 0 ]]; then
    log "创建 ${SWAP_MB}M swap"
    fallocate -l "${SWAP_MB}M" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    echo "  ! 没有 swap 且非 root，跳过（建议先 sudo bash deploy/bootstrap-ubuntu.sh）"
  fi
fi

# ---------- 构建 ----------
log "内存基线：$(free -m | awk '/Mem:/{print $2"MB 总 / "$7"MB 可用"}')  swap $(free -m | awk '/Swap:/{print $2"MB"}')"
log "开始构建（堆上限 ${HEAP_MB}MB，1G 机器约 2–4 分钟）"

NODE_OPTIONS="--max-old-space-size=${HEAP_MB}" pnpm build

log "构建完成，.next 大小：$(du -sh .next | cut -f1)"
log "峰值内存参考：$(free -m | awk '/Mem:/{print $3"MB 已用"}')"
