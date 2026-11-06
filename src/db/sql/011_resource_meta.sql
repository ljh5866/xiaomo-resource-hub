-- 011: 资源扩展信息（TouchGal 等来源的结构化游戏信息）
-- 以 JSON 文本存放，避免为不同来源反复加列；前台按需渲染成信息表。
ALTER TABLE resources ADD COLUMN meta_json TEXT;
