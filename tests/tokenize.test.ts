import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, tokenizeToIndex, toMatchExpr } from "../src/lib/search/tokenize.ts";

test("中文按 2-gram 切分", () => {
  assert.deepEqual(tokenize("数据看板"), ["数据", "据看", "看板"]);
});

test("单个汉字保留", () => {
  assert.deepEqual(tokenize("字"), ["字"]);
});

test("英文与数字整词保留", () => {
  const t = tokenize("Excel模板v3.2");
  assert.ok(t.includes("excel"));
  assert.ok(t.includes("模板"));
  assert.ok(t.includes("v3"));
  assert.ok(t.includes("2"));
});

test("重复 token 去重", () => {
  const t = tokenize("看看看");
  assert.deepEqual(t, ["看看"]);
});

test("空串与纯标点返回空数组", () => {
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize("  ，。！ "), []);
});

test("索引串是空格拼接", () => {
  assert.equal(tokenizeToIndex("看板"), "看板");
});

test("查询表达式把每个 token 包成短语并用 OR 连接", () => {
  const expr = toMatchExpr("看板");
  assert.equal(expr, '"看板"');
  const multi = toMatchExpr("数据看板");
  assert.ok(multi.includes(" OR "));
  assert.ok(multi.startsWith('"'));
});
