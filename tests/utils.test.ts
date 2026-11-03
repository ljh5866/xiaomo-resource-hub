import test from "node:test";
import assert from "node:assert/strict";
import { formatCount, makeCode, formatDate } from "../src/lib/utils.ts";

test("formatCount 分级", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1000), "1k");
  assert.equal(formatCount(1500), "1.5k");
  assert.equal(formatCount(12000), "1.2w");
});

test("makeCode 补零到 4 位", () => {
  assert.equal(makeCode(7, 2026), "XM-2026-0007");
  assert.equal(makeCode(1234, 2026), "XM-2026-1234");
});

test("formatDate 用 YYYY-MM-DD 且空值给破折号", () => {
  assert.equal(formatDate(new Date("2026-11-03T02:00:00Z")), "2026-11-03");
  assert.equal(formatDate(null), "—");
});
