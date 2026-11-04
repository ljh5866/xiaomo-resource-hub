import test from "node:test";
import assert from "node:assert/strict";
import { decideAdminRoute } from "../src/lib/admin/route-map.ts";

const base = {
  host: "ttals.com",
  authenticated: false,
  role: undefined as string | undefined,
};

/* ───── 路径模式（没配 ADMIN_HOST） ───── */

test("路径模式：未登录访问 /admin → 跳登录并带回跳", () => {
  const r = decideAdminRoute({ ...base, pathname: "/admin" });
  assert.equal(r.kind, "redirect");
  assert.equal(r.kind === "redirect" && r.to, "/login?next=%2Fadmin");
});

test("路径模式：普通用户访问 /admin → 回首页", () => {
  const r = decideAdminRoute({ ...base, pathname: "/admin", authenticated: true, role: "user" });
  assert.deepEqual(r, { kind: "redirect", to: "/" });
});

test("路径模式：管理员访问 /admin/resources → 放行", () => {
  const r = decideAdminRoute({
    ...base,
    pathname: "/admin/resources",
    authenticated: true,
    role: "admin",
  });
  assert.deepEqual(r, { kind: "pass" });
});

test("路径模式：前台路径不受影响", () => {
  assert.deepEqual(decideAdminRoute({ ...base, pathname: "/c/games" }), { kind: "pass" });
});

test("路径模式：自定义 ADMIN_PATH 会被重写", () => {
  const r = decideAdminRoute({
    ...base,
    pathname: "/console-x7k2/users",
    authenticated: true,
    role: "admin",
    adminPath: "console-x7k2",
  });
  assert.deepEqual(r, { kind: "rewrite", pathname: "/admin/users" });
});

/* ───── 子域名模式 ───── */

const adminHostEnv = { adminHost: "admin.ttals.com", siteHost: "ttals.com" };
/** 请求打在后台子域上 */
const onSub = { ...base, ...adminHostEnv, host: "admin.ttals.com" };
/** 请求打在前台主域上 */
const onMain = { ...base, ...adminHostEnv, host: "ttals.com" };

test("子域名：根路径 → 重写为 /admin", () => {
  const r = decideAdminRoute({ ...onSub, pathname: "/", authenticated: true, role: "admin" });
  assert.deepEqual(r, { kind: "rewrite", pathname: "/admin" });
});

test("子域名：/users → 重写为 /admin/users", () => {
  const r = decideAdminRoute({ ...onSub, pathname: "/users", authenticated: true, role: "admin" });
  assert.deepEqual(r, { kind: "rewrite", pathname: "/admin/users" });
});

test("子域名：/admin/users 不再二次加前缀", () => {
  const r = decideAdminRoute({
    ...onSub,
    pathname: "/admin/users",
    authenticated: true,
    role: "admin",
  });
  assert.deepEqual(r, { kind: "pass" });
});

test("子域名：未登录 → 跳 /login", () => {
  const r = decideAdminRoute({ ...onSub, pathname: "/users" });
  assert.equal(r.kind, "redirect");
  assert.equal(r.kind === "redirect" && r.to, "/login?next=%2Fusers");
});

test("子域名：登录页原样放行（否则死循环）", () => {
  const r = decideAdminRoute({ ...onSub, pathname: "/login" });
  assert.deepEqual(r, { kind: "pass" });
});

test("子域名：普通用户登录后 → 踢回主域首页", () => {
  const r = decideAdminRoute({ ...onSub, pathname: "/", authenticated: true, role: "user" });
  assert.deepEqual(r, { kind: "redirect", to: "https://ttals.com/" });
});

test("主域 /admin → 跳子域名根", () => {
  const r = decideAdminRoute({ ...onMain, pathname: "/admin", authenticated: true, role: "admin" });
  assert.deepEqual(r, { kind: "redirect", to: "https://admin.ttals.com/" });
});

test("主域 /admin/resources → 跳到子域 /resources", () => {
  const r = decideAdminRoute({
    ...onMain,
    pathname: "/admin/resources",
    authenticated: true,
    role: "admin",
  });
  assert.deepEqual(r, { kind: "redirect", to: "https://admin.ttals.com/resources" });
});

test("主域前台页面不受影响", () => {
  const r = decideAdminRoute({ ...onMain, pathname: "/c/games", authenticated: true, role: "user" });
  assert.deepEqual(r, { kind: "pass" });
});

test("Host 带端口也能识别", () => {
  const r = decideAdminRoute({
    ...onSub,
    host: "admin.ttals.com:443",
    pathname: "/",
    authenticated: true,
    role: "admin",
  });
  assert.deepEqual(r, { kind: "rewrite", pathname: "/admin" });
});
