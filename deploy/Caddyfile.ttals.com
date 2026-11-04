# ttals.com · 生产配置（阿里云香港 43.103.48.5）
#
#   cp deploy/Caddyfile.ttals.com /etc/caddy/Caddyfile
#   systemctl reload caddy
#   journalctl -u caddy -f        # 看证书申请
#
# 前置条件：DNS 里 ttals.com 的 A 记录已指向 43.103.48.5，且控制台放行 80/443
#
# 关于 www.ttals.com：目前它解析到 149.104.21.x（不是这台服务器）。
# 先把 DNS 改到 43.103.48.5 再取消下面最后一段的注释，否则 Caddy 会为一个
# 打不开的域名反复申请证书，容易触发 Let's Encrypt 频率限制。

{
	log default {
		output file /var/log/caddy/xiaomo-access.log {
			roll_size 20mb
			roll_keep 5
		}
		format console
	}
}

ttals.com {
	encode zstd gzip

	# 静态资源长缓存（文件名自带哈希）
	@assets path /_next/static/* /files/*
	header @assets Cache-Control "public, max-age=31536000, immutable"

	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		X-Frame-Options SAMEORIGIN
		Permissions-Policy "geolocation=(), microphone=(), camera=()"
		-Server
	}

	reverse_proxy 127.0.0.1:3100 {
		header_up X-Real-IP {remote_host}
		health_uri /api/health
		health_interval 30s
		health_timeout 5s
	}

	# 数据库与备份不对外
	@private path /data/* /.env*
	respond @private 404
}

# ── www 跳主域：等 www 的 A 记录改到 43.103.48.5 之后再启用 ──
# www.ttals.com {
# 	redir https://ttals.com{uri} permanent
# }
