import test from "node:test";
import assert from "node:assert/strict";
import { resolvePageKey, actionAliases } from "./permission-map";

test("resolves exact entity names to their page key", () => {
  assert.equal(resolvePageKey("company"), "md_companies");
  assert.equal(resolvePageKey("PurchaseOrder"), "pur_orders");
  assert.equal(resolvePageKey("do"), "sal_deliveries");
});

test("passes through already-resolved page keys untouched", () => {
  assert.equal(resolvePageKey("pur_orders"), "pur_orders");
});

test("resolves compound entity names via longest fuzzy match", () => {
  assert.equal(resolvePageKey("salesQuotationItem"), "sal_quotations");
});

test("does not let short abbreviation keys collide with unrelated words", () => {
  // "employeeDocument" contains "do" but must NOT resolve to sal_deliveries.
  const resolved = resolvePageKey("employeeDocument");
  assert.notEqual(resolved, "sal_deliveries");
});

test("action aliases expand post/print to their related actions", () => {
  assert.deepEqual(actionAliases("post"), ["post", "approve"]);
  assert.deepEqual(actionAliases("print"), ["print", "export"]);
  assert.deepEqual(actionAliases("read"), ["read"]);
});
