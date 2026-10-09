import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  const installed = candidates.find(path => existsSync(path));
  if (installed) return installed;

  for (const command of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      return execFileSync("which", [command], { encoding: "utf8" }).trim();
    } catch {}
  }
  throw new Error("Chromium is required for the Oldtime browser regression test.");
}

const fixture = {
  session: "camera-quotes-test",
  settings: { readReceipts: true, lastSeen: "everyone" },
  users: [{
    id: "camera-quotes-test",
    username: "testmember",
    name: "Test Member",
    email: "testmember@example.test",
    password: "test-password",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: ["story-member"],
    closeFriends: ["story-member"],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }, {
    id: "story-member",
    username: "storymember",
    name: "Story Member",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: ["camera-quotes-test"],
    closeFriends: [],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }, {
    id: "story-outsider",
    username: "storyoutsider",
    name: "Story Outsider",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: [],
    closeFriends: [],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }],
  requests: [],
  friendRequests: [],
  posts: [],
  stories: [],
  convos: [],
  notes: [],
  blocks: [],
  reports: [],
  campaigns: [],
  interests: {},
  resets: []
};

test("camera library, Quote creation, Community listing, and profile Notes work in the browser", {
  timeout: 90_000
}, async () => {
  const originalPort = process.env.PORT;
  const originalBasePath = process.env.BASE_PATH;
  process.env.PORT = "5173";
  process.env.BASE_PATH = "/";

  const server = await createServer({
    configFile: resolve(packageRoot, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  let browser;

  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address === "object", "Vite should listen on an available port");

    browser = await chromium.launch({
      executablePath: findChromium(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"]
    });
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 402, height: 874 }
    });
    // This isolated rendering regression test has no API service. Real
    // authentication and draft recovery are also checked against the running app.
    const isolateApi=route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"API unavailable in isolated rendering test"})});
    await context.route("**/api/**",isolateApi);
    await context.addInitScript(state => {
      if (!localStorage.getItem("oldtime-v1")) {
        localStorage.setItem("oldtime-v1", JSON.stringify(state));
      }
      sessionStorage.clear();
      sessionStorage.setItem("oldtime-cloud-session-v1",JSON.stringify({
        account:{id:state.session},accessToken:"isolated-test-session",expiresAt:Date.now()+600_000
      }));
      window.__getUserMediaCalls = 0;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.__getUserMediaCalls++;
            throw new DOMException("Camera permission denied for this test", "NotAllowedError");
          }
        }
      });
    }, fixture);

    const page = await context.newPage();
    page.on("dialog",dialog=>dialog.accept());
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
    await page.locator("#create-open").waitFor({ state: "visible" });
    assert.equal(await page.locator(".nav").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(9, 10, 12)");

    await page.locator('.nav [data-tab="blast"]').click();
    await page.locator(".bvn-twitter-feed").waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-device-note").count(), 0);
    assert.doesNotMatch(await page.locator(".bvn-twitter-feed").innerText(), /on this device|sync to other devices/i);
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-blast-clean-copy.png" });
    }
    await page.locator("[data-blast-settings-open]").click();
    await page.locator("[data-blast-settings-drawer]").waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-settings-device, .bvn-settings-footnote, .bvn-settings-copy small").count(), 0);
    await page.locator("[data-blast-drawer-close]").click();
    await page.locator(".nav button").first().click();
    await page.locator("#create-open").waitFor({ state: "visible" });

    await page.locator("#create-open").click();
    await page.locator("#ce-camera-gallery").waitFor({ state: "visible" });
    const libraryPicker = page.locator("#ce-upload");
    assert.equal(await libraryPicker.getAttribute("accept"), "image/*,video/*");
    assert.equal(await libraryPicker.getAttribute("capture"), null, "the library picker must not force camera capture");
    await page.waitForFunction(() => window.__getUserMediaCalls > 0);

    await libraryPicker.setInputFiles({
      name: "library-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=", "base64")
    });
    await page.waitForFunction(() => document.querySelector("#ce-status")?.textContent.startsWith("Photo ready"));
    assert.equal(await page.locator(".creative-editor").evaluate(element => element.classList.contains("is-camera-open")), false);
    assert.ok(await page.locator("#ce-canvas").evaluate(canvas=>canvas.width>0&&canvas.height>0));
    assert.equal(await page.locator(".ce-dock").isVisible(),true);
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-create-theme.png" });
    }

    await page.locator("#ce-close").click(); // Review -> Camera; then leave the outer Camera.
    await page.locator("#ce-close").click();
    await page.locator("#ce-exit-dialog").waitFor({state:"visible"});
    await page.locator("#ce-exit-discard").click();
    await page.locator(".creative-editor").waitFor({state:"detached"});
    await page.locator("#create-open").click();
    await page.locator('[data-ce-capture-mode="quote"]').click();
    await page.locator("#ce-inline-text").fill("A text-only camera Quote");
    assert.equal(await page.locator("#ce-inline-text").evaluate(element=>element===document.activeElement),true);
    await page.locator("#ce-text-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-caption").fill("A text-only camera Quote");
    await page.locator("#ce-publish").click();
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem("oldtime-v1"));
      return saved.posts.some(post => post.caption === "A text-only camera Quote");
    });
    const cameraQuote = await page.evaluate(() => JSON.parse(localStorage.getItem("oldtime-v1"))
      .posts.find(post => post.caption === "A text-only camera Quote"));
    assert.equal(cameraQuote.kind, "text");
    assert.deepEqual(cameraQuote.media, []);

    await page.locator('.nav [data-tab="communities"]').click();
    await page.locator("#stories-more").click();
    await page.locator('[data-drawer-action="quote"]').click();
    await page.locator("#ce-inline-text").fill("A text-only Community Quote");
    await page.locator("#ce-text-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-caption").fill("A text-only Community Quote");
    await page.locator("#ce-publish").click();
    await page.locator(".community-screen").waitFor({ state: "visible" });
    assert.equal(await page.locator("#sheet").evaluate(element => element.classList.contains("on")), false);
    const communityQuote = await page.evaluate(() => JSON.parse(localStorage.getItem("oldtime-v1"))
      .posts.find(post => post.caption === "A text-only Community Quote"));
    assert.equal(communityQuote.kind, "text");
    assert.deepEqual(communityQuote.media, []);

    await page.locator("#open-community-quotes").click();
    await page.locator(".quotes-panel").waitFor({ state: "visible" });
    const quotes = page.locator(".community-quote");
    assert.equal(await quotes.count(), 2);
    // Native Quotes are painted from editable project layers, not legacy DOM paragraphs.
    const quoteText=await page.evaluate(()=>JSON.parse(localStorage.getItem("oldtime-v1")).posts
      .filter(post=>post.kind==="text").flatMap(post=>post.creativeProject.layers.filter(layer=>layer.kind==="text").map(layer=>layer.text)).join("\n"));
    assert.match(quoteText,/A text-only camera Quote/);
    assert.match(quoteText,/A text-only Community Quote/);
    await page.locator("#close-community-quotes").click();

    await page.locator('.nav [data-tab="profile"]').click();
    await page.locator("#profile-note").click();
    await page.locator("#note-text").fill("A note above my photo");
    await page.locator("#save-note").click();
    await page.locator("#profile-note").waitFor({ state: "visible" });
    assert.equal((await page.locator("#profile-note").innerText()).trim(), "A note above my photo");
    const notePlacement = await page.evaluate(() => {
      const note = document.querySelector("#profile-note").getBoundingClientRect();
      const photo = document.querySelector(".profile-avatar").getBoundingClientRect();
      return { noteBottom: note.bottom, photoTop: photo.top };
    });
    assert.ok(notePlacement.noteBottom < notePlacement.photoTop, "the saved Note should sit above the profile photo");
    assert.equal(await page.locator(".profile-screen").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(255, 255, 255)");
    assert.equal(await page.locator(".profile-name").evaluate(element => getComputedStyle(element).color), "rgb(23, 25, 29)");
    for (const [selector, background, foreground] of [
      ["#edit", "rgb(181, 30, 41)", "rgb(255, 255, 255)"],
      ["#logout", "rgb(240, 241, 243)", "rgb(23, 25, 29)"],
      ["#playall", "rgb(42, 42, 42)", "rgb(255, 255, 255)"]
    ]) {
      const buttonStyle = await page.locator(selector).evaluate(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color, height: element.getBoundingClientRect().height };
      });
      assert.equal(buttonStyle.background, background, `${selector} profile button background`);
      assert.equal(buttonStyle.foreground, foreground, `${selector} profile button contrast`);
      assert.ok(buttonStyle.height >= 40 && buttonStyle.height <= 46, `${selector} should keep its compact profile size`);
    }
    assert.equal(await page.locator(".profile-page").evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-profile-theme.png" });
    }

    await page.setViewportSize({ width:402, height:650 });
    await page.locator("#edit").click();
    for (const selector of ["#savep-header", "#savep"]) {
      const placement = await page.locator(selector).evaluate(button => {
        const rect = button.getBoundingClientRect();
        const nav = document.querySelector(".nav").getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          visible: rect.top >= 0 && rect.bottom <= nav.top,
          clickable: hit === button || button.contains(hit),
          background: getComputedStyle(button).backgroundColor
        };
      });
      assert.ok(placement.visible, `${selector} must stay above bottom navigation on a short phone`);
      assert.ok(placement.clickable, `${selector} must not be covered by another element`);
      assert.equal(placement.background, "rgb(181, 30, 41)");
    }
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-profile-editor-save.png" });
    }
    await page.locator("#nm").fill("Profile Save Test");
    await page.locator("#bio").fill("Saved from the header");
    await page.locator("#savep-header").click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.equal(await page.locator(".profile-name").innerText(), "Profile Save Test");
    await page.reload();
    await page.locator('.nav [data-tab="profile"]').click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.equal(await page.locator(".profile-name").innerText(), "Profile Save Test");
    await page.locator("#edit").click();
    assert.equal(await page.locator("#bio").inputValue(), "Saved from the header");
    await page.locator("#city").fill("Test City");
    await page.locator("#savep").click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.match(await page.locator(".profile-city").innerText(), /Test City/);
    await page.setViewportSize({ width:402, height:874 });

    await page.locator('.nav [data-tab="communities"]').click();
    const communityNote = page.locator(".community-screen .friend-story.own-story .friend-note-text");
    assert.match(await communityNote.innerText(),/A note above my photo/);
    await page.locator("#stories-more").click();
    await page.locator('[data-drawer-action="quote"]').click();
    await page.locator("#ce-inline-text").fill("Only my Close Friends should see this");
    await page.locator("#ce-text-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-destination").selectOption("story");
    await page.locator("#ce-visibility").selectOption("close-friends");
    await page.locator("#ce-publish").click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("oldtime-v1")).stories.some(item=>item.text==="Only my Close Friends should see this"));
    const savedBrowserState=await context.storageState();
    const viewerContext=async userId=>{
      const viewer=await browser.newContext({serviceWorkers:"block",viewport:{width:402,height:874},storageState:savedBrowserState});
      await viewer.route("**/api/**",isolateApi);
      await viewer.addInitScript(id=>{
        const state=JSON.parse(localStorage.getItem("oldtime-v1"));state.session=id;
        localStorage.setItem("oldtime-v1",JSON.stringify(state));sessionStorage.clear();
        sessionStorage.setItem("oldtime-cloud-session-v1",JSON.stringify({
          account:{id},accessToken:"isolated-test-session",expiresAt:Date.now()+600_000
        }));
      },userId);
      return viewer;
    };
    const memberContext=await viewerContext("story-member"),outsiderContext=await viewerContext("story-outsider");
    const memberPage=await memberContext.newPage(),outsiderPage=await outsiderContext.newPage();
    await memberPage.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:"networkidle"});
    await memberPage.locator('.stories.home-stories [data-story="camera-quotes-test"]').click();
    await memberPage.waitForFunction(()=>document.querySelector("#storyview")?.classList.contains("on"));
    assert.match(await memberPage.locator("#storyview").innerText(),/Only my Close Friends should see this/);
    await outsiderPage.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:"networkidle"});
    assert.equal(await outsiderPage.locator('.stories.home-stories [data-story="camera-quotes-test"]').count(),0);
    const outsiderStoryTile=outsiderPage.locator('.stories.home-stories [data-story]').first();
    if(!await outsiderStoryTile.count()){
      await outsiderPage.evaluate(()=>{
        const button=document.createElement("button");button.className="story";button.dataset.story="story-outsider";
        document.querySelector(".stories.home-stories").append(button);
      });
    }
    await outsiderStoryTile.evaluate(button => {
      button.dataset.story = "camera-quotes-test";
      button.click();
    });
    await outsiderPage.waitForFunction(() => document.querySelector(".toast")?.textContent.includes("Story unavailable"));
    assert.equal(await outsiderPage.locator("#storyview").evaluate(element => element.classList.contains("on")), false);
    await memberContext.close();
    await outsiderContext.close();

    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join("; ")}`);
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    if (originalBasePath === undefined) delete process.env.BASE_PATH;
    else process.env.BASE_PATH = originalBasePath;
  }
});

