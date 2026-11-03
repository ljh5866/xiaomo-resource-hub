import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

test("哈希格式为 scrypt$N$salt$hash", () => {
  const h = hashPassword("xiaomo2026");
  const parts = h.split("$");
  assert.equal(parts[0], "scrypt");
  assert.equal(parts.length, 4);
  assert.ok(parts[2].length >= 32);
});

test("同一密码两次哈希不同（有随机盐）", () => {
  const a = hashPassword("same-password");
  const b = hashPassword("same-password");
  assert.notEqual(a, b);
});

test("正确密码通过校验", () => {
  const h = hashPassword("xiaomo2026");
  assert.equal(verifyPassword("xiaomo2026", h), true);
});

test("错误密码被拒绝", () => {
  const h = hashPassword("xiaomo2026");
  assert.equal(verifyPassword("xiaomo2027", h), false);
  assert.equal(verifyPassword("", h), false);
});

test("损坏的哈希不会抛错，只返回 false", () => {
  assert.equal(verifyPassword("x", "garbage"), false);
  assert.equal(verifyPassword("x", "scrypt$abc"), false);
});
