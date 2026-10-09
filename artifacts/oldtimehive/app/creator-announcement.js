import "./creator-announcement.css";
import { requestCloudApi } from "./store.js";

const DELAY = 4000;
const MARK = "oldtime-creator-announcement-v1:";
let token = 0;
let timer = null;
let open = null;

function marker(accountId) { return MARK + accountId; }
function hasMarker(accountId) {
  try { return globalThis.sessionStorage.getItem(marker(accountId)) !== null; } catch { return true; }
}
function setMarker(accountId) {
  try {
    const s = globalThis.sessionStorage;
    s.setItem(marker(accountId), String(Date.now()));
    return s.getItem(marker(accountId)) !== null;
  } catch { return false; }
}

export function pickAnnouncement(list) {
  const items = (Array.isArray(list) ? list : []).filter(a => a && a.optional === true && !["safety", "service"].includes(a.category) && typeof a.id === "string" && a.title);
  const rank = a => /welcome/i.test(a.id) || /^(welcome|creator)/i.test(String(a.category)) ? 0 : /promo/i.test(String(a.category)) ? 1 : 2;
  const ranked = items.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i);
  return ranked.length ? ranked[0].a : null;
}

function closeModal() {
  if (!open) return;
  open.cleanup();
  open = null;
}

export function resetCreatorAnnouncements() {
  token++;
  clearTimeout(timer);
  timer = null;
  closeModal();
}

export function scheduleCreatorAnnouncement({ app, esc, navigate, isSafe, accountId } = {}) {
  if (!app || typeof esc !== "function" || typeof isSafe !== "function") return;
  if (typeof accountId !== "string" || !accountId.trim()) return;
  if (open || timer || hasMarker(accountId)) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const my = token;
  const stale = () => my !== token || !app.isConnected || open;
  timer = setTimeout(async () => {
    timer = null;
    if (stale() || !isSafe() || hasMarker(accountId)) return;
    let res;
    try { res = await requestCloudApi("/api/announcements"); } catch { return; }
    if (stale() || !isSafe() || hasMarker(accountId)) return;
    const a = pickAnnouncement(res?.announcements);
    if (!a || !setMarker(accountId)) return;
    present(a);
  }, DELAY);

  function present(a) {
    const prior = document.activeElement;
    const id = `cta-${Math.random().toString(36).slice(2, 8)}`;
    const wrap = document.createElement("div");
    wrap.className = "cta-backdrop";
    wrap.innerHTML = `<section class="cta-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-d" tabindex="-1">
      <div class="cta-top"><span class="cta-eyebrow">${esc(a.category || "Oldtime")}</span><button type="button" class="cta-x" data-cta="not-now" aria-label="Close">&times;</button></div>
      <h2 id="${id}-t">${esc(a.title)}</h2><p id="${id}-d">${esc(a.description || "")}</p>
      <div class="cta-err" role="alert" aria-live="assertive"></div>
      <div class="cta-actions">${a.primaryRoute ? `<button type="button" class="cta-primary" data-cta="action">${esc(a.primaryLabel || "Learn more")}</button>` : ""}
      <button type="button" class="cta-secondary" data-cta="not-now">Maybe later</button>
      <button type="button" class="cta-link" data-cta="never">Don't show this again</button></div></section>`;
    const modal = wrap.firstElementChild;
    const err = wrap.querySelector(".cta-err");
    let busy = false;
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); dismiss("not-now"); return; }
      if (e.key !== "Tab") return;
      const f = [...modal.querySelectorAll("button:not([disabled])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const cleanup = () => {
      clearInterval(safetyTimer);
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      if (prior?.isConnected) try { prior.focus(); } catch { /* ignore */ }
    };
    open = { cleanup };
    const safetyTimer = setInterval(() => { if (!isSafe() && open?.cleanup === cleanup) closeModal(); }, 500);
    async function dismiss(choice) {
      if (busy) return;
      busy = true; err.textContent = "";
      try {
        await requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/dismiss`, { method: "POST", body: { choice } });
        if (open?.cleanup === cleanup) closeModal();
      } catch (e) {
        busy = false;
        if (open?.cleanup === cleanup) err.textContent = e?.message || "Your choice could not be saved. Try again.";
      }
    }
    wrap.addEventListener("click", e => { if (e.target === wrap) dismiss("not-now"); });
    wrap.querySelectorAll("[data-cta]").forEach(b => b.addEventListener("click", async () => {
      const c = b.dataset.cta;
      if (c !== "action") return dismiss(c);
      if (busy) return;
      busy = true;
      try { await requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/event`, { method: "POST", body: { event: "action" } }); } catch { /* still navigate */ }
      if (open?.cleanup !== cleanup) return;
      closeModal();
      if (my === token) navigate?.(a.primaryRoute);
    }));
    document.addEventListener("keydown", onKey, true);
    app.appendChild(wrap);
    modal.querySelector(".cta-primary, .cta-secondary")?.focus();
    requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/event`, { method: "POST", body: { event: "shown" } }).catch(() => {});
  }
}
