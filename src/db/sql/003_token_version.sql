-- 003 会话版本号（改密码/封号时 +1，旧会话在服务端立即失效）
-- 已有该列时 runner 会跳过

ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;
