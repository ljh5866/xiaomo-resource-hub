-- GitHub 授权：存用户的 GitHub token，用来在站内直接 star 项目
CREATE TABLE IF NOT EXISTS github_accounts (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_id    TEXT    NOT NULL,
  login        TEXT    NOT NULL,
  access_token TEXT    NOT NULL,
  scopes       TEXT,
  linked_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  verified_at  INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_github_accounts_login ON github_accounts (login);
