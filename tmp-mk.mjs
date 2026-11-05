import bcrypt from "bcryptjs";
const hash = bcrypt.hashSync("OldPass123", 10);
const rows = [
  { id: "1111", email: "old1@example.com", password_hash: hash, created_at: "2024-05-01T10:00:00Z", meta: { name: "\u8001\u7528\u62371" } },
  { id: "2222", email: "old2@example.com", password_hash: hash, created_at: "2024-06-02T10:00:00Z", meta: null },
  { id: "3333", email: "bad-email", password_hash: hash, created_at: "2024-06-02T10:00:00Z", meta: null },
];
import fs from "node:fs";
fs.writeFileSync("tmp-supabase-users.json", JSON.stringify(rows, null, 2));
console.log("已生成模拟导出，bcrypt 样例:", hash.slice(0, 12) + "...");
