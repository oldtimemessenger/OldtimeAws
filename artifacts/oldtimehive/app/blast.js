import { hydrateLocalMedia } from "./local-media.js";
import "./blast.css";
import "./blast-video-notes.css";
import { api, fileToData } from "./store.js";
import { mountCreativeViewers, setCreativeMuted } from "./creative-viewer.js";
import { getBlastVideoNote, updateBlastCreativeNote } from "./blast-video-note-store.js";
import { listBlastPosts, updateBlastCreativePost } from "./blast-store.js";
import { openCreativeResponse } from "./creative-responses.js";
import { icon } from "./icons.js";
import * as social from "./blast-social.js";
import { renderBlastInfo } from "./blast-info.js";
import * as notes from "./blast-video-note-view.js";
import * as composer from "./blast-video-note-composer.js";
import { bindBlastSettingsDrawer, renderBlastSettingsDrawer } from "./blast-settings-drawer.js";

let activeView = { name: "notes" };
let settingsDrawerOpen = false;
const SOCIAL_VIEWS = ["hub", "create", "detail", "friends"];
const NOTE_VIEWS = ["notes", "chats", "chat", "note-detail"];
const COMPOSER_VIEWS = ["note-camera", "note-editor"];
const INFO_VIEWS = ["guidelines", "privacy"];

export function setBlastView(next) {
  activeView = [...SOCIAL_VIEWS, ...NOTE_VIEWS, ...COMPOSER_VIEWS, ...INFO_VIEWS].includes(next?.name) ? next : { name: "notes" };
  settingsDrawerOpen = false;
}

export function renderBlast({ shell, app, toast, esc, onOpenPost }) {
  const me = api.me();
  if (!me) return;
  const ctx = {
    app, me, toast, esc, icon, fileToData,
    getView: () => activeView,
    settingsOpen: settingsDrawerOpen,
    openBlastSettings: () => {
      settingsDrawerOpen = true;
      renderBlast({ shell, app, toast, esc, onOpenPost });
    },
    setView: next => {
      const nextView = typeof next === "string" ? { name: next } : next;
      if (activeView.name === "note-camera" && !["note-camera","note-editor"].includes(nextView.name)) notesComposerClose();
      settingsDrawerOpen = false;
      setBlastView(nextView);
      renderBlast({ shell, app, toast, esc, onOpenPost });
    },
    refresh: () => renderBlast({ shell, app, toast, esc, onOpenPost }),
    page: (title, body, extra = "") => `<main class="blast-screen"><div class="blast-wrap blast-anim">
       <header class="blast-title-row">
         <button type="button" class="blast-back" data-blast-nav="notes" aria-label="Return to Blast" data-testid="blast-back">${icon("back")}</button>
        <h1>${esc(title)}</h1>
         <button type="button" class="blast-icon-btn" data-blast-nav="notes" aria-label="Blast timeline" data-testid="blast-feed-home">${icon("home")}</button>
      </header>${extra}${body}</div></main>`
  };
  let output;
  if (SOCIAL_VIEWS.includes(activeView.name)) {
    output = social.renderBlastSocial(activeView, ctx);
  } else if (NOTE_VIEWS.includes(activeView.name)) {
    output = notes.renderBlastVideoNotes(activeView, ctx);
  } else if (COMPOSER_VIEWS.includes(activeView.name)) {
    output = composer.renderBlastNoteComposer(activeView, ctx);
  } else {
    output = renderBlastInfo(activeView, ctx);
  }
  shell(output, "dark", {
    hideNav: activeView.name === "note-camera" || (activeView.name === "create" && activeView.type !== "event")
  });
  if (settingsDrawerOpen) app.insertAdjacentHTML("beforeend", renderBlastSettingsDrawer(ctx));
  app.querySelectorAll("[data-blast-nav]").forEach(button => {
    button.onclick = () => ctx.setView(button.dataset.blastNav);
  });
  app.querySelectorAll("[data-blast-open-source]").forEach(button => {
    button.onclick = () => onOpenPost?.(button.dataset.blastOpenSource, button.dataset.blastOpenComment || "");
  });
  void hydrateLocalMedia(app);
  app.querySelectorAll("[data-blast-settings-open]").forEach(button => {
    button.onclick = () => ctx.openBlastSettings();
  });
  if (SOCIAL_VIEWS.includes(activeView.name)) social.bindBlastSocial(activeView, ctx);
  else if (NOTE_VIEWS.includes(activeView.name)) {
    notes.bindBlastVideoNotes(activeView, ctx);
    if (activeView.name === "notes") social.bindBlastSocial(activeView, ctx);
  }
  else if (COMPOSER_VIEWS.includes(activeView.name)) composer.bindBlastNoteComposer(activeView, ctx);
  const resolveCreative=id=>{
    const note=getBlastVideoNote(id);
    if(note?.creativeProject)return {...note,author:note.authorId};
    const post=listBlastPosts().find(item=>item.media?.creativeId===id);
    return post?{id,author:post.authorId,creativeProject:post.media.creativeProject}:null;
  };
  mountCreativeViewers(app,{
    onSource:onOpenPost,canViewItem:()=>true,
    resolveItem:resolveCreative,
    onSticker:(id,layer)=>openCreativeResponse(id,false,layer,{get:()=>resolveCreative(id),
      save:change=>getBlastVideoNote(id)?updateBlastCreativeNote(id,change):updateBlastCreativePost(id,change)})
  });
  app.querySelector("[data-bvn-creative-audio]")?.addEventListener("click",event=>{
    const button=event.currentTarget,unmute=button.getAttribute("aria-pressed")!=="true";
    setCreativeMuted(app,!unmute);button.setAttribute("aria-pressed",String(unmute));button.textContent=unmute?"Mute video":"Unmute video";
  });
  if (settingsDrawerOpen) {
    bindBlastSettingsDrawer(app, () => {
      settingsDrawerOpen = false;
      renderBlast({ shell, app, toast, esc, onOpenPost });
      app.querySelector("[data-blast-settings-open]")?.focus();
    });
  }
}

function notesComposerClose() {
  composer.closeBlastNoteCamera(true);
}

export default renderBlast;
