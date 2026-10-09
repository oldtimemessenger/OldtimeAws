import { readFileSync } from "node:fs";
import assert from "node:assert";
import { test } from "node:test";
const js = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
test("narrow Messages headers reserve separate title and action columns",()=>{
  assert.match(css,/\.chat-list-topline\s*\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.chat-list-topline \.chat-favorite-action,\.chat-list-topline \.chat-head-actions\s*\{[^}]*position:static/);
});
test("long chat names truncate independently of verification badges",()=>{
  const chat=readFileSync(new URL("./chat.js",import.meta.url),"utf8");
  assert.match(chat,/class="chat-identity-name"/);
  assert.match(css,/\.chat-identity-name\s*\{[^}]*text-overflow:ellipsis/);
  assert.match(css,/\.chat-identity-copy \.verified\s*\{[^}]*flex:0 0 auto/);
});
test("Settings reserves separate account-name and profile-action columns",()=>{
  assert.match(css,/\.account-settings-screen \.settings-account-card\s*\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.account-settings-screen \.settings-account-card > span:nth-child\(2\)\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
});
test("full feed captions stay scrollable above the audio and navigation controls",()=>{
  assert.match(css,/\.clip \.meta\s*\{[^}]*bottom:calc\(158px[^}]*max-height:calc\(100% - 362px[^}]*overflow-y:auto[^}]*overscroll-behavior-y:contain/);
  assert.match(js,/<div class="meta" tabindex="0" aria-label="Post details">/);
});
test("story usernames are bounded", () => {
  assert.match(js, /<span class="story-name">\$\{esc\(u\.username\)\}<\/span>/);
  assert.match(css, /\.story-name\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.story\s*\{[^}]*flex:\s*0 0 68px/);
});
