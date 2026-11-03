import test from "node:test";
import assert from "node:assert/strict";
import {
  breadcrumbJsonLd,
  collectionJsonLd,
  resourceJsonLd,
  websiteJsonLd,
} from "../src/lib/seo.ts";

test("站点级：WebSite + 站内搜索入口", () => {
  const d = websiteJsonLd() as Record<string, unknown>;
  assert.equal(d["@type"], "WebSite");
  assert.match(String(d.url), /^https?:\/\//);

  const action = d.potentialAction as Record<string, unknown>;
  assert.equal(action["@type"], "SearchAction");
  const target = action.target as Record<string, unknown>;
  assert.match(String(target.urlTemplate), /\{search_term_string\}/);
});

test("面包屑：position 从 1 递增且链接是绝对地址", () => {
  const d = breadcrumbJsonLd([
    { name: "首页", path: "/" },
    { name: "模板文档", path: "/c/template" },
    { name: "某资源", path: "/r/demo" },
  ]) as { itemListElement: { position: number; item: string }[] };

  assert.equal(d.itemListElement.length, 3);
  assert.deepEqual(
    d.itemListElement.map((i) => i.position),
    [1, 2, 3],
  );
  for (const item of d.itemListElement) {
    assert.match(item.item, /^https?:\/\//);
  }
});

test("列表页：CollectionPage 带 ItemList 且计数一致", () => {
  const d = collectionJsonLd({
    name: "模板文档",
    description: "Excel / PPT 模板",
    path: "/c/template",
    items: [
      { title: "A", path: "/r/a" },
      { title: "B", path: "/r/b" },
    ],
  }) as Record<string, unknown>;

  assert.equal(d["@type"], "CollectionPage");
  const list = d.mainEntity as Record<string, unknown>;
  assert.equal(list.numberOfItems, 2);
  assert.equal((list.itemListElement as unknown[]).length, 2);
});

test("详情页：软件类映射成 SoftwareApplication，并带免费 Offer", () => {
  const d = resourceJsonLd({
    code: "XM-2026-0001",
    title: "某软件",
    summary: "说明",
    kind: "software",
    platforms: ["windows", "mac"],
    slug: "demo",
    coverUrl: "/files/covers/demo.webp",
    version: "v1.0",
    sizeLabel: "12 MB",
    publishedAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-02T00:00:00Z"),
    categoryName: "软件工具",
  }) as Record<string, unknown>;

  assert.equal(d["@type"], "SoftwareApplication");
  assert.equal(d.operatingSystem, "windows, mac");
  assert.equal(d.identifier, "XM-2026-0001");
  assert.match(String(d.image), /^https?:\/\//);

  const offer = d.offers as Record<string, unknown>;
  assert.equal(offer.price, "0");
});

test("详情页：模板/素材映射成 CreativeWork，课程映射成 Course", () => {
  const base = {
    code: "X",
    title: "T",
    kind: "template",
    platforms: [],
    slug: "s",
    categoryName: "模板文档",
  };
  assert.equal((resourceJsonLd(base) as Record<string, unknown>)["@type"], "CreativeWork");
  assert.equal(
    (resourceJsonLd({ ...base, kind: "course" }) as Record<string, unknown>)["@type"],
    "Course",
  );
});

test("详情页：不编造评分（没有 aggregateRating）", () => {
  const d = resourceJsonLd({
    code: "X",
    title: "T",
    kind: "software",
    platforms: ["windows"],
    slug: "s",
    categoryName: "软件工具",
  }) as Record<string, unknown>;

  assert.equal(d.aggregateRating, undefined);
  assert.equal(d.review, undefined);
});
