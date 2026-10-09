import { api } from "./store.js";
import { creativeMediaMarkup, creativeAspect } from "./creative-viewer.js";
import {
  addBlastChatReply,
  addBlastVideoNoteComment,
  deleteBlastMedia,
  deleteBlastVideoNote,
  formatBlastNoteDuration,
  getBlastMediaUrl,
  getBlastVideoNote,
  listBlastChats,
  listBlastChatMessages,
  listBlastFeedVideoNotes,
  toggleBlastVideoNoteReaction
} from "./blast-video-note-store.js";
import { listBlastPosts } from "./blast-store.js";
import { renderBlastTimelinePost } from "./blast-social.js";
import { hasBlastNoteDraft } from "./blast-video-note-composer.js";

let timelineFilter = "all";

function profile(id) {
  const user = api.user(id);
  return {
    name: user?.name || user?.username || "Oldtime member",
    username: user?.username || "member",
    avatar: user?.avatar || ""
  };
}

function avatar(id, ctx, className = "bvn-avatar") {
  const person = profile(id);
  return person.avatar
    ? `<img class="${className}" src="${ctx.esc(person.avatar)}" alt="" />`
    : `<span class="${className}" aria-hidden="true">${ctx.esc(person.name.slice(0, 1).toUpperCase())}</span>`;
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function audienceLabel(audience) {
  return ({
    public: "Blast Friends",
    friends: "Blast Friends",
    group: "Group",
    "only-me": "Only me"
  })[audience] || "Blast Friends";
}

function safeColor(color) {
  return ["#ffffff", "#f4d35e", "#f28482", "#84a59d", "#5b8def"].includes(color) ? color : "#ffffff";
}

function safeNumber(value, fallback = 50) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
}

function overlayMarkup(overlays, ctx) {
  const strokes = Array.isArray(overlays?.strokes) ? overlays.strokes : [];
  const labels = Array.isArray(overlays?.labels) ? overlays.labels : [];
  const strokeMarkup = strokes.map(stroke => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    const value = points.map(point => `${safeNumber(point.x)},${safeNumber(point.y)}`).join(" ");
    if (points.length < 2) return "";
    return `<polyline points="${value}" fill="none" stroke="${safeColor(stroke.color)}" stroke-width="${Math.max(0.5, Math.min(8, Number(stroke.width) || 2.5))}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
  }).join("");
  const labelMarkup = labels.map(label => {
    const text = String(label.text || "").trim().slice(0, 80);
    if (!text) return "";
    return `<text x="${safeNumber(label.x)}" y="${safeNumber(label.y)}" fill="${safeColor(label.color)}" font-size="${Math.max(2, Math.min(12, Number(label.size) || 6))}" text-anchor="middle" dominant-baseline="middle" paint-order="stroke fill" stroke="rgba(0,0,0,.65)" stroke-width="1.4" stroke-linejoin="round">${ctx.esc(text)}</text>`;
  }).join("");
  return `${strokeMarkup}${labelMarkup}`;
}

function mediaButton(note, ctx, extraClass = "") {
  const id = ctx.esc(note.id);
  const mediaId = ctx.esc(note.mediaId);
  const media = note.creativeProject ? creativeMediaMarkup(note,ctx.esc) : note.mediaType === "image"
    ? `<img class="bvn-note-image" data-bvn-media-id="${mediaId}" alt="Image note" />`
    : `<video class="bvn-note-video" data-bvn-media-id="${mediaId}" data-bvn-autoplay="true" muted playsinline preload="metadata" aria-label="Video note preview"></video>`;
  const overlay = overlayMarkup(note.overlays, ctx);
  return `<button class="bvn-note-preview ${extraClass}" ${note.creativeProject?`style="aspect-ratio:${creativeAspect(note.creativeProject)}"`:""} type="button" data-bvn-open-note="${id}" aria-label="Open ${note.mediaType === "image" ? "image" : "video"} note">
    ${media}<svg class="bvn-note-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${overlay}</svg>
    ${note.mediaType === "video" ? `<span class="bvn-note-duration">${ctx.esc(formatBlastNoteDuration(note.duration))}</span>` : ""}
    <span class="bvn-note-play" aria-hidden="true">${ctx.icon("play")}</span>
  </button>`;
}

function deleteNoteButton(note, ctx, className = "bvn-delete-note-action", label = "Delete") {
  if (note.authorId !== ctx.me.id) return "";
  return `<button type="button" class="${className}" data-bvn-delete-note="${ctx.esc(note.id)}" aria-label="Delete your note">${ctx.esc(label)}</button>`;
}

function noteCard(note, ctx) {
  const author = profile(note.authorId);
  const comments = note.comments || [];
  const reactions = note.reactions || [];
  const liked = reactions.some(item => item.userId === ctx.me.id && item.kind === "heart");
  const hearts = reactions.filter(item => item.kind === "heart").length;
  return `<article class="bvn-feed-card" data-testid="blast-video-note-card">
    <div class="bvn-card-top">${avatar(note.authorId, ctx)}<div class="bvn-card-person"><b>${ctx.esc(author.name)}</b><small>@${ctx.esc(author.username)} · ${ctx.esc(timeLabel(note.createdAt))}</small></div><span class="bvn-audience">${ctx.esc(audienceLabel(note.audience))}</span></div>
    <div class="bvn-feed-media">${mediaButton(note, ctx)}</div>
    ${note.caption ? `<p class="bvn-caption">${ctx.esc(note.caption)}</p>` : `<p class="bvn-note-kind">${note.mediaType === "video" ? "Video note" : "Photo note"}</p>`}
    <div class="bvn-card-actions"><span>${note.mediaType === "video" ? `Video note · ${ctx.esc(formatBlastNoteDuration(note.duration))}` : "Photo note"}</span><div class="bvn-social-actions"><button type="button" class="${liked ? "is-liked" : ""}" data-bvn-react="${ctx.esc(note.id)}" aria-pressed="${liked}" aria-label="${liked ? "Remove heart" : "Heart"} this note">${ctx.icon("heart")} ${hearts}</button><button type="button" data-bvn-open-note="${ctx.esc(note.id)}">${ctx.icon("comment")} Comments · ${comments.length}</button>${deleteNoteButton(note, ctx)}</div></div>
  </article>`;
}

function tabs(ctx, current) {
  return `<nav class="bvn-tabs" aria-label="Blast sections">
    <button type="button" class="${current === "notes" ? "is-active" : ""}" data-bvn-view="notes" ${current === "notes" ? 'aria-current="page"' : ""}>Timeline</button>
    <button type="button" class="${current === "chats" || current === "chat" ? "is-active" : ""}" data-bvn-view="chats" ${current === "chats" || current === "chat" ? 'aria-current="page"' : ""}>Chats</button>
    <button type="button" data-blast-nav="hub">Community</button>
  </nav>`;
}

function header(ctx, current) {
  return `<header class="bvn-header">
    <div><span class="bvn-kicker">MOMENTS &amp; COMMUNITY</span><h1>Blast</h1></div>
    <div class="bvn-header-actions">
      <button class="bvn-icon-button" type="button" data-blast-nav="friends" aria-label="Blast Friends">${ctx.icon("users")}</button>
      <button class="bvn-icon-button" type="button" data-blast-settings-open aria-label="Open Blast settings" aria-expanded="${ctx.settingsOpen === true}" data-testid="blast-settings-open">${ctx.icon("settings")}</button>
    </div>
  </header>${tabs(ctx, current)}`;
}

function momentRail(notes, ctx) {
  const latestByAuthor = new Map();
  [...notes]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .forEach(note => {
      if (!latestByAuthor.has(note.authorId)) latestByAuthor.set(note.authorId, note);
    });
  const moments = [...latestByAuthor.values()].slice(0, 8);
  return `<section class="bvn-moments-section" aria-label="Recent moments">
    <div class="bvn-moments-heading"><div><span class="bvn-kicker">QUICK MOMENTS</span><h2>From your people</h2></div><small>${moments.length} ${moments.length === 1 ? "person" : "people"}</small></div>
    <div class="bvn-moment-row">
      <button type="button" class="bvn-moment" data-bvn-open-camera data-testid="blast-your-moment">
        <span class="bvn-moment-ring bvn-moment-own"><span class="bvn-moment-plus">${ctx.icon("plus")}</span></span><small>Your moment</small>
      </button>
      ${moments.map(note => {
        const person = profile(note.authorId);
        return `<button type="button" class="bvn-moment" data-bvn-open-note="${ctx.esc(note.id)}" aria-label="Open ${ctx.esc(person.name)}'s latest moment">
          <span class="bvn-moment-ring">${avatar(note.authorId, ctx, "bvn-moment-avatar")}</span><small>${ctx.esc(person.name.split(" ")[0])}</small>
        </button>`;
      }).join("")}
    </div>
  </section>`;
}

function timelineEntries(ctx, notes, posts) {
  const entries = [
    ...notes.map(note => ({ kind: "moment", createdAt: new Date(note.createdAt).getTime(), value: note })),
    ...posts.map(post => ({ kind: "post", createdAt: new Date(post.createdAt).getTime(), value: post }))
  ].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  const visible = entries.filter(entry => {
    if (timelineFilter === "moments") return entry.kind === "moment";
    if (timelineFilter === "posts") return entry.kind === "post" && entry.value.type !== "event";
    if (timelineFilter === "events") return entry.kind === "post" && entry.value.type === "event";
    return true;
  });
  return visible.map(entry => entry.kind === "moment"
    ? noteCard(entry.value, ctx)
    : renderBlastTimelinePost(entry.value, ctx)).join("");
}

function notesHome(ctx) {
  const notes = listBlastFeedVideoNotes();
  const posts = listBlastPosts();
  const entryCount = notes.length + posts.length;
  const cards = timelineEntries(ctx, notes, posts);
  const draftBanner = hasBlastNoteDraft() ? `<section class="bvn-draft-banner"><div><b>Unfinished video note</b></div><button type="button" data-bvn-resume-draft>Resume draft</button></section>` : "";
  return `<main class="blast-screen bvn-screen bvn-twitter-feed"><div class="blast-wrap bvn-wrap">
    ${header(ctx, "notes")}
    ${draftBanner}
    ${momentRail(notes, ctx)}
    <section class="bvn-capture-panel">
      <div class="bvn-capture-actions">
        <button class="bvn-record-cta" type="button" data-bvn-open-camera data-testid="blast-record-note">${ctx.icon("camera")}<span>Record a moment</span></button>
        <button class="bvn-library-cta" type="button" data-bvn-open-library>${ctx.icon("image")}<span>Photo or clip</span></button>
        <button class="bvn-library-cta" type="button" data-blast-new="post">${ctx.icon("comment")}<span>Write a post</span></button>
        <button class="bvn-library-cta" type="button" data-blast-new="event">${ctx.icon("calendar")}<span>Plan an event</span></button>
      </div>
    </section>
    <div class="bvn-feed-heading"><div><span class="bvn-kicker">THE LATEST</span><h2>For you</h2></div><span>${entryCount} ${entryCount === 1 ? "update" : "updates"}</span></div>
    <nav class="bvn-feed-filters" aria-label="Filter timeline">
      ${[["all", "All"], ["moments", "Moments"], ["posts", "Posts"], ["events", "Events"]].map(([value, label]) => `<button type="button" class="${timelineFilter === value ? "is-active" : ""}" data-bvn-feed-filter="${value}" aria-pressed="${timelineFilter === value}">${label}</button>`).join("")}
    </nav>
    ${cards || `<section class="bvn-empty"><span class="bvn-empty-icon">${ctx.icon("camera")}</span><h3>${entryCount ? "Nothing here yet" : "No posts yet"}</h3><button type="button" class="bvn-record-cta" data-bvn-open-camera>${ctx.icon("camera")} Record the first moment</button></section>`}
  </div></main>`;
}

function chatsHome(ctx) {
  const chats = listBlastChats();
  const rows = chats.map(chat => {
    const person = profile(chat.peerId);
    const last = chat.lastMessage;
    const preview = !last ? "Start a conversation" : last.kind === "video-note" ? "Video note" : last.body || "Message";
    return `<button class="bvn-chat-row" type="button" data-bvn-open-chat="${ctx.esc(chat.peerId)}">
      ${avatar(chat.peerId, ctx)}<span class="bvn-chat-copy"><b>${ctx.esc(person.name)}</b><small>${ctx.esc(preview)}</small></span>
      <span class="bvn-chat-time">${last ? ctx.esc(timeLabel(last.createdAt)) : ""}</span>${ctx.icon("back")}
    </button>`;
  }).join("");
  return `<main class="blast-screen bvn-screen"><div class="blast-wrap bvn-wrap">
    ${header(ctx, "chats")}
    <div class="bvn-page-heading"><div><span class="bvn-kicker">PRIVATE NOTES</span><h2>Blast chats</h2></div><small>${chats.length} friends</small></div>
    <section class="bvn-chat-list">${rows || `<div class="bvn-empty"><span class="bvn-empty-icon">${ctx.icon("users")}</span><h3>No chats yet</h3><button type="button" class="bvn-record-cta" data-blast-nav="friends">${ctx.icon("users")} Find Blast Friends</button></div>`}</section>
  </div></main>`;
}

function chatThread(view, ctx) {
  const peerId = String(view.peerId || "");
  const person = profile(peerId);
  const messages = listBlastChatMessages(peerId);
  const bubbles = messages.map(message => {
    const mine = message.authorId === ctx.me.id;
    const note = message.kind === "video-note" ? getBlastVideoNote(message.noteId) : null;
    const reply = message.replyToNoteId ? getBlastVideoNote(message.replyToNoteId) : null;
    const deleteAction = note ? deleteNoteButton(note, ctx, "bvn-chat-delete-note", "Delete note") : "";
    const content = note
      ? mediaButton(note, ctx, "bvn-chat-note-preview")
      : `<p>${ctx.esc(message.body || "")}</p>`;
    return `<article class="bvn-chat-message ${mine ? "is-mine" : ""}" data-testid="blast-chat-message">
      ${reply ? `<button class="bvn-reply-quote" type="button" data-bvn-open-note="${ctx.esc(reply.id)}">Replying to a video note</button>` : ""}
      ${content}<small>${ctx.esc(timeLabel(message.createdAt))}</small>${deleteAction}
    </article>`;
  }).join("");
  return `<main class="blast-screen bvn-screen"><div class="blast-wrap bvn-wrap bvn-thread-wrap">
    ${header(ctx, "chats")}
    <div class="bvn-thread-heading"><button class="bvn-back-button" type="button" data-bvn-view="chats" aria-label="Back to chats">${ctx.icon("back")}</button>${avatar(peerId, ctx)}<div><h2>${ctx.esc(person.name)}</h2><small>@${ctx.esc(person.username)} · Blast Friend</small></div>
      <button class="bvn-icon-button" type="button" data-bvn-chat-camera="${ctx.esc(peerId)}" aria-label="Record a video note">${ctx.icon("camera")}</button></div>
    <div class="bvn-thread-messages" aria-label="Conversation with ${ctx.esc(person.name)}">
      ${bubbles || `<div class="bvn-thread-empty"><button type="button" class="bvn-record-cta" data-bvn-chat-camera="${ctx.esc(peerId)}">${ctx.icon("camera")} Record a video note</button></div>`}
    </div>
    <form class="bvn-chat-composer" data-bvn-chat-form="${ctx.esc(peerId)}">
      <button type="button" data-bvn-chat-camera="${ctx.esc(peerId)}" aria-label="Record a video note">${ctx.icon("camera")}</button>
      <input name="message" maxlength="500" aria-label="Message" placeholder="Write a comment or reply" required />
      <button type="submit" aria-label="Send message">${ctx.icon("send")}</button>
    </form>
  </div></main>`;
}

function noteDetail(view, ctx) {
  const note = getBlastVideoNote(view.id);
  if (!note) {
    return `<main class="blast-screen bvn-screen"><div class="blast-wrap bvn-wrap">${header(ctx, "notes")}<section class="bvn-empty"><h3>This video note is unavailable</h3><p>It may have been removed or is no longer visible to you.</p><button class="bvn-library-cta" type="button" data-bvn-view="notes">Back to notes</button></section></div></main>`;
  }
  const author = profile(note.authorId);
  const comments = (note.comments || []).map(comment => {
    const person = profile(comment.authorId);
    return `<article class="bvn-comment">${avatar(comment.authorId, ctx, "bvn-comment-avatar")}<div><b>${ctx.esc(person.name)}</b><small>${ctx.esc(timeLabel(comment.createdAt))}</small><p>${ctx.esc(comment.body)}</p></div></article>`;
  }).join("");
  const reactions = note.reactions || [];
  const liked = reactions.some(item => item.userId === ctx.me.id && item.kind === "heart");
  const hearts = reactions.filter(item => item.kind === "heart").length;
  const media = note.creativeProject ? creativeMediaMarkup(note,ctx.esc) : note.mediaType === "video"
    ? `<video class="bvn-detail-video" data-bvn-media-id="${ctx.esc(note.mediaId)}" controls playsinline preload="metadata" aria-label="Video note"></video>`
    : `<img class="bvn-detail-image" data-bvn-media-id="${ctx.esc(note.mediaId)}" alt="Photo note" />`;
  const isChat = note.channel === "chat";
  const peerId = note.authorId === ctx.me.id ? note.recipientId : note.authorId;
  const deleteAction = deleteNoteButton(note, ctx);
  return `<main class="blast-screen bvn-screen"><div class="blast-wrap bvn-wrap">
    ${header(ctx, isChat ? "chats" : "notes")}
    <button class="bvn-back-link" type="button" ${isChat ? `data-bvn-open-chat="${ctx.esc(peerId)}"` : 'data-bvn-view="notes"'}>${ctx.icon("back")} ${isChat ? "Back to conversation" : "Back to video notes"}</button>
    <article class="bvn-detail-card">
      <div class="bvn-card-top">${avatar(note.authorId, ctx)}<div class="bvn-card-person"><b>${ctx.esc(author.name)}</b><small>${ctx.esc(timeLabel(note.createdAt))}${isChat ? " · Private note" : ` · ${ctx.esc(audienceLabel(note.audience))}`}</small></div></div>
      <div class="bvn-detail-media" ${note.creativeProject?`style="aspect-ratio:${creativeAspect(note.creativeProject)}"`:""}>${media}<svg class="bvn-note-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${overlayMarkup(note.overlays, ctx)}</svg></div>
      ${note.creativeProject&&note.mediaType==="video"?'<button type="button" class="blast-btn" data-bvn-creative-audio aria-pressed="false">Unmute video</button>':""}
      ${note.caption ? `<p class="bvn-caption">${ctx.esc(note.caption)}</p>` : ""}
      ${note.mediaType === "video" ? `<span class="bvn-note-kind">Video note · ${ctx.esc(formatBlastNoteDuration(note.duration))}</span>` : `<span class="bvn-note-kind">Photo note</span>`}
      <div class="bvn-detail-actions"><button type="button" class="bvn-detail-heart ${liked ? "is-liked" : ""}" data-bvn-react="${ctx.esc(note.id)}" aria-pressed="${liked}" aria-label="${liked ? "Remove heart from this note" : "Heart this note"}; ${hearts} hearts">${ctx.icon("heart")}<span>${hearts}</span></button>${deleteAction}</div>
    </article>
    ${isChat ? `<div class="bvn-detail-comments"><div class="bvn-feed-heading"><div><span class="bvn-kicker">PRIVATE CONVERSATION</span><h2>Reply</h2></div></div><form class="bvn-comment-form" data-bvn-chat-detail-form="${ctx.esc(peerId)}" data-reply-note="${ctx.esc(note.id)}"><textarea name="comment" maxlength="500" required placeholder="Write a comment or reply"></textarea><button class="bvn-record-cta" type="submit">Send reply</button></form></div>` : `<div class="bvn-detail-comments">
      <div class="bvn-feed-heading"><div><span class="bvn-kicker">JOIN THE CONVERSATION</span><h2>Comments</h2></div><span>${comments.length}</span></div>
      <div class="bvn-comments">${comments || `<p class="bvn-no-comments">No comments yet.</p>`}</div>
      <form class="bvn-comment-form" data-bvn-comment-form="${ctx.esc(note.id)}"><textarea name="comment" maxlength="500" required placeholder="Write a comment"></textarea><button class="bvn-record-cta" type="submit">Comment</button></form>
    </div>`}
  </div></main>`;
}

export function renderBlastVideoNotes(view, ctx) {
  try {
    if (view.name === "notes") return notesHome(ctx);
    if (view.name === "chats") return chatsHome(ctx);
    if (view.name === "chat") return chatThread(view, ctx);
    if (view.name === "note-detail") return noteDetail(view, ctx);
    return notesHome(ctx);
  } catch (error) {
    const feedTheme = view.name === "notes" ? " bvn-twitter-feed" : "";
    return `<main class="blast-screen bvn-screen${feedTheme}"><div class="blast-wrap bvn-wrap">${header(ctx, "notes")}<section class="bvn-empty" role="alert"><h3>Video notes could not load</h3><p>${ctx.esc(error.message || "Try again.")}</p><button class="bvn-library-cta" type="button" data-bvn-retry>Try again</button></section></div></main>`;
  }
}

async function hydrateMedia(app) {
  const elements = [...app.querySelectorAll("[data-bvn-media-id]")];
  await Promise.all(elements.map(async element => {
    if (element.dataset.bvnLoaded === "true") return;
    const mediaId = element.dataset.bvnMediaId;
    try {
      const url = await getBlastMediaUrl(mediaId);
      if (!url || !element.isConnected) {
        if (element.isConnected) {
          element.dataset.bvnUnavailable = "true";
          element.closest(".bvn-note-preview, .bvn-detail-media")?.classList.add("is-unavailable");
        }
        return;
      }
      element.src = url;
      element.dataset.bvnLoaded = "true";
      if (element instanceof HTMLVideoElement && element.dataset.bvnAutoplay === "true") {
        element.muted = true;
        element.loop = false;
        let loops = 0;
        element.onended = () => {
          loops += 1;
          if (loops < 3) {
            element.currentTime = 0;
            element.play().catch(() => {});
          }
        };
        element.play().catch(() => {});
      }
    } catch {
      if (element.isConnected) {
        element.dataset.bvnUnavailable = "true";
        element.closest(".bvn-note-preview, .bvn-detail-media")?.classList.add("is-unavailable");
      }
    }
  }));
}

export function bindBlastVideoNotes(view, ctx) {
  const { app, toast } = ctx;
  hydrateMedia(app);

  app.querySelectorAll("[data-bvn-view]").forEach(button => {
    button.onclick = () => {
      const next = button.dataset.bvnView;
      ctx.setView(next === "chat" ? { name: "chats" } : next);
    };
  });
  app.querySelectorAll("[data-bvn-feed-filter]").forEach(button => {
    button.onclick = () => {
      timelineFilter = button.dataset.bvnFeedFilter || "all";
      ctx.refresh();
    };
  });
  app.querySelectorAll("[data-bvn-open-camera]").forEach(button => {
    button.onclick = () => ctx.setView({ name: "note-camera", shareContext: { channel: "feed" }, openLibrary: false });
  });
  app.querySelectorAll("[data-bvn-open-library]").forEach(button => {
    button.onclick = () => ctx.setView({ name: "note-camera", shareContext: { channel: "feed" }, openLibrary: true });
  });
  app.querySelectorAll("[data-bvn-open-chat]").forEach(button => {
    button.onclick = () => ctx.setView({ name: "chat", peerId: button.dataset.bvnOpenChat });
  });
  app.querySelectorAll("[data-bvn-chat-camera]").forEach(button => {
    button.onclick = () => ctx.setView({
      name: "note-camera",
      shareContext: { channel: "chat", recipientId: button.dataset.bvnChatCamera },
      returnView: { name: "chat", peerId: button.dataset.bvnChatCamera }
    });
  });
  app.querySelectorAll("[data-bvn-open-note]").forEach(button => {
    button.onclick = () => ctx.setView({ name: "note-detail", id: button.dataset.bvnOpenNote });
  });
  app.querySelectorAll("[data-bvn-react]").forEach(button => {
    button.onclick = () => {
      try {
        toggleBlastVideoNoteReaction(button.dataset.bvnReact);
        ctx.refresh();
      } catch (error) {
        toast(error.message);
      }
    };
  });
  app.querySelectorAll("[data-bvn-delete-note]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this note? This cannot be undone.")) return;
      button.disabled = true;
      try {
        const deleted = deleteBlastVideoNote(button.dataset.bvnDeleteNote);
        let mediaCleanupFailed = false;
        if (deleted.orphanedMediaId) {
          try {
            await deleteBlastMedia(deleted.orphanedMediaId);
          } catch (error) {
            mediaCleanupFailed = true;
            console.warn("Deleted Blast note media could not be cleared from device storage.", error);
          }
        }
        toast(mediaCleanupFailed
          ? "Your note was deleted, but its media could not be removed from this device."
          : "Your note was deleted.");
        if (view.name === "note-detail") {
          ctx.setView(deleted.channel === "chat" ? { name: "chat", peerId: deleted.recipientId } : "notes");
        } else {
          ctx.refresh();
        }
      } catch (error) {
        toast(error.message || "Could not delete your note.");
        if (button.isConnected) button.disabled = false;
      }
    };
  });
  app.querySelectorAll("[data-bvn-retry]").forEach(button => { button.onclick = () => ctx.refresh(); });
  app.querySelector("[data-bvn-resume-draft]")?.addEventListener("click", () => ctx.setView({ name: "note-editor" }));

  app.querySelectorAll("[data-bvn-comment-form]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        addBlastVideoNoteComment(form.dataset.bvnCommentForm, new FormData(form).get("comment"));
        toast("Comment added.");
        ctx.refresh();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  app.querySelectorAll("[data-bvn-chat-detail-form]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        addBlastChatReply(
          form.dataset.bvnChatDetailForm,
          new FormData(form).get("comment"),
          form.dataset.replyNote
        );
        toast("Reply sent.");
        ctx.setView({ name: "chat", peerId: form.dataset.bvnChatDetailForm });
      } catch (error) {
        toast(error.message);
      }
    });
  });
  app.querySelectorAll("[data-bvn-chat-form]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        addBlastChatReply(form.dataset.bvnChatForm, new FormData(form).get("message"));
        ctx.refresh();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}
