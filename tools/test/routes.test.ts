/** `/start?view=example[&ex=<id>]` is served from the prerendered example pages via a rewrite in next.config.ts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../next.config";
import { EXAMPLES } from "@/lib/examples";

test("example deep links rewrite to the prerendered pages, before /start itself", async () => {
  const r = await nextConfig.rewrites!();
  assert.ok(!Array.isArray(r), "uses beforeFiles");
  const [withId, featured] = r.beforeFiles ?? [];
  assert.equal(withId.source, "/start");
  assert.equal(withId.destination, "/start/example/:ex");
  assert.equal(featured.destination, "/start/example/featured");
  const ex = withId.has?.find((h: { type: string; key?: string }) => h.type === "query" && h.key === "ex");
  assert.ok(ex && "value" in ex && ex.value, "ex is captured");
  const pattern = new RegExp(`^${ex.value.replace("(?<ex>", "(")}$`);
  for (const e of EXAMPLES) assert.match(e.id, pattern, `example id "${e.id}" fits the rewrite`);
});

test("old app links on / still redirect to /start", async () => {
  const keys = (await nextConfig.redirects!()).map((r) => r.has?.[0] && "key" in r.has[0] ? r.has[0].key : null);
  assert.deepEqual(keys, ["view", "mock", "runner", "fail"]);
});
