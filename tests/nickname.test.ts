import test from "node:test";
import assert from "node:assert/strict";
import { randomNickname } from "../src/lib/nickname.ts";

test("昵称格式为「xx的xx」", () => {
  for (let i = 0; i < 30; i++) {
    const n = randomNickname();
    assert.match(n, /^.+的.+$/);
    assert.ok(n.length <= 24);
  }
});

test("多次生成不全相同", () => {
  const set = new Set(Array.from({ length: 20 }, () => randomNickname()));
  assert.ok(set.size > 1);
});
