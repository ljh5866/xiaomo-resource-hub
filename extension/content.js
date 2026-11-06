/**
 * 站点页面 ↔ 扩展的桥。
 *
 * 页面（ttals.com/me/pan）发 window.postMessage({type:"XM_PAN_BIND_REQUEST"})，
 * 这里转给 background 读 cookie，再把结果 postMessage 回页面。
 *
 * 只做这一件事，不读取页面任何内容，也不注入 UI。
 */

const REQ = "XM_PAN_BIND_REQUEST";
const RESULT = "XM_PAN_BIND_RESULT";
const READY = "XM_PAN_EXT_READY";

window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== REQ) return;

    try {
      chrome.runtime.sendMessage({ type: "XM_READ_QUARK_COOKIE" }, (res) => {
        const payload = res ?? { ok: false, error: "扩展没有响应" };
        window.postMessage({ type: RESULT, requestId: event.data.requestId, ...payload }, "*");
      });
    } catch (e) {
      window.postMessage(
        { type: RESULT, requestId: event.data.requestId, ok: false, error: String(e), cookie: "" },
        "*",
      );
    }
  },
  false,
);

// 告诉页面「扩展已就绪」，页面据此显示一键绑定按钮
window.postMessage({ type: READY }, "*");
