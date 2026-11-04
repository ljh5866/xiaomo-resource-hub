-- 005 · 用户状态：注册系统的开关位
-- active  正常
-- pending 待审核（后台可放行）
-- banned  封禁（无法登录，已有会话下次校验时失效）
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- 统计/筛选用
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);
