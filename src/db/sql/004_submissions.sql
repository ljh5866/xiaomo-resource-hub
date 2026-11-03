-- 004 投稿（游客推荐资源，后台审后再入库）

CREATE TABLE IF NOT EXISTS submissions (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  category_slug text,
  provider text,
  note text,
  contact text,
  status text NOT NULL DEFAULT 'pending',
  created_at integer NOT NULL DEFAULT (unixepoch()),
  handled_at integer
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status, created_at);
