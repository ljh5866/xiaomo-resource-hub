# 小莫资源网 · 网盘绑定助手

把浏览器里的夸克登录态一键交给小莫资源网，之后站内下载走**你自己的带宽**（直链直出，不受站点限速）。

## 为什么需要扩展

夸克的登录态存在 `__pus` / `__puus` 两个 **httpOnly** cookie 里，网页里的 JavaScript 读不到
（`document.cookie` 只会给出 `ctoken` 这类访客字段）。浏览器扩展的 `chrome.cookies` API 可以读到
—— 所以「一键绑定」只能靠扩展实现。

## 安装（Edge / Chrome，一次即可）

1. 下载并解压 `xiaomo-pan-helper.zip`
2. 地址栏打开：
   - Edge：`edge://extensions`
   - Chrome：`chrome://extensions`
3. 右上角打开「开发者模式」
4. 点「加载解压缩的扩展」，选择解压后的 `extension` 文件夹
5. 装好后，工具栏出现「小莫资源网 · 网盘绑定助手」

## 使用

1. **先在同一个浏览器登录** <https://pan.quark.cn>
2. 打开 <https://ttals.com/me/pan>
3. 点「一键绑定（扩展）」→ 页面会显示「绑定成功：昵称」
4. 回到任意资源页点「站内解析」，下载按钮会变成「直链直出」

> 不想装扩展也可以用「复制 cURL 粘贴」，见 `docs/31-用户如何获取网盘Cookie.md`。

## 它做了什么、没做什么

| 做 | 不做 |
|---|---|
| 读取 `*.quark.cn` 的登录相关 cookie | 不读取其他任何网站的数据 |
| 只在你点击按钮时读取 | 不联网、不上传、不记录日志 |
| 把 cookie 交给当前页面（ttals.com） | 不修改你的任何设置 |

只保留登录必需字段（`__pus` / `__puus` / `__kp` / `ctoken` / `isQuark` 等），其余一律过滤。

## 卸载

扩展管理页点「移除」即可。已绑定的凭证在站点 `/me/pan` 点「解除绑定」删除。

## 开发

```
extension/
├─ manifest.json    MV3 清单
├─ background.js    chrome.cookies 读取 + 字段过滤
├─ content.js       ttals.com 页面的 postMessage 桥
├─ popup.html/js    工具栏弹窗（打开绑定页 / 检查登录）
└─ README.md
```

打包：`node scripts/build-extension.mjs` → `dist/xiaomo-pan-helper.zip`
