-- 012: 用户自己的网盘凭证（一期只接夸克）
-- 只存密文：AES-256-GCM，密钥由 AUTH_SECRET 派生；解绑即物理删除。
CREATE TABLE IF NOT EXISTS user_pan_credentials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL,
  secret_enc  TEXT    NOT NULL,
  /** 绑定时的账号昵称，只用于页面展示 */
  nickname    TEXT,
  status      TEXT    NOT NULL DEFAULT 'active',
  last_error  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pancred_user_provider
  ON user_pan_credentials (user_id, provider);
