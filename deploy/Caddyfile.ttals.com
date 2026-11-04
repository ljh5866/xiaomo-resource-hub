# ttals.com · 生产配置（阿里云香港 43.103.48.5）
#
#   cp deploy/Caddyfile.ttals.com /etc/caddy/Caddyfile
#   systemctl reload caddy
#   journalctl -u caddy -f
#
# 两个站点块：
#   ttals.com        前台
#   admin.ttals.com  后台（转发到同一个 Next 进程，由 middleware 按 Host 分流）
#
# 前置：
#   1. DNS：ttals.com / www.ttals.com / admin.ttals.com 都 A 记录到 43.103.48.5
#   2. 控制台放行 80/443
#   3. .env 里设 ADMIN_HOST=admin.ttals.com 与 SITE_HOST=ttals.com

{
	log default {
		output file /var/log/caddy/xiaomo-access.log {
			roll_size 20mb
			roll_keep 5
		}
		format console
	}
}

# ───────── 前台 ─────────
ttals.com {
	encode zstd gzip

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

	@private path /data/* /.env*
	respond @private 404
}

# ───────── 后台（子域名） ─────────
admin.ttals.com {
	encode zstd gzip

	# 后台页面一律不缓存，避免改了看到旧的
	header {
		Cache-Control "no-store"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy no-referrer
		X-Robots-Tag "noindex, nofollow"
		-Server
	}

	reverse_proxy 127.0.0.1:3100 {
		header_up X-Real-IP {remote_host}
		health_uri /api/health
		health_interval 30s
		health_timeout 5s
	}
}

# ───────── www 跳主域 ─────────
www.ttals.com {
	redir https://ttals.com{uri} permanent
}
