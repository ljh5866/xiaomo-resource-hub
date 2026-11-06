# ttals.com - production Caddy config (Alibaba Cloud HK, 43.103.48.5)
#
#   sudo cp deploy/Caddyfile.ttals.com /etc/caddy/Caddyfile
#   sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
#   sudo systemctl reload caddy
#
# Site blocks:
#   ttals.com         frontend
#   admin.ttals.com   admin console (same Next process, routed by middleware Host)
#   www.ttals.com     301 -> apex
#
# Prerequisites:
#   1. DNS A records for ttals.com / www.ttals.com / admin.ttals.com -> 43.103.48.5
#   2. Firewall allows 80 and 443
#   3. .env sets ADMIN_HOST=admin.ttals.com and SITE_HOST=ttals.com
#
# NOTE: keep this file pure ASCII. Non-ASCII comments have broken caddy parse before.

{
	log default {
		output file /var/log/caddy/xiaomo-access.log {
			roll_size 20mb
			roll_keep 5
		}
		format console
	}
}

# ---------- frontend ----------
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

	# Covers / avatars are served straight from disk, no Node round trip.
	# /files/covers/a.webp -> /var/www/xiaomo/data/uploads/covers/a.webp
	handle_path /files/* {
		root * /var/www/xiaomo/data/uploads
		file_server
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

# ---------- admin console (subdomain) ----------
admin.ttals.com {
	encode zstd gzip

	# Admin pages must never be cached; static files keep the immutable header.
	@html not path /files/* /_next/static/*
	header @html Cache-Control "no-store"

	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy no-referrer
		X-Robots-Tag "noindex, nofollow"
		-Server
	}

	handle_path /files/* {
		root * /var/www/xiaomo/data/uploads
		file_server
	}

	reverse_proxy 127.0.0.1:3100 {
		header_up X-Real-IP {remote_host}
		health_uri /api/health
		health_interval 30s
		health_timeout 5s
	}
}

# ---------- www -> apex ----------
www.ttals.com {
	redir https://ttals.com{uri} permanent
}
