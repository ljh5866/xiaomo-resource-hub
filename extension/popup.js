const out = document.getElementById("out");

function show(text, isErr) {
  out.textContent = text;
  out.className = isErr ? "err" : "";
}

document.getElementById("go").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://ttals.com/me/pan" });
});

document.getElementById("check").addEventListener("click", () => {
  show("检查中…", false);
  chrome.runtime.sendMessage({ type: "XM_READ_QUARK_COOKIE" }, (res) => {
    if (!res) return show("扩展没有响应", true);
    if (res.hasLogin) return show(`已找到夸克登录态（${res.count} 个字段）`, false);
    show(res.error || "没找到登录态，请先登录 pan.quark.cn", true);
  });
});
