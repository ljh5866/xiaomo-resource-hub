# 31 · 用户如何获取网盘 Cookie

> 面向**站点访客**的操作指引，也是 `/me/pan` 页面文案的来源。
> 结论先行：**只有电脑浏览器能导，手机 App 做不到；只复制 cookie 行或整段 cURL，两种都行。**

## 为什么需要 Cookie

站内「解析 / 下载」要替你把分享里的文件转存到你自己的网盘，再取下载直链。
这需要你的账号登录态，而夸克只认 Cookie。

- Cookie **加密**存在服务器（AES-256-GCM），只用于这两步操作
- 随时可在 `/me/pan` 点「解除绑定」物理删除
- 建议用**小号**：每次下载都会往这个账号转存一份文件

## 方式一：Copy as cURL（推荐，最不容易出错）

1. 电脑浏览器打开 <https://pan.quark.cn>，登录你的账号
2. 按 `F12` → 切到 **Network（网络）** 标签
3. 按 `F5` 刷新页面，等请求列表出现内容
4. **右键任意一条 `pan.quark.cn` 的请求** → `Copy` → `Copy as cURL`（Edge/Chrome 里可能叫 `Copy as cURL (bash)`）
5. 回到 `/me/pan`，把整段粘贴进输入框 → 点「验证并绑定」

服务端会自动从里面抽 `-H 'cookie: …'`，你不需要自己清理。

## 方式二：只复制 Cookie 行

1–3 步同上
4. **左键点开**任意一条 `pan.quark.cn` 的请求 → 右侧 `Headers` → `Request Headers`
5. 找到 `Cookie:` 这一行，复制**冒号后面的全部内容**
6. 粘进 `/me/pan`

成功的标志：内容里有 `__pus=` 和 `__puus=`，整体长度通常 **500–1500 字符**。

## 千万别这么做

| 错误做法 | 后果 |
|---|---|
| 控制台执行 `document.cookie` | 只能拿到 `ctoken` 这类非 httpOnly 字段，**没有 `__pus/__puus`**，绑定必定失败 |
| 用手机夸克 App 找 Cookie | App 不提供导出入口 |
| 只复制某一个字段（比如只复制 `__puus=xxx`） | 缺 `__pus`，同样失败 |
| 复制 `Set-Cookie` 响应头 | 那是服务端下发用的格式，不是请求头 |

## 常见报错对照

| 提示 | 原因 | 处理 |
|---|---|---|
| 「这串 Cookie 太短了」 | 只复制了片段 | 重新按方式一整段复制 |
| 「没找到 `__puus` / `__pus`」 | 用了 `document.cookie` 或复制错行 | 换方式一 |
| 「夸克拒绝了这串 Cookie」 | Cookie 已过期（1–2 个月），或不是登录态 | 重新登录后复制 |
| 绑定成功但下载报「账号未登录」 | Cookie 在使用过程中失效 | 重新绑定 |

## 后台如何确认绑定有效

```bash
sudo node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/var/www/xiaomo/data/app.db');console.log(d.prepare('SELECT user_id,provider,nickname,status,updated_at FROM user_pan_credentials').all())"
```

`status='active'` 且 `nickname` 有值即为有效；`invalid` 表示用过一次但被夸克拒绝，页面会提示重绑。
