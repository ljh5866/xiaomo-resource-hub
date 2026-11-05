# 25 · 从 Supabase 迁移用户

> 日期：2026-11-05 ｜ 状态：导入脚本与 bcrypt 兼容已就绪并本地验证

---

## 一、为什么需要特别处理

Supabase 的密码用 **bcrypt**（`$2a$10$...`），本站新密码用 **scrypt**（`scrypt$N$salt$hash`）。
直接导过来，用户会全部登录失败——因为校验算法对不上。

方案：**兼容校验 + 登录时自动升级**

1. `verifyPassword` 先看前缀：`$2a$/$2b$/$2y$` → 用 bcrypt 校验；`scrypt$` → 用 scrypt
2. 校验成功且是旧格式 → 就地改写成 scrypt
3. 用户完全无感，下次登录（或本次登录后）库里已是新格式

好处是**不用强制所有人重设密码**，也不用给每个人发重置邮件。

---

## 二、导出 Supabase 用户

在 Supabase → SQL Editor 跑：

```sql
select
  u.id::text            as id,
  u.email,
  u.encrypted_password  as password_hash,
  u.created_at,
  u.raw_user_meta_data  as meta
from auth.users u
order by u.created_at;
```

结果右上角 **Export → JSON**（推荐）或 CSV。

> ⚠️ 这份文件里有密码哈希，**不要发到聊天、不要提交进 git**。
> 直接放到服务器 `/var/www/xiaomo/data/import/supabase-users.json`（这个目录已在 .gitignore 里）。

如果没有权限查 `auth.users`，也可以在 Dashboard → Authentication → Users 逐页导出邮箱（那样拿不到密码，只能走"邮箱验证码重置密码"）。

---

## 三、导入

```bash
cd /var/www/xiaomo

# 先预演：只统计，不写库
node scripts/import-supabase-users.mjs data/import/supabase-users.json --dry

# 确认无误再正式导入
node scripts/import-supabase-users.mjs data/import/supabase-users.json
```

输出示例：

```
读取 128 行 → 有效 126 条
已导入：126
邮箱已存在跳过：2
  adminljh@ttals.com, test@qq.com
无效跳过：0

✓ 完成。这些用户可以直接用原密码登录，首次登录后哈希会自动升级为 scrypt。
```

规则：

| 情况 | 处理 |
|---|---|
| 邮箱格式不对 | 跳过并列出来 |
| 密码哈希不是 bcrypt/scrypt | 跳过并列出来 |
| 文件里重复 | 只留第一条 |
| 库里已存在同邮箱 | 跳过，**不覆盖**现有账号 |
| 昵称 | 取 `raw_user_meta_data.name` 或 `full_name`，没有就用邮箱前缀 |

role 统一 `user`，status 统一 `active`，created_at 保留 Supabase 的原始注册时间（这样"注册时间"排序不会乱）。

---

## 四、验证

挑一个老用户，用**他在原站的密码**登录：

- 能进 → 说明 bcrypt 兼容生效
- 查库确认已升级：

```bash
sudo node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/app.db');console.log(d.prepare(\"select email,substr(password_hash,1,7) p from users limit 5\").all())"
```

第一次登录过的那个用户会显示 `scrypt$`，没登录过的还是 `$2b$10$`。

---

## 五、踩过的坑

### bcryptjs 在 Next 打包后 `compareSync` 变成 undefined

现象：Node 里直接跑没问题，但线上所有 bcrypt 用户登录失败，且没有报错——因为 `verifyPassword` 的 `try/catch` 把 `TypeError` 吞了，返回 false。

原因：bcryptjs 是 CJS，ESM 里 `import bcrypt from "bcryptjs"` 在 Next 打包后可能得到 `{ default: {...} }`，`bcrypt.compareSync` 就是 undefined。

修法：统一解一层，并在 `typeof !== "function"` 时打日志，不再静默失败。

```ts
const bcrypt = (bcryptNS.default ?? bcryptNS) as { compareSync: ... };
```

**教训**：`try/catch` 里静默返回 false 的校验函数，出问题时不报错、只表现为"密码全错"，极难排查。

---

## 五之一、运维账号权限（避免每条命令都 sudo）

data/ 归 www-data 所有，管理员账号默认写不进去。一次配置，之后 
ode scripts/... 都不用 sudo：

```bash
sudo bash /var/www/xiaomo/deploy/fix-permissions.sh
newgrp www-data          # 或重新登录 SSH 让组关系生效
```

验证：

```bash
groups | grep www-data
touch /var/www/xiaomo/data/.t && rm /var/www/xiaomo/data/.t && echo OK
```

原理：把 admin 加进 www-data 组 + data/ 组可写 + 目录 setgid（新建文件自动继承组）。

## 六、还没做的

| # | 项 | 说明 |
|---|---|---|
| 1 | 导入 Supabase profiles | 如果你有 `public.profiles`（头像、简介），要单独导，字段映射需确认 |
| 2 | 邮箱验证状态 | Supabase 有 `email_confirmed_at`，可以映射成 status，目前统一 active |
| 3 | 批量重置密码 | 对拿不到哈希的用户，可用邮箱验证码重置（复用 006 的 `purpose='reset'`） |
