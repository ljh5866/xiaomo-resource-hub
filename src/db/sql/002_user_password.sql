-- 002 账号密码（NextAuth Credentials 用）
-- 已有该列时 runner 会跳过（duplicate column 视为已应用）

ALTER TABLE users ADD COLUMN password_hash text;
