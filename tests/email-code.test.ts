import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-secret";

const { generateCode, hashCode } = await import("../src/lib/email/mailer.ts");

test("验证码是 6 位数字", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.match(code, /^\d{6}$/);
  }
});

test("同一验证码哈希稳定", () => {
  assert.equal(hashCode("123456"), hashCode("123456"));
});

test("不同验证码哈希不同", () => {
  assert.notEqual(hashCode("123456"), hashCode("654321"));
});

test("哈希里不含明文", () => {
  assert.ok(!hashCode("123456").includes("123456"));
  assert.equal(hashCode("123456").length, 64);
});
