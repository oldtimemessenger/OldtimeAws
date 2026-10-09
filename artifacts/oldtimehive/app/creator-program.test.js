import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("creator features are additive and keep all five bottom navigation destinations", () => {
  const source = read("app.js");
  for (const view of ["updates", "blast", "communities", "chat", "profile"]) {
    assert.ok(source.includes(`data-tab="${view}"`));
  }
  for (const view of ["creator-center", "blue-badge", "announcements"]) {
    assert.ok(source.includes(`data-creator-open="${view}"`));
  }
  assert.ok(!source.includes('data-drawer-route="creator-center"'));
  assert.ok(!source.includes('data-drawer-route="blue-badge"'));
  assert.ok(source.includes('data-creator-open="account-type"'));
});
test("membership actions are store-only and client flags never grant badges", () => {
  const source = read("creator-center.js");
  assert.doesNotMatch(source, /\.verified|localStorage.*active|stripe/i);
  assert.match(source, /\/api\/creator\/badges/);
  assert.match(source, /b\.active === true/);
  assert.match(source, /Restore purchases in the mobile app using the same Oldtime account/);
  assert.match(source, /account\/subscriptions/);
  assert.match(source, /currentTarget; b.disabled = true/);
});
test("announcements are safe during calls and composition, and have account-scoped limits", () => {
  assert.match(read("app.js"), /!currentCall\(\)/);
  assert.match(read("app.js"), /!document.activeElement\?\.isContentEditable/);
  const popup = read("creator-announcement.js");
  assert.match(popup, /sessionStorage/);
  assert.match(popup, /role="dialog"/);
  assert.match(popup, /not-now/);
  assert.match(popup, /setInterval/);
  assert.match(popup, /!isSafe\(\)/);
});
