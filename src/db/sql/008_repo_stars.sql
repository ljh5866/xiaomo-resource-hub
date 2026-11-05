-- GitHub 仓库 star 快照：用来算「本周热门」（一周内 star 增长排行）
CREATE TABLE IF NOT EXISTS repo_stars (
  resource_id INTEGER NOT NULL,
  day         TEXT    NOT NULL,           -- YYYY-MM-DD
  stars       INTEGER NOT NULL,
  captured_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (resource_id, day)
);

CREATE INDEX IF NOT EXISTS idx_repo_stars_day ON repo_stars (day);
