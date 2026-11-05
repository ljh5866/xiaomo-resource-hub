#!/usr/bin/env bash
# 让运维账号（默认 admin）不用 sudo 也能读写 data/
#
#   sudo bash deploy/fix-permissions.sh
#
# 做的事（幂等，跑多次无副作用）：
#   1. 把运维账号加进 www-data 组
#   2. data/ 归属 www-data:www-data，组可写
#   3. 目录设 setgid：以后新建的文件/子目录自动继承 www-data 组
#
# 生效需要重新登录（或 newgrp www-data），因为组关系在登录时写入进程。
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/xiaomo}"
TARGET_USER="${TARGET_USER:-${SUDO_USER:-admin}}"

if [[ $EUID -ne 0 ]]; then
  echo "请用 sudo 运行：sudo bash deploy/fix-permissions.sh"
  exit 1
fi

echo "→ 1/3 把 $TARGET_USER 加入 www-data 组"
usermod -aG www-data "$TARGET_USER"
echo "  ✓ 已加入（当前登录会话需重新登录才生效）"

echo "→ 2/3 交权 $APP_DIR/data"
chown -R www-data:www-data "$APP_DIR/data"
chmod -R g+rwX "$APP_DIR/data"
echo "  ✓ 属主 www-data，组可读写"

echo "→ 3/3 目录加 setgid，新建文件自动继承组"
find "$APP_DIR/data" -type d -exec chmod g+s {} +
echo "  ✓ 已设置"

echo ""
echo "验证（需要先 newgrp www-data 或重新登录）："
echo "  groups | grep www-data"
echo "  touch $APP_DIR/data/.perm-test && rm $APP_DIR/data/.perm-test && echo OK"
