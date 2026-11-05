import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  isBcryptHash,
  isScryptHash,
  needsRehash,
  verifyPassword,
} from "../src/lib/password.ts";

test("scrypt：哈希后可校验，错误密码被拒", () => {
  const hash = hashPassword("Passw0rd!");
  assert.ok(isScryptHash(hash));
  assert.ok(verifyPassword("Passw0rd!", hash));
  assert.ok(!verifyPassword("Passw0rd", hash));
});

test("bcrypt（Supabase 历史格式）能被识别并校验", async () => {
  const bcrypt = await import("bcryptjs");
  const mod = (bcrypt as unknown as { default?: unknown }).default ?? bcrypt;
  const hash = (mod as { hashSync: (p: string, r: number) => string }).hashSync("OldPass123", 10);

  assert.ok(isBcryptHash(hash));
  assert.ok(!isScryptHash(hash));
  assert.ok(verifyPassword("OldPass123", hash));
  assert.ok(!verifyPassword("wrong", hash));
});

test("bcrypt 需要升级，scrypt 不需要", async () => {
  const bcrypt = await import("bcryptjs");
  const mod = (bcrypt as unknown as { default?: unknown }).default ?? bcrypt;
  const old = (mod as { hashSync: (p: string, r: number) => string }).hashSync("x", 4);
  assert.equal(needsRehash(old), true);
  assert.equal(needsRehash(hashPassword("x")), false);
});

test("空哈希与未知格式一律拒绝", () => {
  assert.ok(!verifyPassword("x", ""));
  assert.ok(!verifyPassword("x", "md5$deadbeef"));
  assert.ok(!verifyPassword("x", "$2b$broken"));
});
