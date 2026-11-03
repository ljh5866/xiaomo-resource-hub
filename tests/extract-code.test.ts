import test from "node:test";
import assert from "node:assert/strict";
import { sniffExtractCode } from "../src/lib/extract-code.ts";

test("识别「提取码：xxxx」", () => {
  assert.equal(sniffExtractCode("链接：https://pan.quark.cn/s/abc 提取码：ab12"), "ab12");
});

test("识别不带冒号与全角冒号", () => {
  assert.equal(sniffExtractCode("提取码 ab12"), "ab12");
  assert.equal(sniffExtractCode("提取码：ab12"), "ab12");
});

test("识别 pwd 形式", () => {
  assert.equal(sniffExtractCode("pwd: x9y8"), "x9y8");
});

test("没有提取码返回 null", () => {
  assert.equal(sniffExtractCode("https://pan.baidu.com/s/1abcdef"), null);
});

test("码长不是 4 位时不误判", () => {
  assert.equal(sniffExtractCode("提取码：abc"), null);
});
