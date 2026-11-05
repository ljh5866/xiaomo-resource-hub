-- GitHub Trending 周榜：本周 star 增长最多的项目
CREATE TABLE IF NOT EXISTS trending_repos (
  day         TEXT    NOT NULL,           -- YYYY-MM-DD
  rank        INTEGER NOT NULL,
  full_name   TEXT    NOT NULL,           -- owner/repo
  url         TEXT    NOT NULL,
  stars_week  INTEGER,                    -- 本周新增 star
  stars_total INTEGER,                    -- 总 star
  language    TEXT,
  description TEXT,
  PRIMARY KEY (day, rank)
);

CREATE INDEX IF NOT EXISTS idx_trending_day ON trending_repos (day);
