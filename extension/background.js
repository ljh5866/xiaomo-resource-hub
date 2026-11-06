/**
 * 小莫资源网 · 网盘绑定助手（背景服务）
 *
 * 唯一的作用：读取 *.quark.cn 的 cookie 并回传给站点页面。
 * 网页 JS 读不到 httpOnly 的 __pus / __puus，扩展的 chrome.cookies 可以 —— 这是一键绑定
 * 唯一可行的技术路径。
 */

/** 只把这些字段交给站点，避免把整站 cookie 全抖出去 */
const QUARK_KEEP = [
  "__pus",
  "__puus",
  "__kp",
  "__kps",
  "__ktd",
  "__uid",
  "__kp",
  "ctoken",
  "b-user-id",
  "isQuark",
  "isQuark.sig",
  "grey-id",
  "grey-id.sig",
  "__sdid",
  "tfstk",
  "_UP_",
];

function wanted(name) {
  return QUARK_KEEP.some((k) => (k.endsWith("_") ? name.startsWith(k) : name === k));
}

async function readQuarkCookie() {
  const all = await chrome.cookies.getAll({ domain: "quark.cn" });
  const picked = all.filter((c) => wanted(c.name));
  const jar = picked.map((c) => `${c.name}=${c.value}`).join("; ");
  const hasLogin = picked.some((c) => c.name === "__pus" || c.name === "__puus");
  return {
    ok: hasLogin,
    cookie: jar,
    count: picked.length,
    hasLogin,
    names: picked.map((c) => c.name).join(","),
    error: hasLogin ? null : "没在浏览器里找到夸克的登录态（__pus），请先在 pan.quark.cn 登录",
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "XM_READ_QUARK_COOKIE") return false;
  readQuarkCookie()
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ ok: false, error: String(e), cookie: "", hasLogin: false }));
  return true; // 异步响应
});

/** 点工具栏图标时，若当前页不是小莫资源网，就打开绑定页 */
chrome.action.onClicked?.addListener(async () => {
  await chrome.tabs.create({ url: "https://ttals.com/me/pan" });
});
