-- 006 · 邮箱验证码（注册 / 未来找回密码共用）
CREATE TABLE IF NOT EXISTS email_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  -- 只存哈希：库泄露也拿不到验证码
  code_hash  TEXT    NOT NULL,
  purpose    TEXT    NOT NULL DEFAULT 'register',
  -- 有效期（unix 秒）
  expires_at INTEGER NOT NULL,
  -- 已尝试次数，超过 5 次直接作废
  attempts   INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes (email, purpose, created_at);
CREATE INDEX IF NOT EXISTS idx_email_codes_created ON email_codes (created_at);
