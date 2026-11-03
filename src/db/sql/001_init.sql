-- 001 初始结构（与 src/db/schema.ts 对齐；全部 IF NOT EXISTS，可反复执行）

CREATE TABLE IF NOT EXISTS categories (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'folder',
  sort_order integer NOT NULL DEFAULT 0,
  is_visible integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS resources (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  code text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  summary text,
  content_md text,
  category_id integer NOT NULL REFERENCES categories(id),
  kind text NOT NULL DEFAULT 'other',
  platforms text NOT NULL DEFAULT '[]',
  version text,
  size_label text,
  language text DEFAULT 'zh-CN',
  license_label text,
  cover_url text,
  cover_blur text,
  source_url text,
  source_note text,
  verified_at integer,
  status text NOT NULL DEFAULT 'draft',
  is_featured integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  download_count integer NOT NULL DEFAULT 0,
  favorite_count integer NOT NULL DEFAULT 0,
  seo_title text,
  seo_desc text,
  published_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch()),
  updated_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_resources_cat_status ON resources (category_id, status, published_at);
CREATE INDEX IF NOT EXISTS idx_resources_updated ON resources (updated_at);
CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources (is_featured);

CREATE TABLE IF NOT EXISTS resource_links (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  provider text NOT NULL,
  url text NOT NULL,
  url_hash text NOT NULL,
  extract_code text,
  label text,
  is_primary integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unknown',
  checked_at integer,
  fail_count integer NOT NULL DEFAULT 0,
  last_error text,
  click_count integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_link_resource_hash ON resource_links (resource_id, url_hash);
CREATE INDEX IF NOT EXISTS idx_links_status ON resource_links (status, checked_at);

CREATE TABLE IF NOT EXISTS tags (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  use_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE TABLE IF NOT EXISTS users (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user',
  created_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS download_events (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  link_id integer REFERENCES resource_links(id) ON DELETE SET NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text,
  ua_family text,
  referer_host text,
  created_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_downloads_resource ON download_events (resource_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  link_id integer REFERENCES resource_links(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'link-dead',
  contact text,
  status text NOT NULL DEFAULT 'open',
  created_at integer NOT NULL DEFAULT (unixepoch()),
  handled_at integer
);
