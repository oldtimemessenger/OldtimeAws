import "./styles.css";
import "./service-worker-registration.js";
import { api, mutate, fileToData, notify, profileEmailValidationMessage } from "./store.js";
import { openCloudComments } from "./cloud-comments.js";
import { ensureConvo as makeConvo, openChatList, openThread, closeChatTimers } from "./chat.js";
import { mountComms, closeVoiceNote } from "./comms/index.js";
import { icons as ic, icon } from "./icons.js";
import { openEmojiPicker, closeEmojiPicker } from "./emoji.js";
import { extraScreen, settingGroups } from "./experiences.js";
import { renderBlast, setBlastView } from "./blast.js";
import { openSocialSheet } from "./social-sheets-controller.js";
import { openRepostNote } from "./repost-note.js";
import { findSharedComment } from "./shared-content.js";
import { listSavedCollections, listSavedPosts } from "./saved-collections.js";
import { openAudioPanel } from "./audio-panel.js";
import { audioTitle, audioUses } from "./audio-library.js";
import { isLocalMedia, renderMediaUrl, hydrateLocalMedia } from "./local-media.js";
import { finishStartup } from "./startup.js";
import { loginMarkup, signupMarkup } from "./auth-design.js";
import { completeCognitoSignIn, mountCognitoAction, beginCognitoSignIn, logoutAccount } from "./cognito-auth.js";
import "./brand-selection.css";
import { openCreativeEditor } from "./creative-editor.js";
import { creativeMediaMarkup, creativeAttribution, mountCreativeViewers } from "./creative-viewer.js";
import { renderCreatorScreen, resetCreatorScreenState, blueBadgeMarkup, hydrateBlueBadges } from "./creator-center.js";
import { getAccountTools,loadAccountTools,resetAccountTools,renderAccountToolsScreen } from "./account-professional.js";
import { registerOwnActivityContent,trackQualifiedView,recordActivity,recordProfileVisit } from "./activity-tracking.js";
import { scheduleCreatorAnnouncement, resetCreatorAnnouncements } from "./creator-announcement.js";
import { currentCall } from "./comms/calls.js";
import { getRepostView } from "./repost-state.js";
import { renderRepostAffordance, mountRepostAffordances, showRepostPrompt } from "./repost-affordance.js";
import "./flat-surfaces.css";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const brandArtUrl = `${import.meta.env.BASE_URL}brand/old-time-opening.jpeg`;
app.addEventListener("error", event => {
  const media = event.target;
  if (media.tagName === "IMG" && !media.dataset.fallback) {
    media.dataset.fallback = "true";
    media.src = new URL("./avatar.svg", import.meta.url).href;
  }
  if ((media.tagName === "VIDEO" || media.classList?.contains("fullimg")) && media.closest(".clip") && !media.parentElement.querySelector(".media-fallback")) {
    const notice = document.createElement("div");
    notice.className = "media-fallback";
    notice.textContent = "Media unavailable. Check your connection.";
    media.parentElement.appendChild(notice);
  }
}, true);
let tab = "updates";
let creatorSessionAccount = null;
let homeView = "explore";
let homeTopic = "all";
let nearbyCity = "all";
let nearbyLocationStatus = "idle";
let nearbyLocationRequestId = 0;
let profileId = null;
let profileMode = "posts";
let savedCollectionId = "";
let storyTimer = null;
let createKind = "photo";
let pending = [];
let chatId = null;
let profileReturnChatId = null;
let searchQ = "";
let carouselIndex = {};
let muted = true;
let viewer = null;
let profileMore = false;
let settingsView = "home";
let hasPendingSettingsChanges = false;
let selectedCampaignId = null;
let feedObserver = null;
let cameraStream = null;
let cameraFacing = "environment";
let cameraMode = "post";
let cameraGeneration = 0;
let cameraFlashOn = false;
let notificationsOrigin = null;
let notificationsReturnStack = [];
let notificationFilter = "all";
const navigationStack = [];
const watchedPosts = new Set();
let drawerEscapeHandler = null;
let drawerReturnFocus = null;

const HOME_VIEWS = [
  { id: "explore", label: "Explore" },
  { id: "nearby", label: "Places" },
  { id: "following", label: "Following" }
];
const HOME_TOPICS = [
  { id: "all", label: "For You" },
  { id: "interests", label: "Interests" },
  { id: "world", label: "Around the World" },
  { id: "culture", label: "Culture" },
  { id: "comedy", label: "Comedy" },
  { id: "fashion", label: "Fashion" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "music", label: "Music" },
  { id: "beauty", label: "Beauty" },
  { id: "sports", label: "Sports" },
  { id: "art", label: "Art & Design" },
  { id: "pets", label: "Pets" },
  { id: "gaming", label: "Gaming" },
  { id: "learning", label: "Learning" }
];
const PROFILE_INTERESTS = [
  { id: "fitness", label: "Fitness" },
  { id: "running", label: "Running" },
  { id: "basketball", label: "Basketball" },
  { id: "yoga", label: "Yoga" },
  { id: "college", label: "College life" },
  { id: "nursing", label: "Nursing" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "study-groups", label: "Study groups" },
  { id: "gaming", label: "Gaming" },
  { id: "cars", label: "Cars" },
  { id: "music", label: "Music" },
  { id: "photography", label: "Photography" },
  { id: "fashion", label: "Fashion" },
  { id: "food", label: "Food" },
  { id: "tech", label: "Tech" },
  { id: "travel", label: "Travel" },
  { id: "art", label: "Art & design" },
  { id: "pets", label: "Pets" },
  { id: "beauty", label: "Beauty" }
];
const profileInterestName = id => PROFILE_INTERESTS.find(interest => interest.id === id)?.label || id;
const cityMatchKey = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
const HOME_TOPIC_TERMS = {
  world: ["world", "global", "international", "country", "culture", "language", "travel", "heritage"],
  culture: ["culture", "history", "language", "tradition", "festival", "heritage", "community"],
  comedy: ["comedy", "funny", "humor", "humour", "meme", "joke", "laugh", "prank", "standup", "parody"],
  fashion: ["fashion", "style", "outfit", "fit check", "fitcheck", "streetwear", "wardrobe", "clothes"],
  food: ["food", "recipe", "cook", "cooking", "meal", "restaurant", "cafe", "coffee", "noodles", "brunch", "baking"],
  travel: ["travel", "trip", "roadtrip", "road trip", "coast", "tourism", "vacation", "destination", "landscape"],
  music: ["music", "song", "singer", "band", "concert", "dance", "audio", "chorus"],
  beauty: ["beauty", "makeup", "skincare", "hair", "nails"],
  sports: ["sport", "sports", "fitness", "workout", "running", "soccer", "football", "basketball"],
  art: ["art", "design", "drawing", "illustration", "photography", "craft", "creative"],
  pets: ["pet", "pets", "dog", "cat", "animal", "puppy", "kitten"],
  gaming: ["game", "gaming", "gamer", "console", "esports"],
  learning: ["learn", "lesson", "tutorial", "education", "study", "skill"]
};
const PROFILE_INTEREST_TERMS = {
  fitness: ["fitness", "workout", "gym", "exercise"],
  running: ["running", "run", "runner"],
  basketball: ["basketball", "hoops", "nba"],
  yoga: ["yoga"],
  college: ["college", "campus", "university", "school"],
  nursing: ["nursing", "nurse"],
  cybersecurity: ["cybersecurity", "cyber security", "infosec"],
  "study-groups": ["study group", "study", "learning", "learn"],
  gaming: ["gaming", "game", "gamer"],
  cars: ["cars", "car", "drive", "driving", "automotive"],
  music: ["music", "song", "singer", "band", "concert"],
  photography: ["photography", "photo", "camera"],
  fashion: ["fashion", "style", "outfit"],
  food: ["food", "recipe", "cooking", "restaurant", "cafe"],
  tech: ["tech", "technology", "software", "gadgets"],
  travel: ["travel", "trip", "roadtrip", "vacation"],
  art: ["art", "design", "drawing", "illustration"],
  pets: ["pets", "pet", "dog", "cat", "animal"],
  beauty: ["beauty", "makeup", "skincare", "hair"]
};
const DISCOVERY_AREAS = [
  { name: "Miami", lat: 25.7617, lon: -80.1918 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 }
];

const esc = (s = "") => String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n || 0);
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };
const normalizeFeedText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function homePosts() {
  const me = api.me();
  let posts = api.ranked(homeView === "following" ? "following" : "foryou");
  if (homeView === "nearby") {
    const city = nearbyCity === "all" ? "" : normalizeFeedText(nearbyCity || me?.city);
    posts = city ? posts.filter(post => {
      const location = normalizeFeedText(post.location || api.user(post.author)?.city);
      return location === city || location.startsWith(`${city} `);
    }) : posts;
  }
  if (homeTopic === "interests") {
    const selected = new Set(Array.isArray(me?.interests) ? me.interests : []);
    const terms = [...selected]
      .flatMap(id => PROFILE_INTEREST_TERMS[id] || [id])
      .map(normalizeFeedText)
      .filter(Boolean);
    posts = terms.length ? posts.filter(post => {
      const text = ` ${normalizeFeedText([post.caption, post.sound, ...(post.tags || [])].join(" "))} `;
      return terms.some(term => text.includes(` ${term} `));
    }) : [];
  } else if (homeTopic !== "all") {
    const terms = HOME_TOPIC_TERMS[homeTopic] || [];
    posts = posts.filter(post => {
      const text = ` ${normalizeFeedText([post.caption, post.sound, ...(post.tags || [])].join(" "))} `;
      return terms.some(term => text.includes(` ${normalizeFeedText(term)} `));
    });
  }
  return posts;
}

function nearbyAreas() {
  const counts = new Map();
  api.posts().forEach(post => {
    const rawLocation = postPlaceValue(post);
    const normalized = normalizeFeedText(rawLocation);
    if (!normalized) return;
    const curated = DISCOVERY_AREAS.find(area => {
      const key = normalizeFeedText(area.name);
      return normalized === key || normalized.startsWith(`${key} `);
    });
    const name = curated?.name || String(rawLocation).trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => {
    const ai = DISCOVERY_AREAS.findIndex(area => area.name === a.name);
    const bi = DISCOVERY_AREAS.findIndex(area => area.name === b.name);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name);
  });
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function requestNearbyLocation() {
  if (nearbyLocationStatus === "requesting") return;
  if (!navigator.geolocation) {
    nearbyLocationStatus = "unavailable";
    render();
    toast("Location isn’t available. Browse the areas below.");
    return;
  }
  const requestId = ++nearbyLocationRequestId;
  nearbyLocationStatus = "requesting";
  render();
  try {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (requestId !== nearbyLocationRequestId) return;
      const closest = DISCOVERY_AREAS.map(area => ({
        ...area,
        distance: distanceKm(coords.latitude, coords.longitude, area.lat, area.lon)
      })).sort((a, b) => a.distance - b.distance)[0];
      if (closest?.distance <= 100) {
        nearbyCity = closest.name;
        nearbyLocationStatus = "located";
        toast(`Showing posts near ${closest.name}`);
      } else {
        nearbyCity = "all";
        nearbyLocationStatus = "available";
        toast("No nearby area yet. Explore the available areas below.");
      }
      render();
    }, error => {
      if (requestId !== nearbyLocationRequestId) return;
      nearbyCity = "all";
      nearbyLocationStatus = error?.code === 1 ? "denied" : "unavailable";
      render();
      toast("Location off. Browse the available areas below.");
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  } catch {
    if (requestId !== nearbyLocationRequestId) return;
    nearbyLocationStatus = "unavailable";
    nearbyCity = "all";
    render();
    toast("Location isn’t available. Browse the areas below.");
  }
}

function homeEmptyMessage(me) {
  const topic = HOME_TOPICS.find(item => item.id === homeTopic)?.label;
  if (homeView === "nearby" && nearbyCity !== "all") return `No posts near ${nearbyCity || me.city} yet. Try another area.`;
  if (homeTopic === "interests" && !me.interests?.length) return "Choose interests to find posts about the things you care about.";
  if (homeTopic !== "all") {
    const scope = homeView === "nearby" ? `near ${nearbyCity === "all" ? "these areas" : nearbyCity}` : homeView === "following" ? "from people you follow" : "in Explore";
    return `No ${topic?.toLowerCase() || "topic"} posts ${scope} yet. Try another topic.`;
  }
  if (homeView === "nearby") return "No nearby posts yet. Choose another area or explore everything.";
  if (homeView === "following") return "Posts from people you follow will appear here.";
  return "Nothing in Explore yet.";
}

function copyText(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  ta.remove();
  return copied;
}
async function copyShareLink(url) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {}
  return copyText(url);
}
async function shareExternally({ title, text, url }) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  return await copyShareLink(url) ? "copied" : "failed";
}
function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1600);
}
function shell(inner, mode, { hideNav = false } = {}) {
  mountRepostAffordances(null);
  resetCreatorAnnouncements();
  closeEmojiPicker();
  const conversation = $("#msgs")?.dataset.convo;
  closeVoiceNote(!conversation || !inner.includes(`data-convo="${conversation}"`));
  closeChatTimers();
  clearInterval(storyTimer);
  feedObserver?.disconnect();
  const light = mode === "light";
  const communitiesScreen = inner.includes("community-screen");
  const profileScreen = inner.includes("profile-screen");
  const mediaFeedScreen = inner.includes("home-screen") || inner.includes('<div class="feed">');
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mediaFeedScreen ? "#090a0c" : "#ffffff");
  const me = api.me();
  app.innerHTML = `<div class="stage"><div class="phone ${light ? "light" : ""} ${communitiesScreen ? "stories-phone" : ""} ${mediaFeedScreen ? "media-feed-phone" : ""}">
    ${inner}
    <nav class="nav ${light ? "lightnav" : ""} ${profileScreen ? "profile-nav" : ""} ${hideNav ? "nav-hidden" : ""}" aria-label="Primary navigation">
      <button type="button" data-tab="updates" class="${tab === "updates" && !profileId ? "on" : ""}" aria-label="Home">${ic.home}<span>Home</span></button>
      <button type="button" data-tab="blast" class="${tab === "blast" ? "on" : ""}" aria-label="Blast">${ic.timeCircle}<span>Blast</span></button>
      <button type="button" data-tab="communities" class="${tab === "communities" ? "on" : ""}" aria-label="Communities">${ic.users}<span>Communities</span></button>
      <button type="button" data-tab="chat" class="${tab === "chat" ? "on" : ""}" aria-label="Messages">${ic.comment}<span>Messages</span></button>
      <button type="button" data-tab="profile" class="${tab === "updates" && profileId === me.id ? "on" : ""}" aria-label="Profile">${ic.user}<span>Profile</span></button>
    </nav>
    <div class="app-drawer" id="app-drawer" hidden aria-hidden="true">
      <button class="drawer-scrim" id="drawer-scrim" type="button" aria-label="Close menu"></button>
      <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Oldtime navigation">
        <header class="drawer-header">
          <button type="button" class="drawer-account" data-drawer-route="profile" data-testid="button-drawer-profile">
            <img src="${esc(me.avatar || "")}" alt="" />
            <span><b>${esc(me.name || me.username)}</b><small>@${esc(me.username)}</small></span>
            <span class="drawer-chevron" aria-hidden="true">›</span>
          </button>
          <button type="button" class="drawer-close" id="drawer-close" data-testid="button-close-app-menu" aria-label="Close menu">${ic.close}</button>
        </header>
        <div class="drawer-links">
          <p class="drawer-label">Explore</p>
          <button type="button" class="drawer-link" data-drawer-route="${getAccountTools().accountType==="creator"?"creator-studio":getAccountTools().accountType==="business"?"business-dashboard":"personal-activity"}">${ic.user}<span>${getAccountTools().accountType==="creator"?"Creator Studio":getAccountTools().accountType==="business"?"Business Dashboard":"Your activity"}</span></button>
          <button type="button" class="drawer-link" data-drawer-route="announcements">${ic.bell}<span>Announcements</span></button>
          <button type="button" class="drawer-link ${tab === "updates" && !profileId ? "active" : ""}" data-drawer-route="updates" data-testid="button-drawer-home">${ic.home}<span>Home</span></button>
          <button type="button" class="drawer-link ${tab === "search" ? "active" : ""}" data-drawer-route="search" data-testid="button-drawer-search">${ic.search}<span>Search</span></button>
          <button type="button" class="drawer-link ${tab === "chat" ? "active" : ""}" data-drawer-route="chat" data-testid="button-drawer-messages">${ic.comment}<span>Messages</span></button>
          <button type="button" class="drawer-link ${tab === "communities" ? "active" : ""}" data-drawer-route="communities" data-testid="button-drawer-communities">${ic.users}<span>Communities</span></button>
          <button type="button" class="drawer-link ${tab === "notes" ? "active" : ""}" data-drawer-route="notes" data-testid="button-drawer-notifications">${ic.bell}<span>Notifications</span></button>
          <div class="drawer-divider"></div>
          <p class="drawer-label">Create</p>
          <button type="button" class="drawer-link" data-drawer-action="post" data-testid="button-drawer-create-post">${ic.plus}<span>Create a post</span></button>
          <button type="button" class="drawer-link" data-drawer-action="quote" data-testid="button-drawer-create-quote">${ic.edit}<span>Write a quote</span></button>
          <div class="drawer-divider"></div>
          <p class="drawer-label">Account</p>
          <button type="button" class="drawer-link ${profileId === me.id ? "active" : ""}" data-drawer-route="profile" data-testid="button-drawer-my-profile">${ic.user}<span>My profile</span></button>
          <button type="button" class="drawer-link ${tab === "settings" ? "active" : ""}" data-drawer-route="settings" data-testid="button-drawer-settings">${ic.settings}<span>Settings</span></button>
        </div>
        <div class="drawer-footer"><span>OLDTIME</span><small>Share moments. Stay connected.</small></div>
      </aside>
    </div>
    <div class="toast" role="status"></div>
    <div class="sheet" id="sheet"></div>
    <div class="storyview" id="storyview"></div>
  </div></div>`;
  $("#drawer-close") && ($("#drawer-close").onclick = closeAppDrawer);
  $("#drawer-scrim") && ($("#drawer-scrim").onclick = closeAppDrawer);
  app.querySelectorAll("[data-drawer-route]").forEach(button => {
    button.onclick = () => {
      if (hasPendingSettingsChanges && !confirm("Discard your unsaved settings changes?")) return;
      hasPendingSettingsChanges = false;
      navigateFromDrawer(button.dataset.drawerRoute);
    };
  });
  app.querySelectorAll("[data-drawer-action]").forEach(button => {
    button.onclick = () => {
      if (hasPendingSettingsChanges && !confirm("Discard your unsaved settings changes?")) return;
      hasPendingSettingsChanges = false;
      const action = button.dataset.drawerAction;
      closeAppDrawer();
      if (action === "quote") openCreate([], "text");
      else openCreate();
    };
  });
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    if (hasPendingSettingsChanges && !confirm("Discard your unsaved settings changes?")) return;
    hasPendingSettingsChanges = false;
    const nextTab = b.dataset.tab === "profile" ? "updates" : b.dataset.tab;
    if (tab !== nextTab || profileId || chatId || viewer) navigationStack.push(captureNavigationState());
    profileReturnChatId = null;
    notificationsOrigin = null;
    notificationsReturnStack = [];
    tab = b.dataset.tab;
    settingsView = "home";
    viewer = null;
    if (tab === "profile") { profileId = api.me().id; tab = "updates"; profileMode = "posts"; }
    else { chatId = null; profileId = null; viewer = null; }
    render();
  });
  const createButton = $("#create-open");
  if (createButton) createButton.onclick = () => {
    openCreate();
  };
  app.querySelectorAll('#back, #playall').forEach(button => {
    const symbols = { "←": ["back", "Back"], "✕": ["close", "Close"], "▶": ["play", "Play"] };
    const replacement = symbols[button.textContent.trim()];
    if (replacement) { button.innerHTML = icon(replacement[0]); button.setAttribute("aria-label", replacement[1]); }
  });
  app.querySelectorAll("[data-creator-open]").forEach(button => button.onclick = () => navigateFromDrawer(button.dataset.creatorOpen));
  void hydrateBlueBadges(app);
  if (mediaFeedScreen && tab === "updates" && !profileId && !viewer) {
    scheduleCreatorAnnouncement({ app, esc, navigate: navigateFromDrawer, accountId: api.cloudAccountId(),
      isSafe: () => tab === "updates" && !profileId && !viewer && !chatId && !currentCall()
        && !document.hidden && !$("#sheet.on, #storyview.on, .creative-editor, .app-drawer.on, .emoji-overlay")
        && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
        && !document.activeElement?.isContentEditable });
  }
}
function captureNavigationState() {
  return { tab, homeView, homeTopic, nearbyCity, profileId, profileMode, chatId, profileReturnChatId, viewer, settingsView, searchQ };
}
function openAppDrawer() {
  const drawer = $("#app-drawer");
  if (!drawer) return;
  drawerReturnFocus = document.activeElement;
  drawer.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => { if (!drawer.hidden) drawer.classList.add("on"); });
  $("#drawer-close")?.focus();
  drawerEscapeHandler = event => {
    if (event.key === "Escape") closeAppDrawer();
  };
  document.addEventListener("keydown", drawerEscapeHandler);
}
function closeAppDrawer() {
  const drawer = $("#app-drawer");
  if (drawer) {
    drawer.classList.remove("on");
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
  }
  if (drawerEscapeHandler) {
    document.removeEventListener("keydown", drawerEscapeHandler);
    drawerEscapeHandler = null;
  }
  const focusTarget = drawerReturnFocus?.isConnected ? drawerReturnFocus : $("#settings-open, #stories-more");
  drawerReturnFocus = null;
  focusTarget?.focus({ preventScroll: true });
}
function navigateFromDrawer(route) {
  closeAppDrawer();
  if (route === "notes") {
    if (tab !== "notes") openNotifications();
    return;
  }
  if (route === "settings" && tab === "settings") {
    settingsView = "home";
    render();
    return;
  }
  if (route === "profile" && tab === "updates" && profileId === api.me().id) return;
  if (route !== "settings" && route === tab && !profileId && !chatId && !viewer) return;

  navigationStack.push(captureNavigationState());
  profileReturnChatId = null;
  notificationsOrigin = null;
  notificationsReturnStack = [];
  settingsView = "home";
  viewer = null;
  if (route === "profile") {
    tab = "updates";
    profileId = api.me().id;
    profileMode = "posts";
    chatId = null;
  } else {
    const supportRoute=route==="help"||route.startsWith("help-");
    tab = supportRoute?"settings":route;
    if(supportRoute)settingsView=route;
    profileId = null;
    chatId = null;
  }
  render();
}
function restoreNavigationState(state) {
  if (!state) return;
  ({ tab, homeView, homeTopic, nearbyCity, profileId, profileMode, chatId, profileReturnChatId, viewer, settingsView, searchQ } = state);
}
function navigateBack() {
  const previous = navigationStack.pop();
  if (!previous) return false;
  restoreNavigationState(previous);
  render();
  return true;
}
function navigateToProfile(id, { fromChat = false } = {}) {
  recordProfileVisit(id,fromChat?"direct":viewer?"content":tab==="search"?"search":tab==="communities"?"community":"direct");
  if (notificationsReturnStack.length) notificationsReturnStack.push(captureNavigationState());
  else navigationStack.push(captureNavigationState());
  if (fromChat) profileReturnChatId = chatId;
  else profileReturnChatId = null;
  profileId = id;
  profileMode = "posts";
  tab = "updates";
  viewer = null;
  render();
}
function openPostViewer(id, commentId = "") {
  if (notificationsReturnStack.length) notificationsReturnStack.push(captureNavigationState());
  else navigationStack.push(captureNavigationState());
  viewer = id;
  profileId = null;
  tab = "updates";
  render();
  if (commentId) comments(id, commentId);
}
function openNotifications() {
  notificationsOrigin = captureNavigationState();
  notificationsReturnStack = [];
  tab = "notes";
  profileId = null;
  chatId = null;
  viewer = null;
  render();
}
function backFromNotificationDetail() {
  const previous = notificationsReturnStack.pop();
  if (!previous) return false;
  restoreNavigationState(previous);
  render();
  return true;
}
function leaveNotifications() {
  const previous = notificationsOrigin || { tab: "updates", homeView, homeTopic, profileId: null, profileMode, chatId: null, profileReturnChatId: null, viewer: null, settingsView };
  notificationsOrigin = null;
  notificationsReturnStack = [];
  restoreNavigationState(previous);
  render();
}
let toolsOwner=null,toolsReady=false,toolsLoading=false,toolsAttempt=0;
function ensureAccountTools(){
  const account=api.cloudAccountId();
  if(account!==toolsOwner){toolsOwner=account;toolsReady=false;toolsLoading=false;toolsAttempt=0;resetAccountTools();}
  if(!account||toolsReady||toolsLoading||Date.now()-toolsAttempt<30000)return;
  toolsLoading=true;toolsAttempt=Date.now();
  void loadAccountTools().then(()=>{
    if(api.cloudAccountId()!==account)return;
    toolsReady=true;
    mutate(db=>{const user=db.users.find(u=>u.id===api.me()?.id);if(user)user.professional={...getAccountTools()};});
    render();
  }).catch(()=>{}).finally(()=>{if(api.cloudAccountId()===account)toolsLoading=false;});
}
window.addEventListener("oldtime-account-tools",()=>{
  if(!api.me())return;
  mutate(db=>{const user=db.users.find(u=>u.id===api.me().id);if(user)user.professional={...getAccountTools()};});
  // The switching screen controls its own navigation; do not unmount its
  // confirmation/success flow before the successful handler completes.
});
function render() {
  ensureAccountTools();
  registerOwnActivityContent();
  const creatorAccount = api.cloudAccountId();
  if (creatorAccount !== creatorSessionAccount) {
    resetCreatorScreenState();
    resetCreatorAnnouncements();
    creatorSessionAccount = creatorAccount;
  }
  if (!api.me() || !api.cloudAccountId()) return auth();
  if (tab === "live") {
    tab = "updates";
    profileId = null;
  }
  mountComms({ toast, esc });
  if (viewer) return postViewer(viewer);
  if (tab === "updates" && profileId) return profile(profileId);
  if (tab === "updates") return updates();
  if (tab === "chat") return chatId ? thread(chatId) : chats();
  if (tab === "communities") return communities();
  if (tab === "blast") return renderBlast({ shell, app, toast, esc, onOpenPost: openPostViewer });
  if (tab === "search") return search();
  if (tab === "notes") return notes();
  if (tab === "settings") return settings();
  if (["account-type","personal-activity","creator-studio","business-dashboard","monthly-recap","best-practices","inspiration"].includes(tab)) {
    return renderAccountToolsScreen(tab,{shell,app,toast,esc,navigate:navigateFromDrawer,back:()=>{if(!navigateBack()){tab="settings";render();}}});
  }
  if (["creator-center", "blue-badge", "announcements", "creator-admin"].includes(tab)) {
    return renderCreatorScreen(tab, { shell, app, toast, esc, accountType:getAccountTools().accountType,
      navigate: navigateFromDrawer, back: () => { if (!navigateBack()) { tab = "updates"; render(); } } });
  }
  if (tab === "profile-edit") return editProfilePage();
  updates();
}
function auth() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
  app.innerHTML = loginMarkup(brandArtUrl);
  void mountCognitoAction($("#cognito-sign-in"), { onError: message => { if ($("#err")) $("#err").textContent = message; } });
  $("#login-form").onsubmit = async event => {
    event.preventDefault();
    const button = $("#login");
    const error = $("#err");
    button.disabled = true;
    error.textContent = "";
    try {
      const mode = await api.login($("#email").value.trim(), $("#pass").value);
      render();
    } catch (e) {
      error.textContent = e.message;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
  $("#signup").onclick = signup;
}
function signup() {
  app.innerHTML = signupMarkup(brandArtUrl);
  void mountCognitoAction($("#cognito-sign-in"), { onError: message => { if ($("#err")) $("#err").textContent = message; } });
  $("#back").onclick = auth;
  $("#signup-form").onsubmit = async event => {
    event.preventDefault();
    const button = $("#go");
    const error = $("#err");
    button.disabled = true;
    error.textContent = "";
    try {
      await api.signup({ email: $("#su-email").value.trim(), username: $("#su-user").value.trim(), name: $("#su-name").value.trim(), password: $("#su-pass").value, birthday: $("#su-bday").value, bio: $("#su-bio").value.trim() });
      render();
    } catch (e) {
      error.textContent = e.message;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
}
function updates() {
  const initialCloudStatus = api.cloudFeedStatus();
  if (api.authMode() === "cloud" && !initialCloudStatus.loaded && !initialCloudStatus.loading && !initialCloudStatus.error) {
    void api.migrateCloudTextPosts().catch(() => null).then(() => api.refreshCloudFeed()).then(() => {
      if (tab === "updates" && settingsView === "home") render();
    }).catch(() => {
      if (tab === "updates" && settingsView === "home") render();
    });
  }
  const previousFeed = $("#feed");
  const activePost = previousFeed?.children[Math.round(previousFeed.scrollTop / (previousFeed.clientHeight || 1))]?.dataset.id;
  const me = api.me();
  const stories = api.db().stories.filter(s => Date.now() - s.created < 864e5 && api.canSeeStory(s));
  const byAuthor = new Map();
  stories.forEach(s => { if (!byAuthor.has(s.author)) byAuthor.set(s.author, s); });
  const posts = homePosts();
  const areas = nearbyAreas();
  const allAreaCount = areas.reduce((sum, area) => sum + area.count, 0);
  const cloudStatus = api.cloudFeedStatus();
  const cloudEmpty = api.authMode() === "cloud" && !api.cloudPosts().length
    ? cloudStatus.loading
      ? `<div class="empty" role="status">Loading online posts…</div>`
      : cloudStatus.error
        ? `<div class="empty" role="status"><p>Couldn’t load online posts.</p><button type="button" id="cloud-feed-retry">Try again</button></div>`
        : null
    : null;
  const homeEmpty = homeTopic === "interests"
    ? `<div class="interest-feed-empty"><div class="interest-feed-mark" aria-hidden="true">◎</div><b>${me.interests?.length ? "Your interests, your feed" : "Find posts around what you love"}</b><p>${me.interests?.length ? "There aren’t any posts matching your interests yet. Add another interest or check back soon." : "Choose a few interests to personalize this feed and find people who share them."}</p><button type="button" id="edit-home-interests">${me.interests?.length ? "Edit interests" : "Choose interests"}</button></div>`
    : homeView === "nearby"
      ? `<div class="nearby-feed-empty"><div class="interest-feed-mark" aria-hidden="true">⌖</div><b>${esc(homeEmptyMessage(me))}</b><p>Pick an area or switch to all areas to find more posts.</p><button type="button" data-nearby-area="all">Explore all areas</button></div>`
    : `<div class="empty">${esc(homeEmptyMessage(me))}</div>`;
  const unread = api.db().notes.filter(n => n.user === me.id && !n.read).length;
  shell(`<section class="screen on home-screen">
     <div class="feed" id="feed">${posts.map(postCard).join("") || cloudEmpty || homeEmpty}</div>
    <header class="home-discovery-header">
      <div class="home-primary-row">
        <nav class="home-view-tabs" role="tablist" aria-label="Home feed views">
          ${HOME_VIEWS.map(view => `<button type="button" role="tab" class="home-view-tab ${homeView === view.id ? "on" : ""}" data-home-view="${view.id}" aria-selected="${homeView === view.id}" title="${view.id === "nearby" ? `Nearby posts around ${esc(me.city || "your profile city")}` : view.label}">${view.label}</button>`).join("")}
        </nav>
        <span class="home-header-actions">
          <button class="icon" data-tab="search" aria-label="Search" title="Search">${ic.search}</button>
          <button class="icon" id="create-open" aria-label="Create" title="Create">${ic.camera}</button>
          <button class="icon" id="bell" aria-label="Notifications">${ic.bell}${unread ? '<i class="badge"></i>' : ""}</button>
        </span>
      </div>
      <nav class="home-topic-tabs" role="tablist" aria-label="Explore topics">
        ${HOME_TOPICS.map(topic => `<button type="button" role="tab" class="home-topic-tab ${homeTopic === topic.id ? "on" : ""}" data-home-topic="${topic.id}" aria-selected="${homeTopic === topic.id}">${esc(topic.label)}</button>`).join("")}
      </nav>
      ${homeView === "nearby" ? `<div class="nearby-controls">
        <div class="nearby-location-line">
          <span class="nearby-location-label" aria-live="polite">${nearbyLocationStatus === "requesting" ? "Finding your area…" : nearbyCity === "all" ? "Explore posts by area" : `Near ${esc(nearbyCity)}`}</span>
          <button type="button" class="nearby-location-button" data-nearby-locate ${nearbyLocationStatus === "requesting" ? "disabled" : ""}>${nearbyLocationStatus === "requesting" ? "Finding…" : nearbyLocationStatus === "located" ? "Refresh" : "Use my location"}</button>
        </div>
        <nav class="nearby-area-list" aria-label="Choose a nearby area">
          <button type="button" class="nearby-area-chip ${nearbyCity === "all" ? "on" : ""}" data-nearby-area="all" aria-pressed="${nearbyCity === "all"}">All areas <small>${allAreaCount}</small></button>
          ${areas.map(area => `<button type="button" class="nearby-area-chip ${nearbyCity === area.name ? "on" : ""}" data-nearby-area="${esc(area.name)}" aria-pressed="${nearbyCity === area.name}">${esc(area.name)} <small>${area.count}</small></button>`).join("")}
        </nav>
      </div>` : ""}
    </header>
     <div class="stories home-stories" style="position:absolute;left:0;right:0;z-index:4;${homeView === "nearby" ? "top:calc(max(16px,env(safe-area-inset-top,0px)) + 142px)" : ""}">${[me.id, ...byAuthor.keys()].filter((id, i, arr) => arr.indexOf(id) === i).map(id => {
      const u = api.user(id);
      const story = byAuthor.get(id);
      const ringClass = ["ring", story ? "" : "seen", isCloseFriendsStory(story) ? "close-friends" : ""].filter(Boolean).join(" ");
      return `<button class="story" data-story="${id}"><div class="${ringClass}"><img src="${u.avatar}" alt="" /></div><span class="story-name">${esc(u.username)}</span></button>`;
    }).join("")}</div>
  </section>`);
  $("#bell").onclick = openNotifications;
  $("#cloud-feed-retry") && ($("#cloud-feed-retry").onclick = async () => {
    try { await api.refreshCloudFeed(); render(); }
    catch { render(); }
  });
  $("#edit-home-interests") && ($("#edit-home-interests").onclick = openEditProfile);
  app.querySelectorAll("[data-story]").forEach(b => b.onclick = () => openStory(b.dataset.story));
  $("#create-open").onclick = openCameraLanding;
  app.querySelectorAll("[data-home-view]").forEach(b => b.onclick = () => {
    const enteringNearby = b.dataset.homeView === "nearby" && homeView !== "nearby";
    homeView = b.dataset.homeView;
    render();
    if (enteringNearby && nearbyLocationStatus === "idle") requestNearbyLocation();
  });
  app.querySelectorAll("[data-home-topic]").forEach(b => b.onclick = () => { homeTopic = b.dataset.homeTopic; render(); });
  app.querySelectorAll("[data-nearby-area]").forEach(button => button.onclick = () => {
    nearbyLocationRequestId++;
    nearbyCity = button.dataset.nearbyArea || "all";
    render();
  });
  app.querySelector("[data-nearby-locate]")?.addEventListener("click", requestNearbyLocation);
  bindPosts();
  if (activePost) {
    const active = [...$("#feed").children].find(el => el.dataset.id === activePost);
    if (active) $("#feed").scrollTop = active.offsetTop;
  }
}
function observeVideos() {
  const vids = [...app.querySelectorAll(".clip video")];
  feedObserver = new IntersectionObserver((ents) => ents.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) { v.muted = muted; v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.65 });
  vids.forEach(v => {
    const item=api.post(v.dataset.id);if(item)trackQualifiedView(item,v.closest(".clip")||v,"feed");
    feedObserver.observe(v);
    v.ontimeupdate = () => { const p = api.db().posts.find(p => p.id === v.dataset.id); if (p?.trim && v.currentTime >= p.trim) v.currentTime = 0; };
  });
}
function postCard(p) {
  p=getRepostView(p,api.db());
  const u = api.user(p.author);
  if (!u) return "";
  const me = api.me();
  const liked = p.likes.includes(me.id);
  const likeCount = Number.isFinite(p.likeCount) ? p.likeCount : p.likes.length;
  const saved = p.saves.includes(me.id);
  const reposted = (p.reposts || []).includes(me.id);
  const repostFaces = renderRepostAffordance(p,{esc});
  const following = !p.cloud && (me.following.includes(u.id) || u.id === me.id);
  const media = p.creativeProject ? creativeMediaMarkup(p, esc) : p.kind === "video"
    ? `<video ${isLocalMedia(p.media[0]) ? `data-local-media="${esc(p.media[0])}"` : `src="${esc(renderMediaUrl(p.media[0]))}"`} data-id="${p.id}" data-dbl="${p.id}" loop playsinline preload="metadata" ${muted ? "muted" : ""}></video>`
    : p.kind === "text"
      ? `<div class="textpost" style="height:100%"><p>${esc(p.caption)}</p></div>`
      : `<img class="fullimg" src="${p.media[carouselIndex[p.id] || 0]}" alt="" data-dbl="${p.id}" />`;
  const actions = p.cloud
    ? `<button class="act ${liked ? "on" : ""}" data-like="${p.id}" aria-label="Like post" aria-pressed="${liked}">${ic.heartOn}${fmt(likeCount)}</button>
       <button class="act" data-comment="${p.id}" aria-label="Comments">${ic.commentFilled}</button>
       <button class="act ${reposted ? "on" : ""}" data-repost="${p.id}" aria-label="${reposted ? "Edit your repost" : "Repost"}" aria-pressed="${reposted}">${ic.repost}${fmt(p.reposts.length)}</button>
       <button class="act" data-share="${p.id}" aria-label="Share post">${ic.share}</button>`
    : `<button class="act ${liked ? "on" : ""}" data-like="${p.id}" aria-label="Like post" aria-pressed="${liked}">${ic.heartOn}${fmt(likeCount)}</button>
       <button class="act" data-comment="${p.id}" aria-label="Comments">${ic.commentFilled}${fmt(p.comments.length)}</button>
       <button class="act ${reposted ? "on" : ""}" data-repost="${p.id}" aria-label="${reposted ? "Edit your repost" : "Repost"}" aria-pressed="${reposted}">${ic.repost}${fmt(p.reposts?.length || 0)}</button>
       <button class="act ${saved ? "on" : ""}" data-save="${p.id}" aria-label="${saved ? "Remove saved post" : "Save post"}" aria-pressed="${saved}">${saved ? ic.bookmarkOn : ic.bookmark}${fmt(p.saves.length)}</button>
       <button class="act" data-share="${p.id}" aria-label="Share post">${ic.share}${fmt(p.shares || 0)}</button>`;
  return `<article class="clip" data-id="${p.id}">${media}<div class="shade"></div>
    <div class="rail">
      ${actions}
      ${p.kind === "video" ? `<button class="act" data-mute="${p.id}" aria-label="${muted ? "Unmute" : "Mute"} video">${muted ? ic.mute : ic.volume}</button>` : ""}
    </div>
    ${p.kind === "carousel" ? `<div class="carousel-nav">${p.media.map((_, i) => `<button data-dot="${p.id}:${i}" aria-label="Photo ${i + 1} of ${p.media.length}" aria-pressed="${i === (carouselIndex[p.id] || 0)}" class="${i === (carouselIndex[p.id] || 0) ? "on" : ""}"></button>`).join("")}</div>` : ""}
    <div class="meta" tabindex="0" aria-label="Post details">
      ${postPlaceCard(p)}
      ${repostFaces}
      <div class="handle"><img src="${u.avatar}" alt="" class="avatar" /> ${p.cloud ? `<span>${esc(u.name)}</span>` : `<button data-profile="${u.id}">${esc(u.name)}</button>`}${blueBadgeMarkup(u.cloudAccountId || u.id, esc)} ${following ? "" : p.cloud ? "" : `<button class="followpill" data-follow="${u.id}">Follow</button>`}</div>
      <div class="cap">${esc(p.caption)}</div>
      ${p.creativeProject ? creativeAttribution(p, esc) : ""}
    </div>
    <button type="button" class="soundbar" data-audio-open="${esc(p.id)}" aria-label="Open audio, library and remix">
      <img src="${u.avatar}" alt="" />
      <div><b>${esc(audioTitle(p))}</b><div class="sub">▶ ${fmt(audioUses(p))} uses</div></div>
    </button>
  </article>`;
}
function postPlaceValue(post) {
  return String(post?.location || "").trim();
}
function postPlaceCard(post) {
  const place = postPlaceValue(post);
  if (!place) return "";
  const key = cityMatchKey(place);
  const people = new Set(api.posts()
    .filter(candidate => cityMatchKey(postPlaceValue(candidate)) === key)
    .map(candidate => candidate.author));
  const count = people.size;
  return `<div class="clip-place">
    <span class="clip-place-label">Nearby creators</span>
    <button type="button" class="clip-place-card" data-place-explore="${esc(place)}" aria-label="Explore ${esc(place)}">
      <span class="clip-place-icon">${ic.location}</span>
      <span class="clip-place-copy"><b>${esc(place)}</b><small>${fmt(count)} ${count === 1 ? "person" : "people"} posted here · Explore now</small></span>
      <span class="clip-place-arrow" aria-hidden="true">›</span>
    </button>
  </div>`;
}
function head(u, following, p) {
  return `<div class="handle"><img src="${u.avatar}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /> <button data-profile="${u.id}">@${u.username}</button>${blueBadgeMarkup(u.cloudAccountId || u.id, esc)} ${following ? "" : `<button class="followchip" data-follow="${u.id}">Follow</button>`}</div>`;
}
function rail(p, liked, saved) {
  const me = api.me();
  const reposts = p.reposts || [];
  const reposted = reposts.includes(me.id);
  return `<div class="rail">
    <button class="act ${liked ? "on" : ""}" data-like="${p.id}" aria-label="Like post">${ic.heartOn}${fmt(p.likes.length)}</button>
    <button class="act" data-comment="${p.id}" aria-label="Comments">${ic.commentFilled}${fmt(p.comments.length)}</button>
    <button class="act ${reposted ? "on" : ""}" data-repost="${p.id}" aria-label="Repost post" aria-pressed="${reposted}">${ic.repost}${fmt(reposts.length)}</button>
    <button class="act ${saved ? "on" : ""}" data-save="${p.id}"><span class="bubble">${saved ? ic.bookmarkOn : ic.bookmark}</span>${fmt(p.saves.length)}</button>
    <button class="act" data-mute="${p.id}"><span class="bubble">${muted ? ic.mute : ic.volume}</span></button>
    <img class="avatar" src="${api.user(p.author).avatar}" data-profile="${p.author}" alt="" />
  </div>`;
}
function bindPosts() {
  mountRepostAffordances(app);
  app.querySelectorAll("article.clip").forEach(element=>{
    if(element.querySelector("video"))return;
    const item=api.post(element.dataset.id);if(item)trackQualifiedView(item,element,tab==="communities"?"community":"feed");
  });
  observeVideos();
  void hydrateLocalMedia(app);
  mountCreativeViewers(app, { onSource: openPostViewer, muted });
  app.querySelectorAll("[data-audio-open]").forEach(button => button.onclick = event => {
    event.stopPropagation();
    openAudioPanel({
      postId: button.dataset.audioOpen, sheet: $("#sheet"), esc, icons: ic, toast, onClose: render,
      onPosted: () => { tab = "updates"; profileId = null; viewer = null; render(); }
    });
  });
  app.querySelectorAll("[data-like]").forEach(b => b.onclick = (e) => { e.stopPropagation(); like(b.dataset.like); });
  app.querySelectorAll("[data-save]").forEach(b => b.onclick = (e) => { e.stopPropagation(); save(b.dataset.save); });
  app.querySelectorAll("[data-comment]").forEach(b => b.onclick = (e) => { e.stopPropagation(); comments(b.dataset.comment); });
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = (e) => { e.stopPropagation(); void sharePost(b.dataset.share); });
  app.querySelectorAll("[data-repost]").forEach(b => b.onclick = (e) => { e.stopPropagation(); repost(b.dataset.repost); });
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = (e) => { e.stopPropagation(); follow(b.dataset.follow); });
  app.querySelectorAll("[data-place-explore]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    nearbyLocationRequestId++;
    nearbyCity = b.dataset.placeExplore || "all";
    homeView = "nearby";
    homeTopic = "all";
    render();
  });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    navigateToProfile(b.dataset.profile);
  });
  app.querySelectorAll("[data-dot]").forEach(b => b.onclick = (e) => { e.stopPropagation(); const [id, n] = b.dataset.dot.split(":"); carouselIndex[id] = +n; render(); });
  app.querySelectorAll("[data-mute]").forEach(b => b.onclick = (e) => { e.stopPropagation(); muted = !muted; render(); });
  app.querySelectorAll("[data-dbl]").forEach(el => {
    let lastTap = 0;
    let singleTapTimer = null;
    el.onclick = event => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastTap <= 320) {
        clearTimeout(singleTapTimer);
        lastTap = 0;
        const clip = el.closest(".clip");
        const bounds = clip?.getBoundingClientRect();
        const x = bounds ? Math.max(24, Math.min(bounds.width - 24, event.clientX - bounds.left)) : 0;
        const y = bounds ? Math.max(48, Math.min(bounds.height - 48, event.clientY - bounds.top)) : 0;
        like(el.dataset.dbl, true, false);
        showPostHeart(el.dataset.dbl, x, y);
        return;
      }
      lastTap = now;
      singleTapTimer = window.setTimeout(() => {
        lastTap = 0;
        if (el instanceof HTMLVideoElement && el.isConnected) {
          if (el.paused) el.play().catch(() => {});
          else el.pause();
        }
      }, 320);
    };
  });
}
function showPostHeart(id, x, y) {
  const clip = [...app.querySelectorAll(".clip")].find(item => item.dataset.id === id);
  if (!clip) return;
  const heart = document.createElement("span");
  heart.className = "post-heart-burst";
  heart.style.left = `${x || clip.clientWidth / 2}px`;
  heart.style.top = `${y || clip.clientHeight / 2}px`;
  heart.innerHTML = ic.heartOn;
  heart.setAttribute("aria-hidden", "true");
  clip.appendChild(heart);
  window.setTimeout(() => heart.remove(), 1050);
}
async function like(id, forceLike = null, rerender = true) {
  const me = api.me();
  const cloudPost = api.cloudPost(id);
  if (cloudPost) {
    const wasLiked = cloudPost.likes.includes(me.id);
    const shouldLike = forceLike === null ? !wasLiked : forceLike;
    if (shouldLike === wasLiked) return;
    try {
      await api.setCloudLike(id, shouldLike);
      if(shouldLike)recordActivity("like",cloudPost);
      if (rerender) render();
      else {
        const updated = api.cloudPost(id);
        app.querySelectorAll("[data-like]").forEach(button => {
          if (button.dataset.like !== id) return;
          const liked = updated?.likes.includes(me.id) || false;
          button.classList.toggle("on", liked);
          button.setAttribute("aria-pressed", String(liked));
          button.innerHTML = `${ic.heartOn}${fmt(updated?.likeCount || 0)}`;
        });
      }
    } catch (error) {
      toast(error.message || "Couldn’t update this like");
    }
    return;
  }
  mutate(db => {
    const p = db.posts.find(x => x.id === id);
    if (!p) return;
    const i = p.likes.indexOf(me.id);
    const shouldLike = forceLike === null ? i < 0 : forceLike;
    if (shouldLike && i < 0) {
      p.likes.push(me.id);
      recordActivity("like",p);
      (p.tags || []).forEach(t => db.interests[t] = (db.interests[t] || 0) + 1);
      if (p.author !== me.id) notify(db, { id: "n" + Date.now(), user: p.author, kind: "like", actor: me.id, post: id, body: "liked your post", created: Date.now(), read: false });
    } else if (!shouldLike && i >= 0) p.likes.splice(i, 1);
  });
  if (rerender) render();
  else {
    const post = api.db().posts.find(item => item.id === id);
    app.querySelectorAll("[data-like]").forEach(button => {
      if (button.dataset.like !== id) return;
      const liked = post?.likes.includes(me.id) || false;
      button.classList.toggle("on", liked);
      button.setAttribute("aria-pressed", String(liked));
      button.innerHTML = `${ic.heartOn}${fmt(post?.likes.length || 0)}`;
    });
  }
}
function save(id) {
  showSocialSheet(id, "saved");
}
function showSocialSheet(id, mode, options = {}) {
  openSocialSheet({
    id, mode, commentId: options.commentId || "", sheet: $("#sheet"), esc, icons: ic, toast,
    onClose: options.onClose || render,
    onExternal: sharePostExternally,
    onStory: addSharedContentToStory,
    onShared: (postId,kind)=>showRepostPrompt(app,postId,kind),
    onBlast: blastId => {
      navigationStack.push(captureNavigationState());
      tab = "blast"; profileId = null; chatId = null; viewer = null;
      setBlastView({ name: "detail", id: blastId });
      render();
    }
  });
}
function follow(id) {
  const me = api.me();
  const u = api.user(id);
  const wasFollowing=me.following.includes(id);
  if (api.blocked(me.id, id)) return toast("Unblock this user before following");
  mutate(db => {
    const meU = db.users.find(x => x.id === me.id);
    const them = db.users.find(x => x.id === id);
    if (meU.following.includes(id)) {
      meU.following = meU.following.filter(x => x !== id);
      them.followers = them.followers.filter(x => x !== me.id);
      db.requests = db.requests.filter(r => !(r.from === me.id && r.to === id));
    } else if (them.private) {
      if (db.requests.some(r => r.from === me.id && r.to === id)) db.requests = db.requests.filter(r => !(r.from === me.id && r.to === id));
      else db.requests.push({ from: me.id, to: id, at: Date.now() });
    } else {
      meU.following.push(id); them.followers.push(me.id);
      notify(db, { id: "n" + Date.now(), user: id, kind: "follow", actor: me.id, body: "started following you", created: Date.now(), read: false });
    }
  });
  if(!u.private)recordActivity(api.me().following.includes(id)?"follow":"unfollow",{author:id,id:null},"profile");
  render();
  const following=api.me().following.includes(id);
  const requested=api.db().requests.some(r=>r.from===me.id&&r.to===id);
  toast(following?"Following":requested?"Requested":wasFollowing?"Unfollowed":"Follow request canceled");
}
function friend(id) {
  const me = api.me();
  const them = api.user(id);
  if (!them || them.id === me.id || api.blocked(me.id, them.id)) {
    return toast("Unblock this user before adding them as a Friend");
  }
  const alreadyFriends = api.areFriends(me.id, them.id);
  if (alreadyFriends && !confirm(`Remove @${them.username} from Friends?`)) return;
  let message = "Friend request sent";
  mutate(db => {
    db.friendRequests = Array.isArray(db.friendRequests) ? db.friendRequests : [];
    const current = db.users.find(user => user.id === me.id);
    const other = db.users.find(user => user.id === them.id);
    if (!current || !other) return;
    current.friends = Array.isArray(current.friends) ? current.friends : [];
    other.friends = Array.isArray(other.friends) ? other.friends : [];
    const outgoing = db.friendRequests.some(request => request.from === me.id && request.to === them.id);
    const incoming = db.friendRequests.some(request => request.from === them.id && request.to === me.id);
    if (alreadyFriends) {
      current.friends = current.friends.filter(friendId => friendId !== them.id);
      other.friends = other.friends.filter(friendId => friendId !== me.id);
      message = "Friend removed";
    } else if (incoming) {
      if (!current.friends.includes(them.id)) current.friends.push(them.id);
      if (!other.friends.includes(me.id)) other.friends.push(me.id);
      db.friendRequests = db.friendRequests.filter(request =>
        !((request.from === me.id && request.to === them.id) || (request.from === them.id && request.to === me.id))
      );
      notify(db, { id: "n" + Date.now(), user: them.id, kind: "friend-accepted", actor: me.id, body: "accepted your Friend request", created: Date.now(), read: false });
      message = "You’re now Friends";
    } else if (outgoing) {
      db.friendRequests = db.friendRequests.filter(request => !(request.from === me.id && request.to === them.id));
      message = "Friend request canceled";
    } else {
      db.friendRequests.push({ from: me.id, to: them.id, at: Date.now() });
      notify(db, { id: "n" + Date.now(), user: them.id, kind: "friend-request", actor: me.id, body: "sent you a Friend request", created: Date.now(), read: false });
    }
  });
  render();
  toast(message);
}
function toggleCloseFriend(id) {
  const me = api.me();
  const target = api.user(id);
  if (!target || target.id === me.id || api.blocked(me.id, target.id)) {
    return toast("Unblock this user before adding them to Close Friends");
  }
  if (!api.areFriends(me.id, target.id)) return toast("Become Friends first before adding them to Close Friends");
  let added = false;
  mutate(db => {
    const current = db.users.find(user => user.id === me.id);
    current.closeFriends = Array.isArray(current.closeFriends) ? current.closeFriends : [];
    const index = current.closeFriends.indexOf(target.id);
    if (index >= 0) current.closeFriends.splice(index, 1);
    else { current.closeFriends.push(target.id); added = true; }
  });
  render();
  toast(added ? "Added to Close Friends" : "Removed from Close Friends");
}
function respondToFriendRequest(from, accept) {
  const me = api.me();
  mutate(db => {
    db.friendRequests = Array.isArray(db.friendRequests) ? db.friendRequests : [];
    const request = db.friendRequests.find(item => item.from === from && item.to === me.id);
    const other = db.users.find(user => user.id === from);
    const current = db.users.find(user => user.id === me.id);
    if (request && accept && other && current) {
      current.friends = Array.isArray(current.friends) ? current.friends : [];
      other.friends = Array.isArray(other.friends) ? other.friends : [];
      if (!current.friends.includes(from)) current.friends.push(from);
      if (!other.friends.includes(me.id)) other.friends.push(me.id);
      notify(db, { id: "n" + Date.now(), user: from, kind: "friend-accepted", actor: me.id, body: "accepted your Friend request", created: Date.now(), read: false });
    }
    db.friendRequests = db.friendRequests.filter(item => !(item.from === from && item.to === me.id));
  });
  render();
}
function sharePost(id) {
  showSocialSheet(id, "share");
}
async function sharePostExternally(id, commentId = "", action = "external") {
  const p = api.post(id);
  if (!p || !api.canSeePost(p)) return toast("Post unavailable");
  const author = api.user(p.author);
  const link = new URL(location.pathname, location.origin);
  link.searchParams.set("post", id);
  const comment = findSharedComment(p, commentId);
  if (commentId && !comment) throw new Error("Comment unavailable.");
  if (commentId) link.searchParams.set("comment", commentId);
  const text = comment
    ? `@${api.user(comment.author)?.username || "member"}: ${comment.body || "Photo comment"}`
    : p.caption?.trim() || `Check out @${author?.username || "someone"}'s post on Oldtime.`;
  if (action === "copylink") {
    if (!await copyShareLink(link.href)) throw new Error("Couldn't copy this link.");
    toast(commentId ? "Comment link copied" : "Post link copied");
    return {completed:true,kind:"copied"};
  }
  if (action === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + link.href)}`, "_blank", "noopener,noreferrer");
    return {completed:true,kind:"opened"};
  }
  const result = await shareExternally({
    title: commentId ? "Oldtime comment" : `@${author?.username || "someone"} on Oldtime`,
    text,
    url: link.href
  });
  if (result === "cancelled") return;
  if (result === "failed") return toast("Couldn't share this post");
  recordActivity("share",p,"shared-link");
  const me = api.me();
  mutate(db => {
    const post = db.posts.find(item => item.id === id);
    if (!post) return;
    post.shares = (post.shares || 0) + 1;
    if (post.author !== me.id) notify(db, { id: "n" + Date.now(), user: post.author, kind: "share", actor: me.id, post: id, body: "shared your post", created: Date.now(), read: false });
  });
  toast(result === "shared" ? (commentId ? "Comment shared" : "Post shared") : (commentId ? "Comment link copied" : "Post link copied"));
  return {completed:true,kind:result==="shared"?"shared":"copied"};
}
function addSharedContentToStory(id, commentId = "") {
  const post = api.post(id);
  if (!post || !api.canSeePost(post)) throw new Error("Post unavailable.");
  const comment = findSharedComment(post, commentId);
  if (commentId && !comment) throw new Error("Comment unavailable.");
  if (comment) {
    queueMicrotask(() => openCommentCreative(id, commentId, "story"));
    return true;
  }
  // Sharing must not turn another person's restricted content into a public snapshot.
  if (post.author !== api.me().id && !api.canSeePost(post, null)) throw new Error("Only public posts can be added to your story.");
  const visibility = api.me().private ? "followers" : "public";
  if (!confirm(`Add this ${comment ? "comment" : "post"} to your ${visibility === "public" ? "public" : "followers-only"} story?`)) return false;
  const media = comment ? comment.attachment?.url || "" : post.media?.[0] || "";
  const text = comment
    ? `“${(comment.body || "Photo comment").slice(0, 240)}” — @${api.user(comment.author)?.username || "member"}`
    : `${post.caption || ""} — @${api.user(post.author)?.username || "member"}`;
  mutate(db => db.stories.unshift({
    id: "s" + crypto.randomUUID(), author: api.me().id, kind: media ? (comment ? "photo" : post.kind === "video" ? "video" : "photo") : "text",
    media, text, visibility, created: Date.now(), color: "#111922",
    ...(comment ? { sourceComment: { post: id, comment: comment.id } } : { sourcePost: id })
  }));
  toast("Added to your story");
  return true;
}
function repost(id) {
  openRepostNote(id,{esc,toast,onSaved:result=>{
    render();
    if(!result.removed)showRepostPrompt(app,id,"reposted");
  }});
}

function openCommentCreative(postId, commentId, destination = "post", startCamera = false) {
  const sheet = $("#sheet");
  sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = null; sheet.onkeydown = null;
  openCreativeEditor({ postId, commentId, destination, startCamera, esc, icons: ic, toast,
    onClose: () => comments(postId, commentId),
    onPosted: (id, story) => {
      tab = "updates"; profileId = null; viewer = null; render();
      if (story) openStory(api.me().id); else openPostViewer(id);
    }
  });
}
function comments(id, focusedCommentId = "") {
  const sheet = $("#sheet");
  if (api.cloudPost(id)) {
    const trigger = document.activeElement;
    return openCloudComments(id, { sheet, esc, icons: ic, toast, onClose: () => { trigger?.focus?.(); } });
  }
  const trigger = document.activeElement;
  let searchText = "";
  let sortMode = "top";
  let attachedPhoto = null;
  let actionLayer = null;
  const expandedReplies = new Set();
  const totalCount = comments => comments.reduce((total, comment) => total + 1 + (comment.replies || []).length, 0);
  const close = () => {
    actionLayer?.remove();
    actionLayer = null;
    sheet.classList.remove("on");
    sheet.innerHTML = "";
    sheet.onclick = null;
    sheet.onkeydown = null;
    if (trigger?.isConnected) trigger.focus();
  };
  function showCommentActions(commentId, triggerButton) {
    const post = api.post(id);
    const comment = findSharedComment(post, commentId);
    if (!comment) return;
    actionLayer?.remove();
    const author = api.user(comment.author) || { username: "member" };
    const key = `${id}:${comment.id}`;
    const isFavorite = Array.isArray(api.me().commentFavorites) && api.me().commentFavorites.includes(key);
    const body = `@${author.username}: ${comment.body || "Photo comment"}`;
    const commentPanel = $(".comment-panel", sheet);
    commentPanel?.setAttribute("aria-hidden", "true");
    if (commentPanel) commentPanel.inert = true;
    actionLayer = document.createElement("div");
    actionLayer.className = "comment-action-overlay";
    actionLayer.innerHTML = `<section class="comment-action-panel" role="dialog" aria-modal="true" aria-label="Comment actions" tabindex="-1">
      <div class="grab" aria-hidden="true"></div>
      <header class="comment-action-header"><h2>Comment actions</h2><button type="button" data-action-close aria-label="Close comment actions">${ic.close}</button></header>
      <div class="comment-action-preview"><b>@${esc(author.username)}</b><span>${esc(comment.body || "Photo comment")}</span></div>
      <div class="comment-action-list">
        <button type="button" data-action-remix>Remix</button>
        <button type="button" data-action-video>Reply with video</button>
        <button type="button" data-action-story>Share to Status</button>
        <button type="button" data-action-share>Share comment</button>
        <button type="button" data-action-copy>Copy comment</button>
        <button type="button" data-action-favorite>${isFavorite ? "Remove from Favorites" : "Add to Favorites"}</button>
        <button type="button" data-action-report>Report comment</button>
      </div>
      <p class="comment-action-note">Reports are not sent to moderation.</p>
    </section>`;
    sheet.appendChild(actionLayer);
    const dialog = $(".comment-action-panel", actionLayer);
    const dismiss = () => {
      actionLayer?.remove();
      actionLayer = null;
      if (commentPanel?.isConnected) {
        commentPanel.removeAttribute("aria-hidden");
        commentPanel.inert = false;
      }
      if (triggerButton?.isConnected) triggerButton.focus();
    };
    $("[data-action-close]", actionLayer).onclick = dismiss;
    actionLayer.onclick = event => { if (event.target === actionLayer) dismiss(); };
    $("[data-action-story]", actionLayer).onclick = () => {
      dismiss(); close(); openCommentCreative(id, comment.id, "story");
    };
    $("[data-action-remix]", actionLayer).onclick = () => { dismiss(); close(); openCommentCreative(id, comment.id); };
    $("[data-action-video]", actionLayer).onclick = () => { dismiss(); close(); openCommentCreative(id, comment.id, "post", true); };
    $("[data-action-share]", actionLayer).onclick = () => {
      dismiss();
      close();
      showSocialSheet(id, "share", { commentId, onClose: () => comments(id, commentId) });
    };
    $("[data-action-copy]", actionLayer).onclick = async () => {
      try {
        const copied = await copyShareLink(body);
        toast(copied ? "Comment copied." : "Couldn’t copy comment.");
        if (copied) dismiss();
      } catch (error) { toast(error.message || "Couldn’t copy comment."); }
    };
    $("[data-action-favorite]", actionLayer).onclick = () => {
      try {
        mutate(db => {
          const me = db.users.find(user => user.id === api.me().id);
          me.commentFavorites = Array.isArray(me.commentFavorites) ? me.commentFavorites : [];
          me.commentFavorites = me.commentFavorites.includes(key) ? me.commentFavorites.filter(item => item !== key) : [...me.commentFavorites, key];
        });
        const saved = (api.me().commentFavorites || []).includes(key);
        toast(saved ? "Saved to Favorites" : "Removed from Favorites");
        dismiss();
        drawList();
        [...$("#clist", sheet).querySelectorAll("[data-cmore]")].find(button => button.dataset.cmore === commentId)?.focus();
      } catch (error) { toast(error.message || "Couldn’t update Favorites."); }
    };
    $("[data-action-report]", actionLayer).onclick = () => {
      try {
        mutate(db => db.reports.push({ id: "rc" + Date.now(), by: api.me().id, target: comment.author, post: id, comment: comment.id, reason: "comment", at: Date.now() }));
        toast("Report saved. Moderation unavailable.");
        dismiss();
      } catch (error) { toast(error.message || "Couldn’t save this report."); }
    };
    dialog.onkeydown = event => {
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button:not([disabled])")];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    dialog.focus();
  }
  const drawList = () => {
    const post = api.post(id);
    if (!post || !api.canSeePost(post)) return close();
    const list = $("#clist", sheet);
    const visibleComments = [...(post.comments || [])]
      .filter(comment => {
        const author = api.user(comment.author);
        const text = `${author?.username || ""} ${author?.name || ""} ${comment.body || ""}`.toLowerCase();
        return !searchText || text.includes(searchText);
      })
      .sort((a, b) => sortMode === "top"
        ? ((b.likes || []).length - (a.likes || []).length) || (b.created || 0) - (a.created || 0)
        : (b.created || 0) - (a.created || 0));
    $("#comment-count", sheet).textContent = `${totalCount(post.comments || [])} ${totalCount(post.comments || []) === 1 ? "comment" : "comments"}`;
    $("#comment-sort-label", sheet).textContent = sortMode === "top" ? "Top" : "Newest";
    list.innerHTML = visibleComments.map(comment => {
      const author = api.user(comment.author) || { username: "member", avatar: "" };
      const replies = comment.replies || [];
      const expanded = expandedReplies.has(comment.id);
      const liked = (comment.likes || []).includes(api.me().id);
      const disliked = (comment.dislikes || []).includes(api.me().id);
      const commentDate = comment.created ? new Date(comment.created) : null;
      const dateLabel = commentDate ? `${commentDate.getMonth() + 1}-${String(commentDate.getDate()).padStart(2, "0")}` : ago(comment.created);
      const replyMarkup = replies.map(reply => {
        const replyAuthor = api.user(reply.author) || { username: "member", avatar: "" };
        return `<div class="comment-reply" id="reply-${esc(reply.id)}">
          <img src="${esc(replyAuthor.avatar)}" alt="" class="comment-reply-avatar" />
          <div class="comment-reply-content"><b>@${esc(replyAuthor.username)}</b><span>${esc(reply.body)}</span>
            ${reply.attachment?.url ? `<img class="comment-attachment" src="${esc(reply.attachment.url)}" alt="Photo attached to reply" loading="lazy" />` : ""}
            <small>${ago(reply.created)} <button type="button" data-cmore="${esc(reply.id)}" aria-label="Reply actions">${ic.more}</button> ${reply.author === api.me().id ? `<button type="button" data-rdel="${esc(comment.id)}:${esc(reply.id)}">Delete</button>` : ""}</small>
          </div>
        </div>`;
      }).join("");
      const favoriteKey = `${id}:${comment.id}`;
      const isFavorite = Array.isArray(api.me().commentFavorites) && api.me().commentFavorites.includes(favoriteKey);
      return `<article class="comment-item" id="comment-${esc(comment.id)}">
        <img class="comment-avatar" src="${esc(author.avatar)}" alt="" loading="lazy" />
        <div class="comment-content">
          <div class="comment-body"><b>@${esc(author.username)}${blueBadgeMarkup(author.cloudAccountId || author.id, esc)}</b><span>${esc(comment.body)}</span></div>
          ${comment.attachment?.url ? `<img class="comment-attachment" src="${esc(comment.attachment.url)}" alt="Photo attached to comment" loading="lazy" />` : ""}
          <div class="comment-footer">
            <span class="comment-date">${dateLabel}</span>
            <button type="button" class="comment-reply-action" data-reply="${esc(comment.id)}">Reply</button>
            <span class="comment-votes">
              <button type="button" class="comment-vote ${liked ? "on" : ""}" data-clike="${esc(comment.id)}" aria-label="${liked ? "Unlike" : "Like"} comment" aria-pressed="${liked}"><span aria-hidden="true">♥</span><small>${(comment.likes || []).length || ""}</small></button>
              <button type="button" class="comment-vote ${disliked ? "on" : ""}" data-cdislike="${esc(comment.id)}" aria-label="${disliked ? "Remove dislike" : "Dislike"} comment" aria-pressed="${disliked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 4-8c1.5 0 2.5 1 2.5 2.5L13 9h6.2a2 2 0 0 1 2 2.4l-1.4 8a2 2 0 0 1-2 1.6H7V10Z"/></svg></button>
            </span>
            <button type="button" class="comment-more" data-cmore="${esc(comment.id)}" aria-label="Comment actions">${ic.more}</button>
            <button type="button" class="comment-share-action" data-comment-share="${esc(comment.id)}" aria-label="Share comment">${ic.share}</button>
            ${comment.author === api.me().id || post.author === api.me().id ? `<button type="button" class="comment-delete" data-cdel="${esc(comment.id)}">Delete</button>` : ""}
          </div>
          ${replies.length ? `<button type="button" class="comment-view-replies" data-toggle-replies="${esc(comment.id)}" aria-expanded="${expanded}">${expanded ? "Hide" : "View"} ${replies.length} ${replies.length === 1 ? "reply" : "replies"}</button>` : ""}
          ${expanded ? `<div class="comment-replies">${replyMarkup}</div>` : ""}
        </div>
      </article>`;
    }).join("") || `<div class="comment-empty">${searchText ? "No comments match your search." : "No comments yet. Start the conversation."}</div>`;
    list.querySelectorAll("[data-comment-share]").forEach(button => button.onclick = () => {
      const commentId = button.dataset.commentShare;
      close();
      showSocialSheet(id, "share", { commentId, onClose: () => comments(id, commentId) });
    });
    list.querySelectorAll("[data-reply]").forEach(button => button.onclick = () => {
      const comment = (api.db().posts.find(item => item.id === id)?.comments || []).find(item => item.id === button.dataset.reply);
      if (!comment) return;
      const author = api.user(comment.author);
      const input = $("#cbody", sheet);
      input.value = author ? `@${author.username} ` : "";
      input.dataset.reply = comment.id;
      input.placeholder = `Reply to @${author?.username || "member"}`;
      input.focus();
    });
    list.querySelectorAll("[data-cmore]").forEach(button => button.onclick = () => showCommentActions(button.dataset.cmore, button));
    list.querySelectorAll("[data-toggle-replies]").forEach(button => button.onclick = () => {
      const commentId = button.dataset.toggleReplies;
      if (expandedReplies.has(commentId)) expandedReplies.delete(commentId);
      else expandedReplies.add(commentId);
      drawList();
    });
    void hydrateBlueBadges(sheet);
    list.querySelectorAll("[data-clike]").forEach(button => button.onclick = () => {
      mutate(db => {
        const comment = db.posts.find(item => item.id === id)?.comments.find(item => item.id === button.dataset.clike);
        if (!comment) return;
        comment.likes = Array.isArray(comment.likes) ? comment.likes : [];
        comment.dislikes = Array.isArray(comment.dislikes) ? comment.dislikes : [];
        const index = comment.likes.indexOf(api.me().id);
        if (index >= 0) comment.likes.splice(index, 1);
        else { comment.dislikes = comment.dislikes.filter(userId => userId !== api.me().id); comment.likes.push(api.me().id); }
      });
      drawList();
    });
    list.querySelectorAll("[data-cdislike]").forEach(button => button.onclick = () => {
      mutate(db => {
        const comment = db.posts.find(item => item.id === id)?.comments.find(item => item.id === button.dataset.cdislike);
        if (!comment) return;
        comment.likes = Array.isArray(comment.likes) ? comment.likes : [];
        comment.dislikes = Array.isArray(comment.dislikes) ? comment.dislikes : [];
        const index = comment.dislikes.indexOf(api.me().id);
        if (index >= 0) comment.dislikes.splice(index, 1);
        else { comment.likes = comment.likes.filter(userId => userId !== api.me().id); comment.dislikes.push(api.me().id); }
      });
      drawList();
    });
    list.querySelectorAll("[data-cdel]").forEach(button => button.onclick = () => {
      mutate(db => {
        const postToUpdate = db.posts.find(item => item.id === id);
        if (postToUpdate) postToUpdate.comments = postToUpdate.comments.filter(comment => comment.id !== button.dataset.cdel);
      });
      expandedReplies.delete(button.dataset.cdel);
      drawList();
    });
    list.querySelectorAll("[data-rdel]").forEach(button => button.onclick = () => {
      const [commentId, replyId] = button.dataset.rdel.split(":");
      mutate(db => {
        const comment = db.posts.find(item => item.id === id)?.comments.find(item => item.id === commentId);
        if (comment) comment.replies = (comment.replies || []).filter(reply => reply.id !== replyId);
      });
      drawList();
    });
  };
  sheet.classList.add("on");
  const draw = () => {
    const p = api.post(id);
    if (!p || !api.canSeePost(p)) return close();
    const previousBody = $("#cbody", sheet)?.value || "";
    const previousReply = $("#cbody", sheet)?.dataset.reply || "";
    sheet.innerHTML = `<section class="panel comment-panel" role="dialog" aria-modal="true" aria-label="Comments">
      <div class="grab" aria-hidden="true"></div>
      <div class="comment-toolbar">
        <label class="comment-search-wrap">${ic.search}<input id="comment-search" type="search" placeholder="Search comments" aria-label="Search comments" value="${esc(searchText)}" /></label>
        <button type="button" class="comment-sort" id="comment-sort" aria-label="Sort comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0 4 4m-4-4-4 4"/></svg><span id="comment-sort-label"></span></button>
        <button type="button" class="comment-close" id="comment-close" aria-label="Close comments">${ic.close}</button>
      </div>
      <div class="comment-count" id="comment-count"></div>
      <div class="comment-list" id="clist" aria-label="Comments"></div>
      <form id="cform" class="comment-composer">
        <img class="comment-composer-avatar" src="${esc(api.me().avatar)}" alt="" />
        ${attachedPhoto ? `<div class="comment-photo-preview"><img src="${esc(attachedPhoto.url)}" alt="Photo attachment preview" /><button type="button" id="comment-photo-remove" aria-label="Remove attached photo">Remove</button></div>` : ""}
        <div class="comment-composer-pill">
          <input class="comment-input" id="cbody" value="${esc(previousBody)}" data-reply="${esc(previousReply)}" placeholder="${previousReply ? "Write a reply" : "Add a comment..."}" autocomplete="off" aria-label="${previousReply ? "Write a reply" : "Add a comment"}" />
          <button type="button" class="comment-tool" id="comment-photo" aria-label="Attach a photo">${ic.image || ic.camera}</button>
          <input id="comment-photo-file" type="file" accept="image/*" hidden />
          <button type="button" class="comment-tool" id="comment-mention" aria-label="Mention someone">@</button>
          <button type="button" class="comment-tool" id="comment-emoji" aria-label="Add emoji">${ic.smile}</button>
        </div>
        <button class="comment-send" type="submit" aria-label="Send comment">${ic.send}</button>
      </form>
    </section>`;
    $("#comment-search", sheet).oninput = event => { searchText = event.target.value.trim().toLowerCase(); drawList(); };
    $("#comment-sort", sheet).onclick = () => { sortMode = sortMode === "top" ? "newest" : "top"; drawList(); };
    $("#comment-close", sheet).onclick = close;
    $("#comment-photo", sheet).onclick = () => $("#comment-photo-file", sheet).click();
    $("#comment-photo-file", sheet).onchange = async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast("Choose an image to attach."); event.target.value = ""; return; }
      if (file.size > 300 * 1024) { toast("Choose a photo no larger than 300 KB for device storage."); event.target.value = ""; return; }
      try {
        attachedPhoto = await fileToData(file);
        draw();
        $("#cbody", sheet)?.focus();
      } catch (error) { toast(error.message || "Couldn’t attach this photo."); }
    };
    $("#comment-photo-remove", sheet)?.addEventListener("click", () => { attachedPhoto = null; draw(); });
    $("#comment-emoji", sheet).onclick = () => openEmojiPicker($("#cbody", sheet), undefined, { chat: true });
    $("#comment-mention", sheet).onclick = () => {
      const input = $("#cbody", sheet);
      const start = input.selectionStart ?? input.value.length;
      input.setRangeText("@", start, input.selectionEnd ?? start, "end");
      input.focus();
    };
    $("#cform", sheet).onsubmit = e => {
      e.preventDefault();
      const input = $("#cbody", sheet);
      const body = input.value.trim();
      if (!body && !attachedPhoto) return input.focus();
      const parent = input.dataset.reply;
      try {
        mutate(db => {
          const postToUpdate = db.posts.find(item => item.id === id);
          if (!postToUpdate) throw new Error("This post is no longer available.");
          if (parent) {
            const comment = postToUpdate.comments.find(item => item.id === parent);
            if (!comment) throw new Error("This comment is no longer available.");
            comment.replies = comment.replies || [];
            comment.replies.push({ id: "r" + Date.now(), author: api.me().id, body, ...(attachedPhoto ? { attachment: attachedPhoto } : {}), created: Date.now() });
            expandedReplies.add(parent);
          } else postToUpdate.comments.push({ id: "c" + Date.now(), author: api.me().id, body, ...(attachedPhoto ? { attachment: attachedPhoto } : {}), likes: [], dislikes: [], replies: [], created: Date.now() });
          if (postToUpdate.author !== api.me().id) notify(db, { id: "n" + Date.now(), user: postToUpdate.author, kind: parent ? "reply" : "comment", actor: api.me().id, post: id, body: (parent ? "replied: " : "commented: ") + body.slice(0, 80), created: Date.now(), read: false });
        });
        input.value = "";
        attachedPhoto = null;
        delete input.dataset.reply;
        input.placeholder = "Add a comment...";
        searchText = "";
        $("#comment-search", sheet).value = "";
        drawList();
        $("#cbody", sheet).focus();
      } catch (error) { toast(error.message || "Couldn’t add your comment."); }
    };
    drawList();
    sheet.onclick = event => { if (event.target === sheet) close(); };
    sheet.onkeydown = event => {
      if (event.key !== "Escape") return;
      if (actionLayer) {
        event.stopPropagation();
        $("[data-action-close]", actionLayer)?.click();
      } else close();
    };
  };
  draw();
  if (focusedCommentId) {
    const source = api.post(id);
    const parent = source?.comments?.find(comment => comment.replies?.some(reply => reply.id === focusedCommentId));
    if (parent) { expandedReplies.add(parent.id); drawList(); }
    const target = document.getElementById(`comment-${focusedCommentId}`) || document.getElementById(`reply-${focusedCommentId}`);
    if (target) {
      target.classList.add("shared-comment-highlight");
      target.setAttribute("tabindex", "-1");
      target.scrollIntoView?.({ block: "center" });
      target.focus({ preventScroll: true });
    } else toast("Comment unavailable");
  }
}

function openStory(authorId) {
  const list = api.db().stories.filter(s => s.author === authorId && Date.now() - s.created < 864e5 && api.canSeeStory(s));
  if (!list.length) {
    if (authorId !== api.me()?.id) return toast("Story unavailable");
    createKind = "story";
    openCreate([], "story");
    return;
  }
  let i = 0;
  const view = $("#storyview");
  view.classList.add("on");
  const show = () => {
    const s = list[i];
    if (!s) { view.classList.remove("on"); clearInterval(storyTimer); return; }
    if (!api.canSeeStory(s)) { i++; show(); return; }
    view.innerHTML = `<div class="progress"><b id="bar"></b></div>
      <div class="row" style="position:absolute;top:24px;left:12px;right:48px;z-index:2"><img src="${api.user(s.author).avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><b>@${api.user(s.author).username}</b>${s.author===api.me().id?`<small data-story-plays>${fmt(s.measuredViews||0)} measured plays on this device</small>`:""}</div>
      <button id="sclose" aria-label="Close story" style="position:absolute;top:22px;right:12px;z-index:2">${ic.close}</button>
      <div style="height:100%;background:${s.color || "#000"}">${s.creativeProject ? creativeMediaMarkup(s, esc, true) : s.media ? (String(s.media).startsWith("data:video") || s.kind === "video" ? `<video src="${s.media}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${s.media}" style="width:100%;height:100%;object-fit:cover" />`) : ""}<div style="position:absolute;left:16px;bottom:90px;font-size:28px;font-family:Fraunces,serif">${esc(s.text || "")}${s.creativeProject ? creativeAttribution(s, esc) : ""}</div></div>`;
    if (s.creativeProject) mountCreativeViewers(view, { onSource: (postId, commentId) => {
      view.classList.remove("on"); view.innerHTML = ""; clearInterval(storyTimer); openPostViewer(postId, commentId);
    } });
    trackQualifiedView(s,view.lastElementChild,"content");
    if(s.author===api.me().id&&s.analyticsId&&!api.me().private&&!s.closeFriends&&!["friends","followers","close-friends"].includes(s.visibility||s.audience)){
      const actor=api.cloudAccountId(),label=view.querySelector("[data-story-plays]");
      void requestCloudApi(`/api/analytics/content/${encodeURIComponent(s.analyticsId)}`).then(result=>{
        if(label?.isConnected&&actor===api.cloudAccountId())label.textContent=`${fmt(result.views)} recorded plays`;
      }).catch(()=>{});
    }
    $("#sclose").onclick = () => { view.classList.remove("on"); view.innerHTML = ""; clearInterval(storyTimer); };
    let w = 0; clearInterval(storyTimer);
    storyTimer = setInterval(() => {
      if (!api.canSeeStory(s)) { i++; show(); return; }
      w += s.creativeProject ? 100 / ((s.trim || s.creativeProject.duration) * 1000 / 90) : 2;
      const bar = $("#bar"); if (bar) bar.style.width = w + "%"; if (w >= 100) { i++; show(); }
    }, 90);
  };
  show();
}

function openProfilePostPlayback(authorId, posts) {
  const list = posts.slice();
  if (!list.length) return toast("No posts to play");
  if (!api.canSee(authorId)) return toast("This account is private");
  const view = $("#storyview");
  let index = 0;

  const close = () => {
    clearInterval(storyTimer);
    storyTimer = null;
    view.classList.remove("on");
    view.innerHTML = "";
  };
  const move = direction => {
    if (direction > 0) {
      if (index >= list.length - 1) return close();
      index += 1;
    } else if (index > 0) index -= 1;
    show();
  };
  const startPhotoTimer = progress => {
    clearInterval(storyTimer);
    const started = Date.now();
    storyTimer = setInterval(() => {
      const amount = Math.min(100, ((Date.now() - started) / 5000) * 100);
      if (progress.isConnected) progress.style.width = `${amount}%`;
      if (amount >= 100) move(1);
    }, 90);
  };
  const show = () => {
    clearInterval(storyTimer);
    storyTimer = null;
    if (!api.canSee(authorId)) {
      close();
      toast("This account is private");
      return;
    }
    const post = list[index];
    const author = api.user(authorId);
    if (!post || !author) return close();
    const media = post.media?.[0] || "";
    const isVideo = post.kind === "video" || String(media).startsWith("data:video");
    const content = post.creativeProject ? creativeMediaMarkup(post, esc) : media
      ? (isVideo
        ? `<video id="profile-play-video" src="${esc(media)}" autoplay muted playsinline aria-label="${esc(post.caption || "Profile video")}"></video>`
        : `<img src="${esc(media)}" alt="${esc(post.caption || "Profile post")}" />`)
      : `<div class="profile-play-text">${esc(post.caption || "Post")}</div>`;
    view.classList.add("on");
    view.innerHTML = `
      <div class="profile-play-progress" aria-hidden="true">
        ${list.map((_, i) => `<span class="${i < index ? "done" : i === index ? "active" : ""}"><i></i></span>`).join("")}
      </div>
      <div class="profile-play-header">
        <img src="${esc(author.avatar || "")}" alt="" />
        <div><b>@${esc(author.username)}</b><small>${index + 1} of ${list.length} posts</small></div>
      </div>
      <button type="button" class="profile-play-close" id="profile-play-close" aria-label="Close playback">${ic.close}</button>
      <div class="profile-play-media">${content}</div>
      ${post.creativeProject ? creativeAttribution(post, esc) : ""}
      ${media && post.caption ? `<div class="profile-play-caption">${esc(post.caption)}</div>` : ""}
      <button type="button" class="profile-play-zone profile-play-zone-left" id="profile-play-prev" aria-label="Previous post"></button>
      <button type="button" class="profile-play-zone profile-play-zone-right" id="profile-play-next" aria-label="Next post"></button>
    `;
    if (post.creativeProject) mountCreativeViewers(view, { onSource: (id, commentId) => { close(); openPostViewer(id, commentId); } });
    $("#profile-play-close", view).onclick = close;
    $("#profile-play-prev", view).onclick = () => move(-1);
    $("#profile-play-next", view).onclick = () => move(1);

    const progress = $(".profile-play-progress .active i", view);
    trackQualifiedView(post,$(".profile-play-media",view),"profile");
    const video = $("#profile-play-video", view);
    if (!video) {
      startPhotoTimer(progress);
      return;
    }
    const started = Date.now();
    let lastTime = video.currentTime;
    let lastAdvance = started;
    video.addEventListener("ended", () => move(1), { once: true });
    video.addEventListener("error", () => move(1), { once: true });
    video.addEventListener("timeupdate", () => {
      if (Number.isFinite(video.duration) && video.duration > 0 && progress.isConnected) {
        progress.style.width = `${Math.min(100, (video.currentTime / video.duration) * 100)}%`;
      }
    });
    storyTimer = setInterval(() => {
      if (video.currentTime > lastTime) {
        lastTime = video.currentTime;
        lastAdvance = Date.now();
      }
      if (Date.now() - lastAdvance > 15000) move(1);
    }, 500);
    const attempt = video.play();
    if (attempt?.catch) attempt.catch(() => startPhotoTimer(progress));
  };

  show();
}

function openCameraLanding() {
  stopCameraLanding();
  openUniversalCreation({startCamera:true});
}
function legacyCameraLanding() {
  stopCameraLanding();
  cameraFacing = "environment";
  cameraMode = "post";
  shell(`<section class="screen on camera-screen" aria-label="Camera">
    <div class="camera-feed"><video id="camera-preview" autoplay playsinline muted></video><div class="camera-vignette"></div></div>
    <header class="camera-top-controls">
      <button type="button" class="camera-top-button" id="camera-close" aria-label="Close">${ic.close}</button>
      <button type="button" class="camera-top-button" id="camera-flash" aria-label="Flash" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-13h-7z"/></svg>
      </button>
      <span></span>
    </header>
    <div class="camera-bottom-controls">
      <div class="camera-capture-row">
        <button type="button" class="camera-side-button" id="camera-gallery" aria-label="Choose a photo from your library" title="Choose a photo">${ic.image}</button>
        <button type="button" class="camera-shutter" id="camera-shutter" aria-label="Take photo"><span></span></button>
        <button type="button" class="camera-side-button" id="camera-flip" aria-label="Flip camera">${ic.flip}</button>
      </div>
      <nav class="camera-modes" role="tablist" aria-label="Create type">
        ${[["post","POST"],["story","STORY"],["quote","QUOTE"]].map(([id,label]) => `<button type="button" role="tab" data-camera-mode="${id}" aria-selected="${id === cameraMode}" class="${id === cameraMode ? "on" : ""}">${label}</button>`).join("")}
      </nav>
    </div>
    <input id="camera-file" type="file" accept="image/*" hidden />
  </section>`, undefined, { hideNav: true });

  const preview = $("#camera-preview");
  const generation = cameraGeneration;
  connectCamera(preview, generation).then(available => {
    if (!available && generation === cameraGeneration && preview.isConnected) toast("Camera unavailable");
  });
  $("#camera-close").onclick = () => { stopCameraLanding(); render(); };
  $("#camera-flash").onclick = toggleCameraFlash;
  $("#camera-flip").onclick = flipCamera;
  $("#camera-gallery").onclick = () => $("#camera-file").click();
  $("#camera-file").onchange = async () => {
    const file = $("#camera-file").files?.[0];
    $("#camera-file").value = "";
    if (!file) return;
    try {
      const media = await fileToData(file);
      if (!$("#camera-preview")) return;
      const kind = cameraMode === "story" ? "story" : "photo";
      createKind = kind;
      stopCameraLanding();
      render();
      openCreate([media], kind);
    } catch (error) {
      toast(error.message || "Couldn't read media");
    }
  };
  $("#camera-shutter").onclick = () => {
    captureCameraPhoto();
  };
  app.querySelectorAll("[data-camera-mode]").forEach(button => button.onclick = () => {
    if (button.dataset.cameraMode === "quote") {
      stopCameraLanding();
      render();
      openCreate([], "text");
      return;
    }
    cameraMode = button.dataset.cameraMode;
    app.querySelectorAll("[data-camera-mode]").forEach(modeButton => {
      const active = modeButton.dataset.cameraMode === cameraMode;
      modeButton.classList.toggle("on", active);
      modeButton.setAttribute("aria-selected", active);
    });
    $("#camera-shutter").setAttribute("aria-label", "Take photo");
    $("#camera-gallery").disabled = false;
  });
}

async function connectCamera(preview, generation) {
  if (!preview?.isConnected || !navigator.mediaDevices?.getUserMedia) return false;
  const video = { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 1920 } };
  let next;
  try {
    next = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    try { next = await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
    catch { return false; }
  }
  if (generation !== cameraGeneration || !preview.isConnected) {
    next.getTracks().forEach(track => track.stop());
    return false;
  }
  cameraStream = next;
  preview.srcObject = next;
  try { await preview.play(); } catch {}
  updateFlashButton();
  return true;
}

function updateFlashButton() {
  const button = $("#camera-flash");
  const track = cameraStream?.getVideoTracks()[0];
  if (!button) return;
  const available = Boolean(track?.getCapabilities?.().torch);
  button.disabled = !available;
  button.classList.toggle("active", cameraFlashOn);
  button.setAttribute("aria-label", available ? (cameraFlashOn ? "Turn flash off" : "Turn flash on") : "Flash unavailable");
}

async function toggleCameraFlash() {
  const track = cameraStream?.getVideoTracks()[0];
  if (!track?.getCapabilities?.().torch) return;
  cameraFlashOn = !cameraFlashOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: cameraFlashOn }] });
    updateFlashButton();
  } catch {
    cameraFlashOn = false;
    updateFlashButton();
  }
}

async function flipCamera() {
  cameraFacing = cameraFacing === "environment" ? "user" : "environment";
  cameraFlashOn = false;
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  const preview = $("#camera-preview");
  if (preview) preview.srcObject = null;
  const generation = ++cameraGeneration;
  const available = await connectCamera(preview, generation);
  if (!available && generation === cameraGeneration && preview?.isConnected) toast("Camera unavailable");
}

function stopCameraLanding() {
  cameraGeneration++;
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  cameraFlashOn = false;
}

async function captureCameraPhoto() {
  const preview = $("#camera-preview");
  if (!cameraStream || !preview?.videoWidth || !preview.videoHeight) {
    $("#camera-file").click();
    return;
  }
  const generation = cameraGeneration;
  const scale = Math.min(1, 1600 / Math.max(preview.videoWidth, preview.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(preview.videoWidth * scale);
  canvas.height = Math.round(preview.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return toast("Camera capture unavailable");
  context.drawImage(preview, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(async blob => {
    if (!blob || generation !== cameraGeneration || !preview.isConnected) return;
    try {
      const media = await fileToData(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      const kind = cameraMode === "story" ? "story" : "photo";
      createKind = kind;
      stopCameraLanding();
      render();
      openCreate([media], kind);
    } catch (error) {
      toast(error.message || "Couldn't read media");
    }
  }, "image/jpeg", .82);
}

window.addEventListener("pagehide", stopCameraLanding);

function openUniversalCreation({startCamera=false,startQuote=false,background=null,destination="post"}={}) {
  const community=tab==="communities";
  const sheet=$("#sheet");if(sheet){sheet.classList.remove("on");sheet.innerHTML="";}
  openCreativeEditor({startCamera,startQuote,background,destination:community&&destination==="post"?"community":destination,esc,icons:ic,toast,
    onQuote:()=>openCreate([],"text"),
    onPosted:(id,story,toCommunity)=>{
      viewer=null;profileId=null;tab=toCommunity?"communities":"updates";render();
      if(story)openStory(api.me().id);else if(!toCommunity)openPostViewer(id);
    }
  });
}
function openCreate(initialMedia = [], initialKind = null) {
  if(initialKind==="text")return openUniversalCreation({startQuote:true});
  openUniversalCreation({destination:initialKind==="story"?"story":"post",
    background:initialMedia[0]?{media:initialMedia[0].url,kind:initialMedia[0].video?"video":"photo"}:null});
}
function legacyCreateForm(initialMedia = [], initialKind = null) {
  const returnToCommunity = tab === "communities" && initialKind === "text";
  pending = initialMedia;
  if (initialKind) createKind = initialKind;
  const sheet = $("#sheet");
  sheet.classList.add("on");
  const kinds = [["video", "Video"], ["photo", "Photo"], ["carousel", "Carousel"], ["text", "Quote"], ["story", "Story"]];
  sheet.innerHTML = `<div class="panel" style="max-height:94%"><div class="grab"></div><b>${createKind === "text" ? "Create a quote" : "Create"}</b>
    <div class="seg" id="kinds">
      ${kinds.map(([kind, label]) => `<button data-k="${kind}">${label}</button>`).join("")}
    </div>
    <textarea class="field" id="cap" placeholder="${createKind === "text" ? "Write a quote…" : "Caption"}"></textarea>
    <button class="icon" id="caption-emoji" aria-label="Add emoji to caption">${ic.smile}</button>
    <input class="field" id="loc" placeholder="Location (optional)" style="margin-top:8px" />
     <select class="field" id="vis" style="margin-top:8px"><option value="public">Public</option><option value="followers">Followers</option><option value="friends">Friends</option><option value="close-friends">Close Friends</option></select>
     <div class="sub close-friends-hint" id="close-friends-hint" hidden><span id="close-friends-hint-text"></span> <button type="button" class="close-friends-manage" id="manage-close-friends">Manage Close Friends</button></div>
    <div id="create-media-tools">
      <div class="row" style="margin:8px 0;flex-wrap:wrap"><button class="btn ghost small" id="pick">Upload</button><button class="btn ghost small" id="rec">Record</button><input id="file" type="file" accept="image/*,video/*" multiple hidden /><input id="cam" type="file" accept="video/*,image/*" capture="environment" hidden /><span class="sub" id="picked">No file yet</span></div>
      <video id="prev" controls style="width:100%;max-height:160px;display:none;border-radius:12px"></video>
      <img id="pimg" style="width:100%;max-height:160px;object-fit:cover;display:none;border-radius:12px" />
      <label class="sub" id="trim-row">Trim end <input class="field" id="trim" type="number" min="1" placeholder="Seconds" /></label>
    </div>
    <button class="btn ghost" id="create-layer-editor" style="margin-top:10px">Open layer editor</button>
    <button class="btn" id="post" style="margin-top:10px">Post</button></div>`;
  const paint = () => {
    sheet.querySelectorAll("#kinds button").forEach(b => b.classList.toggle("on", b.dataset.k === createKind));
    $("#create-media-tools").hidden = createKind === "text";
    $("#rec").hidden = createKind !== "video";
    $("#trim-row").hidden = createKind !== "video";
    $("#cap").placeholder = createKind === "text" ? "Write a quote…" : "Caption";
    const closeFriendsOption = $("#vis").querySelector('option[value="close-friends"]');
    const hasCloseFriends = (api.me().closeFriends || []).length > 0;
    closeFriendsOption.disabled = !hasCloseFriends;
    $("#close-friends-hint-text").textContent = hasCloseFriends
      ? "Only people on your list can see this."
      : "Add people to Close Friends before sharing privately.";
    $("#close-friends-hint").hidden = $("#vis").value !== "close-friends" && !(createKind === "story" && !hasCloseFriends);
  };
  paint();
  $("#vis").onchange = paint;
  const showPending = () => {
    const picked = $("#picked"), prev = $("#prev"), pimg = $("#pimg");
    if (!picked?.isConnected) return;
    picked.textContent = pending.length ? `${pending.length} ready` : "No file yet";
    prev.style.display = "none";
    pimg.style.display = "none";
    if (pending[0]?.video) { prev.style.display = "block"; prev.src = pending[0].url; }
    else if (pending[0]) { pimg.style.display = "block"; pimg.src = pending[0].url; }
  };
  showPending();
  $("#caption-emoji").onclick = () => openEmojiPicker($("#cap"));
  $("#create-layer-editor").onclick = () => {
    const files = pending.slice(), kind = createKind, caption = $("#cap").value, location = $("#loc").value, visibility = $("#vis").value;
    sheet.classList.remove("on"); sheet.innerHTML = "";
    openCreativeEditor({ destination: kind === "story" ? "story" : "post", background: files[0] ? { media: files[0].url, kind: files[0].video ? "video" : "photo" } : null,
      esc, icons: ic, toast,
      onClose: () => { openCreate(files, kind); $("#cap").value = caption; $("#loc").value = location; $("#vis").value = visibility; },
      onPosted: (id, story) => { viewer = null; profileId = null; tab = "updates"; render(); if (story) openStory(api.me().id); else openPostViewer(id); }
    });
  };
  sheet.querySelector("#kinds").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; createKind = b.dataset.k; paint(); };
  $("#pick").onclick = () => $("#file").click();
  $("#rec").onclick = () => $("#cam").click();
  const take = async (files) => {
    const post = $("#post");
    post.disabled = true;
    try {
      pending = [];
      for (const f of files) {
        if (!/^(image|video)\//.test(f.type)) throw new Error("Choose photos or videos");
        pending.push(await fileToData(f));
      }
    } catch (e) { pending = []; toast(e.message || "Couldn't read media"); return; }
    finally { post.disabled = false; }
    showPending();
  };
  $("#file").onchange = () => take([...$("#file").files]);
  $("#cam").onchange = () => take([...$("#cam").files]);
  $("#post").onclick = async () => {
    const caption = $("#cap").value.trim();
    const tags = [...caption.matchAll(/#([a-z0-9_]+)/gi)].map(m => m[1].toLowerCase());
    if (createKind === "text" && !caption) return toast("Add text");
    if (createKind === "story" && !caption && !pending.length) return toast("Add text or media");
    if (["video", "photo", "carousel"].includes(createKind) && !pending.length) return toast("Add a photo or video");
    if (createKind === "video" && (pending.length !== 1 || !pending[0].video)) return toast("Choose one video");
    if (createKind === "photo" && (pending.length !== 1 || pending[0].video)) return toast("Choose one photo");
    if (createKind === "carousel" && (pending.length < 2 || pending.some(p => p.video))) return toast("Choose at least two photos");
    if (createKind === "story" && pending.length > 1) return toast("Choose one story image or video");
    const visibility = $("#vis").value;
    if (visibility === "close-friends" && !(api.me().closeFriends || []).length) {
      return toast("Add people to Close Friends before sharing with them");
    }
    const trim = Number($("#trim").value) || 0;
    if (api.authMode() === "cloud" && createKind === "text") {
      if (visibility !== "public") return toast("Online text posts currently support public visibility only. Nothing was posted.");
      try { await api.createCloudPost(caption); }
      catch (error) { toast(error.message || "Couldn’t publish your post"); return; }
    } else {
      try { mutate(db => {
        if (createKind === "story") db.stories.unshift({ id: "s" + Date.now(), author: api.me().id, kind: pending[0]?.video ? "video" : (pending[0] ? "photo" : "text"), media: pending[0]?.url || "", text: caption, visibility, created: Date.now(), color: "#111922" });
        else db.posts.unshift({ id: "p" + Date.now(), author: api.me().id, kind: createKind, caption: caption || " ", tags, media: createKind === "text" ? [] : pending.map(p => p.url), sound: "Original audio", location: $("#loc").value.trim(), visibility, trim, likes: [], comments: [], saves: [], created: Date.now(), views: 0, shares: 0, color: "linear-gradient(160deg,#111922,#1a2330)" });
      }); } catch (e) { toast(e.message); return; }
    }
    pending = []; sheet.classList.remove("on");
    if ($("#camera-preview")) stopCameraLanding();
    tab = returnToCommunity ? "communities" : "updates"; profileId = null;
    render(); toast("Posted");
  };
  $("#manage-close-friends").onclick = () => {
    sheet.classList.remove("on");
    tab = "settings";
    settingsView = "close-friends";
    render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function automaticProfileCover(user) {
  const post = api.posts().find(p => p.author === user.id && p.kind !== "video" && !p.creativeProject && p.media?.[0]);
  return post?.media?.[0] || user.avatar || "";
}

function profile(id) {
  const u = api.user(id);
  const me = api.me();
  if (!u) { profileId = null; profileReturnChatId = null; return updates(); }
  const locked = !api.canSee(u.id);
  const posts = api.posts().filter(p => p.author === u.id && (p.author === me.id || api.canSeePost(p)));
  const coverImage = u.cover || (locked ? u.avatar : automaticProfileCover(u));
  const videos = posts.filter(p => p.kind === "video");
   const saved = listSavedPosts();
  const reposts = api.posts().filter(p => (p.reposts || []).includes(u.id) && (p.author === me.id || api.canSeePost(p)));
  const repostedAuthors = new Map();
  reposts.forEach(post => {
    const author = api.user(post.author);
    if (author && !repostedAuthors.has(author.id)) repostedAuthors.set(author.id, { author, post });
  });
  const mine = u.id === me.id;
  const savedCollections = mine && profileMode === "saved" ? listSavedCollections() : [];
  const selectedCollection = savedCollections.find(collection => collection.id === savedCollectionId);
  const savedGrid = selectedCollection ? saved.filter(post => selectedCollection.postIds.includes(post.id)) : saved;
  const grid = locked ? [] : profileMode === "videos" ? videos
    : profileMode === "reposts" ? reposts
      : profileMode === "saved" && mine ? savedGrid : posts;
  const profileModes = ["posts", "reposts", "videos", ...(mine ? ["saved"] : [])];
  const gridTitle = profileMode === "saved" ? "Saved posts" : profileMode === "reposts" ? "Reposts" : profileMode === "videos" ? "Videos" : "Posts";
  const requested = api.db().requests.some(r => r.from === me.id && r.to === u.id);
  const friendRequests = Array.isArray(api.db().friendRequests) ? api.db().friendRequests : [];
  const friendRequested = friendRequests.some(r => r.from === me.id && r.to === u.id);
  const friendRequestIncoming = friendRequests.some(r => r.from === u.id && r.to === me.id);
  const isFriend = api.areFriends(me.id, u.id);
  const isCloseFriend = (me.closeFriends || []).includes(u.id);
  const visibleNote = !locked && Boolean(u.profileNote?.trim());
  const visibleCity = !locked && (mine || u.profileVisibility?.city !== false);
  const visibleInterests = !locked && (mine || u.profileVisibility?.interests !== false);
  const interestIds = visibleInterests && Array.isArray(u.interests) ? u.interests : [];
  const cityLine = u.city && visibleCity
    ? `<p class="sub profile-city">City · ${esc(u.city)}${mine && u.profileVisibility?.city === false ? `<small>Only you</small>` : ""}</p>`
    : "";
  const interestLine = interestIds.length
    ? `<div class="profile-interest-list" aria-label="Interests">${interestIds.map(id => `<span class="profile-interest-chip">${esc(profileInterestName(id))}</span>`).join("")}${mine && u.profileVisibility?.interests === false ? `<small>Only you</small>` : ""}</div>`
    : mine
      ? `<button type="button" class="profile-add-interests" id="edit-interests" data-testid="button-add-profile-interests">Add interests to your profile</button>`
      : "";
   shell(`<section class="screen on profile-screen"><div class="scroll profile-page">
    <div class="profile-hero">
      <div class="profile-cover"><img src="${esc(coverImage)}" alt="" /></div>
      <div class="profile-topbar"><button id="back" aria-label="Back">←</button><div class="row">${mine ? `<button id="settings-open" class="icon" aria-label="Open navigation menu" title="Menu">${ic.menu}</button>` : ""}<button id="sharep" class="profile-share" aria-label="Share profile" title="Share profile">${ic.share}</button></div></div>
      <div class="profile-intro">
        <div class="profile-identity">
          <div class="profile-avatar-wrap">
            <img class="profile-avatar" src="${u.avatar}" alt="" />
            ${mine ? `<button type="button" class="profile-note-bubble ${u.profileNote?.trim() ? "" : "empty"}" id="profile-note" aria-label="${u.profileNote?.trim() ? "Edit your note" : "Add a note"}">${esc(u.profileNote?.trim() || "Add a note")}</button>` : visibleNote ? `<span class="profile-note-bubble">${esc(u.profileNote.trim())}</span>` : ""}
          </div>
          <div><b class="profile-name">${esc(u.name)}${blueBadgeMarkup(u.cloudAccountId || u.id, esc)}</b><div class="sub">@${u.username}</div></div>
        </div>
        ${u.professional?.showCategory&&u.professional.accountType!=="personal"?`<small class="sub">${esc(u.professional.accountType==="creator"?u.professional.creatorCategory:u.professional.businessCategory)}</small>`:""}
        <div class="profile-stats">${fmt(posts.reduce((n,p)=>n+(p.measuredViews||0),0))} measured plays · ${fmt(u.followers.length)} followers · ${fmt(u.following.length)} following</div>
        <p class="cap">${esc(u.bio || "")}</p>${cityLine}${interestLine}
        <div class="row profile-primary-actions">${mine ? `<button class="followwide" id="edit">Edit</button><button class="followwide" id="logout">Log out</button>` : `<button class="followwide" id="pfollow">${me.following.includes(u.id) ? "Following" : requested ? "Requested" : "+ Follow"}</button>`}<button class="playround" id="playall">▶</button></div>
        ${mine ? `<div class="row"><button class="btn ghost small" data-creator-open="${getAccountTools().accountType==="creator"?"creator-studio":getAccountTools().accountType==="business"?"business-dashboard":"personal-activity"}">${getAccountTools().accountType==="creator"?"Creator Studio":getAccountTools().accountType==="business"?"Business Dashboard":"Your activity"}</button></div>` : ""}
        ${!mine ? `<div class="row profile-relationship-actions"><button class="btn ghost small" id="pfriend" aria-pressed="${isFriend}">${isFriend ? "Friends" : friendRequestIncoming ? "Accept Friend request" : friendRequested ? "Requested" : "+ Add Friend"}</button><button class="btn ghost small" id="pclosefriend" aria-pressed="${isCloseFriend}" ${!isFriend ? 'disabled title="Become Friends first"' : ""}>${isCloseFriend ? "In Close Friends" : "+ Close Friends"}</button></div>` : ""}
        ${!mine ? `<div class="row profile-actions"><button class="btn ghost small" id="pmsg" ${api.blocked(me.id, u.id) ? "disabled" : ""}>Message</button><button class="btn ghost small" id="pblock">${api.db().blocks.some(b => b.by === me.id && b.who === u.id) ? "Unblock" : "Block"}</button><button class="btn ghost small" id="prep">Report</button></div>` : ""}
      </div>
    </div>
    <div class="profile-body">
    <div class="seg">${profileModes.map(mode => `<button data-m="${mode}" class="${profileMode === mode ? "on" : ""}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join("")}</div>
    ${mine && profileMode === "saved" ? `<div class="profile-saved-collections" role="group" aria-label="Private saved collections">
      <button type="button" data-saved-filter="" aria-pressed="${!selectedCollection}" class="${!selectedCollection ? "selected" : ""}">${ic.bookmark}<span><b>All saved</b><small>Private · ${saved.length}</small></span></button>
      ${savedCollections.map(collection => `<button type="button" data-saved-filter="${esc(collection.id)}" aria-pressed="${selectedCollection?.id === collection.id}" class="${selectedCollection?.id === collection.id ? "selected" : ""}">${collection.cover ? `<img src="${esc(collection.cover)}" alt="" />` : ic.bookmark}<span><b>${esc(collection.name)}</b><small>Private · ${collection.count}</small></span></button>`).join("")}
    </div>` : ""}
    ${!locked && profileMode === "reposts" && repostedAuthors.size ? `<div class="profile-repost-faces" role="group" aria-label="Accounts in ${esc(u.name)}’s Reposts">${[...repostedAuthors.values()].map(({ author, post }) => `<button type="button" class="profile-repost-face" data-open="${esc(post.id)}" aria-label="Open repost of @${esc(author.username)}’s post" title="@${esc(author.username)}"><img src="${esc(author.avatar)}" alt="" /><span>${ic.repost}</span></button>`).join("")}</div>` : ""}
    ${locked ? `<div class="empty">This account is private.</div>` : `<div class="row" style="justify-content:space-between"><b>${gridTitle}</b><button class="sub" id="more">More</button></div>
      <div class="hooks">${grid.slice(0, profileMore ? grid.length : 8).map(p => `<button class="hookcard ${p.media?.[0] ? "" : "text-hookcard"}" data-open="${p.id}">${p.creativeProject ? creativeMediaMarkup(p, esc, false, true) : p.media?.[0] ? `<img src="${p.kind === "video" ? api.user(p.author)?.avatar || u.avatar : p.media[0]}" style="width:100%;height:100%;object-fit:cover" />` : `<div style="height:100%;background:var(--quote-bg)"></div>`}${profileMode === "reposts" ? `<span class="profile-repost-mark" aria-label="Repost">${ic.repost}</span>` : ""}<span class="profile-hook-caption">${esc((p.caption || "post").slice(0, 28))}<br>▶ ${fmt(p.views || 0)}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:space-between;margin-top:14px"><b>Recent</b></div>
      ${grid.slice(0, 5).map(p => `<button class="listbtn" data-open="${p.id}"><img src="${api.user(p.author).avatar}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" /><div><b>${esc(p.caption.slice(0, 32))}</b><div class="sub">${p.kind} · ${fmt(p.likes.length)} likes</div></div></button>`).join("") || `<div class="empty">No ${profileMode} yet.</div>`}`}
    </div>
   </div></section>`, "dark");
  $("#back").onclick = () => {
    if (backFromNotificationDetail()) return;
    if (navigateBack()) return;
    profileId = null;
    if (profileReturnChatId) {
      const previousChat = profileReturnChatId;
      profileReturnChatId = null;
      tab = "chat";
      chatId = previousChat;
    }
    render();
  };
  $("#settings-open") && ($("#settings-open").onclick = openAppDrawer);
  $("#profile-note") && ($("#profile-note").onclick = editProfileNote);
  $("#sharep") && ($("#sharep").onclick = () => { void shareProfile(u); });
  mountCreativeViewers(app, { onSource: openPostViewer, muted: true });
  $("#playall") && ($("#playall").onclick = () => {
    if (locked) return toast("This account is private");
    openProfilePostPlayback(u.id, posts);
  });
  $("#more") && ($("#more").onclick = () => { profileMore = !profileMore; render(); });
  $("#logout") && ($("#logout").onclick = () => { logoutAccount(); settingsView = "home"; tab = "updates"; chatId = null; profileId = null; profileReturnChatId = null; viewer = null; render(); });
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { profileMode = b.dataset.m; render(); });
  $("#pfollow") && ($("#pfollow").onclick = () => follow(u.id));
  $("#pfriend") && ($("#pfriend").onclick = () => friend(u.id));
  $("#pclosefriend") && ($("#pclosefriend").onclick = () => toggleCloseFriend(u.id));
  $("#pmsg") && ($("#pmsg").onclick = () => { profileReturnChatId = null; tab = "chat"; chatId = ensureConvo([u.id]); render(); });
  $("#pblock") && ($("#pblock").onclick = () => { mutate(db => { const i = db.blocks.findIndex(b => b.by === me.id && b.who === u.id); if (i >= 0) db.blocks.splice(i, 1); else db.blocks.push({ by: me.id, who: u.id }); }); render(); });
  $("#prep") && ($("#prep").onclick = () => { mutate(db => db.reports.push({ id: "rp" + Date.now(), by: me.id, target: u.id, reason: "profile", at: Date.now() })); toast("Report saved. Moderation unavailable."); });
  $("#edit") && ($("#edit").onclick = openEditProfile);
  $("#edit-interests") && ($("#edit-interests").onclick = openEditProfile);
  app.querySelectorAll("[data-saved-filter]").forEach(button => button.onclick = () => {
    savedCollectionId = button.dataset.savedFilter;
    render();
  });
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openPostViewer(b.dataset.open));
}
async function shareProfile(user) {
  const link = new URL(location.pathname, location.origin);
  link.searchParams.set("user", user.username);
  const result = await shareExternally({
    title: `@${user.username} on Oldtime`,
    text: `Check out @${user.username} on Oldtime.`,
    url: link.href
  });
  if (result === "cancelled") return;
  if (result === "failed") return toast("Couldn't share this profile");
  toast(result === "shared" ? "Profile shared" : "Profile link copied");
}
function openEditProfile() {
  navigationStack.push(captureNavigationState());
  tab = "profile-edit";
  profileId = null;
  chatId = null;
  viewer = null;
  render();
}

function editProfilePage() {
  const me = api.me();
  const defaultCover = automaticProfileCover(me);
  const selectedInterests = new Set((Array.isArray(me.interests) ? me.interests : [])
    .filter(id => PROFILE_INTERESTS.some(interest => interest.id === id)));
  let resetCover = false;
  let coverObjectUrl = "";
  shell(`<section class="screen on edit-profile-screen">
    <header class="profile-editor-header">
      <button type="button" id="profile-editor-back" class="profile-editor-back" data-testid="button-profile-editor-back" aria-label="Back">${ic.back}</button>
      <b>Edit profile</b>
      <button type="button" id="savep-header" class="profile-editor-header-save" data-testid="button-save-profile-header">Save</button>
    </header>
    <div class="edit-profile-scroll">
      <section class="profile-editor-avatar-section">
        <img class="profile-editor-avatar" src="${esc(me.avatar || "")}" alt="Profile photo" />
          <label class="profile-editor-photo-action" data-testid="button-profile-photo-upload" for="avatar-file">Edit picture or avatar</label>
        <input id="avatar-file" type="file" accept="image/*" data-testid="input-profile-photo" aria-label="Choose a profile photo" />
      </section>
      <div class="profile-editor-fields">
        <label class="profile-editor-field"><span>Name</span><input id="nm" data-testid="input-profile-name" value="${esc(me.name)}" placeholder="Add your name" autocomplete="name" /></label>
        <label class="profile-editor-field"><span>Username</span><input id="un" data-testid="input-profile-username" value="${esc(me.username)}" placeholder="username" autocomplete="username" autocapitalize="none" /></label>
        <label class="profile-editor-field"><span>Email</span><input id="em" data-testid="input-profile-email" type="email" value="${esc(me.email || "")}" placeholder="Email (optional)" autocomplete="email" /></label>
        <div class="profile-editor-bio">
          <label for="bio">Bio</label>
          <textarea id="bio" data-testid="input-profile-bio" placeholder="Write a short bio">${esc(me.bio || "")}</textarea>
          <button type="button" class="profile-editor-emoji" id="bio-emoji" aria-label="Add emoji to bio">${ic.smile}</button>
        </div>
        <label class="profile-editor-field"><span>Birthday</span><input id="birthday" data-testid="input-profile-birthday" type="date" value="${esc(me.birthday || "")}" /></label>
        <label class="profile-editor-field"><span>City</span><input id="city" data-testid="input-profile-city" value="${esc(me.city || "")}" placeholder="Add a city" autocomplete="address-level2" /></label>
      </div>
      <section class="profile-editor-cover-section">
        <div class="profile-editor-section-heading"><b>Profile cover</b></div>
        <img id="cover-preview" src="${esc(me.cover || defaultCover)}" alt="Current profile cover" />
        <label class="profile-editor-cover-upload" data-testid="button-profile-cover-upload" for="cover-file">Upload a custom cover</label>
        <input id="cover-file" type="file" accept="image/*" data-testid="input-profile-cover" aria-label="Choose a custom profile cover" />
        <button type="button" class="profile-editor-auto-cover" id="cover-auto" data-testid="button-profile-cover-auto" aria-pressed="false">Use automatic cover</button>
      </section>
      <section class="profile-editor-interests">
        <div class="profile-editor-section-heading"><b>Interests</b><small>Choose up to 8</small></div>
        <div class="profile-interest-picker" role="group" aria-label="Choose your interests">
          ${PROFILE_INTERESTS.map(interest => `<button type="button" class="profile-interest-option ${selectedInterests.has(interest.id) ? "selected" : ""}" data-profile-interest="${interest.id}" data-testid="button-interest-${interest.id}" aria-pressed="${selectedInterests.has(interest.id)}">${interest.label}</button>`).join("")}
        </div>
      </section>
    </div>
    <footer class="profile-editor-footer">
      <button type="button" class="profile-editor-save-cover" id="save-cover" data-testid="button-save-profile-cover" disabled>Save cover photo</button>
      <button type="button" class="profile-editor-save" id="savep" data-testid="button-save-profile">Save changes</button>
    </footer>
  </section>`, "light");
  $("#bio-emoji").onclick = () => openEmojiPicker($("#bio"));
  app.querySelectorAll("[data-profile-interest]").forEach(button => {
    button.onclick = () => {
      const interestId = button.dataset.profileInterest;
      if (selectedInterests.has(interestId)) selectedInterests.delete(interestId);
      else {
        if (selectedInterests.size >= 8) return toast("Choose up to 8 interests");
        selectedInterests.add(interestId);
      }
      button.classList.toggle("selected", selectedInterests.has(interestId));
      button.setAttribute("aria-pressed", String(selectedInterests.has(interestId)));
    };
  });
  const coverInput = $("#cover-file");
  const coverPreview = $("#cover-preview");
  const coverAutoButton = $("#cover-auto");
  const coverSaveButton = $("#save-cover");
  const avatarInput = $("#avatar-file");
  const releaseCoverPreview = () => {
    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = "";
  };
  const leaveEditor = () => {
    releaseCoverPreview();
    if (!navigateBack()) {
      tab = "updates";
      profileId = me.id;
      render();
    }
  };
  $("#profile-editor-back").onclick = leaveEditor;
  coverInput.onchange = () => {
    const coverFile = coverInput.files?.[0];
    if (!coverFile) return;
    if (!coverFile.type.startsWith("image/")) { toast("Choose an image"); coverInput.value = ""; return; }
    if (coverFile.size > 2 * 1024 * 1024) { toast("Files must be 2 MB or smaller."); coverInput.value = ""; return; }
    resetCover = false;
    coverAutoButton.setAttribute("aria-pressed", "false");
    coverAutoButton.textContent = "Use automatic cover";
    releaseCoverPreview();
    coverObjectUrl = URL.createObjectURL(coverFile);
    coverPreview.src = coverObjectUrl;
    coverSaveButton.disabled = false;
    coverSaveButton.textContent = "Save cover photo";
  };
  coverAutoButton.onclick = () => {
    resetCover = true;
    coverInput.value = "";
    releaseCoverPreview();
    if (defaultCover) coverPreview.src = defaultCover;
    else coverPreview.removeAttribute("src");
    coverAutoButton.setAttribute("aria-pressed", "true");
    coverAutoButton.textContent = "Automatic cover selected";
    coverSaveButton.disabled = false;
    coverSaveButton.textContent = "Save automatic cover";
  };
  coverSaveButton.onclick = async () => {
    const coverFile = coverInput.files?.[0];
    if (!coverFile && !resetCover) return;
    try {
      if (coverFile && !coverFile.type.startsWith("image/")) throw new Error("Choose an image.");
      if (coverFile && coverFile.size > 2 * 1024 * 1024) throw new Error("Files must be 2 MB or smaller.");
      const cover = coverFile ? (await fileToData(coverFile)).url : null;
      mutate(db => {
        const user = db.users.find(item => item.id === me.id);
        if (!user) throw new Error("Profile unavailable");
        if (coverFile) user.cover = cover;
        else delete user.cover;
      });
      releaseCoverPreview();
      if (coverFile) coverPreview.src = cover;
      else if (defaultCover) coverPreview.src = defaultCover;
      else coverPreview.removeAttribute("src");
      coverInput.value = "";
      resetCover = false;
      coverAutoButton.setAttribute("aria-pressed", String(!coverFile));
      coverAutoButton.textContent = coverFile ? "Use automatic cover" : "Automatic cover selected";
      coverSaveButton.disabled = true;
      coverSaveButton.textContent = coverFile ? "Cover photo saved" : "Automatic cover saved";
      toast(coverFile ? "Cover photo saved" : "Automatic cover saved");
    } catch (error) {
      toast(error.message);
    }
  };
  const profileSaveButtons = [$("#savep-header"), $("#savep")];
  const profileSaveLabels = profileSaveButtons.map(button => button.textContent);
  let savingProfile = false;
  const saveProfile = async () => {
    if (savingProfile) return;
    const username = $("#un").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("Bad username");
    if (api.db().users.some(u => u.username === username && u.id !== me.id)) return toast("Username taken");
    const email = $("#em").value.trim().toLowerCase();
    const emailError = profileEmailValidationMessage(email, me.email, value => api.emailInUse(value, me.id));
    if (emailError) return toast(emailError);
    const file = avatarInput.files?.[0];
    const coverFile = coverInput.files?.[0];
    const changes = { name: $("#nm").value.trim() || username, username, email, bio: $("#bio").value.trim(), city: $("#city").value.trim(), birthday: $("#birthday").value, interests: [...selectedInterests] };
    try {
      savingProfile = true;
      profileSaveButtons.forEach(button => {
        button.disabled = true;
        button.textContent = "Saving…";
      });
      if (file && !file.type.startsWith("image/")) return toast("Choose an image");
      if (coverFile && !coverFile.type.startsWith("image/")) return toast("Choose an image");
      const avatar = file ? (await fileToData(file)).url : me.avatar;
      const cover = coverFile ? (await fileToData(coverFile)).url : null;
      mutate(db => {
        const u = db.users.find(x => x.id === me.id);
        Object.assign(u, { ...changes, avatar });
        if (coverFile) u.cover = cover;
        else if (resetCover) delete u.cover;
      });
    } catch (e) { toast(e.message); return; }
    finally {
      savingProfile = false;
      profileSaveButtons.forEach((button, index) => {
        button.disabled = false;
        button.textContent = profileSaveLabels[index];
      });
    }
    releaseCoverPreview();
    if (!navigateBack()) {
      tab = "updates";
      profileId = me.id;
      render();
    }
    toast("Profile updated");
  };
  profileSaveButtons.forEach(button => { button.onclick = saveProfile; });
}

function editProfileNote() {
  const me = api.me();
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel profile-note-panel"><div class="grab"></div><b>Your note</b>
    <p class="sub">This note appears above your profile photo.</p>
    <textarea class="field" id="note-text" maxlength="80" placeholder="Write a short note…">${esc(me.profileNote || "")}</textarea>
    <div class="note-form-row"><span class="sub" id="note-count"></span>${me.profileNote?.trim() ? `<button type="button" class="sub" id="remove-note">Remove note</button>` : ""}</div>
    <button type="button" class="btn" id="save-note">Save note</button></div>`;
  const input = $("#note-text");
  const updateCount = () => { $("#note-count").textContent = `${input.value.length}/80`; };
  updateCount();
  input.oninput = updateCount;
  $("#save-note").onclick = () => {
    const profileNote = input.value.trim();
    try {
      mutate(db => {
        const user = db.users.find(item => item.id === me.id);
        if (!user) throw new Error("Profile unavailable");
        user.profileNote = profileNote;
      });
    } catch (error) { return toast(error.message); }
    sheet.classList.remove("on");
    render();
    toast(profileNote ? "Note saved" : "Note removed");
  };
  $("#remove-note")?.addEventListener("click", () => {
    try { mutate(db => { const user = db.users.find(item => item.id === me.id); if (user) user.profileNote = ""; }); }
    catch (error) { return toast(error.message); }
    sheet.classList.remove("on");
    render();
    toast("Note removed");
  });
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
function postViewer(id) {
  const p = api.post(id);
  if (!p || !api.canSeePost(p)) { viewer = null; render(); toast("Post unavailable"); return; }
  shell(`<section class="screen on"><div class="topbar"><button id="back">←</button><b>@${api.user(p.author).username}</b><span></span></div><div class="feed">${postCard(p)}</div></section>`);
  $("#back").onclick = () => {
    if (backFromNotificationDetail()) return;
    if (navigateBack()) return;
    viewer = null;
    render();
  };
  bindPosts();
  if (pendingSharedComment && params.get("post") === id) {
    const commentId = pendingSharedComment;
    pendingSharedComment = "";
    comments(id, commentId);
  }
}
function ensureConvo(ids) { return makeConvo(ids); }
function chats() {
  openChatList({
    shell, toast, esc, ago, app, $: (q) => $(q), render,
    setChat: (id) => { chatId = id; render(); },
    openProfile: id => navigateToProfile(id, { fromChat: true }),
    openStory: authorId => openStory(authorId),
    editProfileNote
  });
}
function thread(id) {
  openThread(id, { shell, toast, esc, ago, app, $: (q) => $(q), render, setChat: (id) => { chatId = id; render(); }, openProfile: id => navigateToProfile(id, { fromChat: true }), openSharedPost: openPostViewer });
}

function isCloseFriendsStory(story) {
  const visibility = String(story?.visibility || story?.audience || "").toLowerCase().replace(/_/g, "-");
  return story?.closeFriends === true || visibility === "close-friends";
}

function communities() {
  const me = api.me();
  const activeStories = api.db().stories
    .filter(story => Date.now() - story.created < 864e5 && api.canSeeStory(story))
    .sort((a, b) => b.created - a.created);
  const storyByAuthor = new Map();
  activeStories.forEach(story => { if (!storyByAuthor.has(story.author)) storyByAuthor.set(story.author, story); });
  const notePeople = api.db().users.filter(person => person.id !== me.id && person.profileNote?.trim() && api.canSee(person.id));
  const friendIds = [...new Set([me.id, ...storyByAuthor.keys(), ...notePeople.map(person => person.id)])];
  const followed = new Set(me.following || []);
  const visiblePosts = api.posts().sort((a, b) => b.created - a.created);
  const followingPosts = visiblePosts.filter(post => followed.has(post.author) && post.kind !== "text");
  const discoverPosts = visiblePosts.filter(post =>
    post.kind !== "text" && post.author !== me.id && !followed.has(post.author) && post.visibility !== "followers"
  );
  const quotePosts = visiblePosts.filter(post => post.kind === "text");
  const myInterests = new Set(Array.isArray(me.interests) ? me.interests : []);
  const canMatchMyInterests = me.profileVisibility?.interests !== false;
  const canMatchMyCity = me.profileVisibility?.city !== false;
  const suggestedPeople = api.db().users
    .filter(person => person.id !== me.id && !followed.has(person.id) && api.canSee(person.id))
    .map(person => {
      const personInterests = new Set(Array.isArray(person.interests) ? person.interests : []);
      const sharedInterests = canMatchMyInterests && person.profileVisibility?.interests !== false
        ? [...myInterests].filter(id => personInterests.has(id))
        : [];
      const sameCity = canMatchMyCity
        && person.profileVisibility?.city !== false
        && cityMatchKey(me.city)
        && cityMatchKey(me.city) === cityMatchKey(person.city);
      return { person, sharedInterests, sameCity };
    })
    .filter(match => match.sharedInterests.length || match.sameCity)
    .sort((a, b) => b.sharedInterests.length - a.sharedInterests.length || Number(b.sameCity) - Number(a.sameCity) || (a.person.name || a.person.username).localeCompare(b.person.name || b.person.username))
    .slice(0, 8);
  const suggestedPeopleCards = suggestedPeople.map(({ person, sharedInterests, sameCity }) => {
    const matchSummary = [
      sameCity ? `City · ${esc(person.city)}` : "",
      ...sharedInterests.map(id => profileInterestName(id))
    ].filter(Boolean);
    const matchCount = sharedInterests.length;
    const matchTitle = matchCount
      ? `${matchCount} shared ${matchCount === 1 ? "interest" : "interests"}${sameCity ? " · Same city" : ""}`
      : "Same city";
    return `<article class="people-match-card" data-testid="card-person-match-${esc(person.id)}">
      <div class="people-match-person">
        <img src="${esc(person.avatar)}" alt="" />
        <div class="people-match-identity"><b>${esc(person.name || person.username)}</b><small>@${esc(person.username)}</small></div>
      </div>
      <p class="people-match-reason">${matchTitle}</p>
      <div class="people-match-tags">${matchSummary.map(label => `<span>${label}</span>`).join("")}</div>
      <div class="people-match-actions">
        <button type="button" class="people-match-view" data-vibe-profile="${esc(person.id)}" data-testid="button-view-match-${esc(person.id)}">View profile</button>
        <button type="button" class="people-match-follow" data-vibe-follow="${esc(person.id)}" data-testid="button-follow-match-${esc(person.id)}">Follow</button>
      </div>
    </article>`;
  }).join("");
  const peopleMatchEmpty = myInterests.size
    ? "No new matches yet. Try adding another interest."
    : "Choose a few interests to find people with more in common.";
  const storyTiles = friendIds.map((id, index) => {
    const person = api.user(id);
    if (!person) return "";
    const own = person.id === me.id;
    const story = storyByAuthor.get(person.id);
    const note = person.profileNote?.trim();
    const openTarget = story || own
      ? `data-story="${esc(person.id)}" aria-label="${own ? "Open your story" : `View ${esc(person.name || person.username)}'s story`}"`
      : `data-profile-note="${esc(person.id)}" aria-label="Open ${esc(person.name || person.username)}'s profile"`;
    const noteLine = own || note
      ? `<span class="friend-note ${own && !note ? "empty" : ""}"${note ? ` title="${esc(note)}"` : ""}><span class="friend-note-text">${esc(note || "Add a note")}</span></span>`
      : `<span class="friend-note-slot" aria-hidden="true"></span>`;
    const ringClass = [own ? "own-ring" : `ring-${index % 4}`, isCloseFriendsStory(story) ? "close-friends" : ""].filter(Boolean).join(" ");
    return `<button class="friend-story ${own ? "own-story" : ""} ${own || note ? "has-note" : ""}" ${openTarget}>
      <span class="friend-ring ${ringClass}"><img src="${esc(person.avatar)}" alt="" /></span>
      <span class="friend-name">${own ? "Your story" : esc(person.name || person.username)}</span>
      ${noteLine}
      ${own ? `<i class="story-plus">${ic.plus}</i>` : story?.kind === "video" ? `<i class="story-play">${ic.play}</i>` : ""}
    </button>`;
  }).join("");
  const followingCards = followingPosts.map(post => storyPostCard(post, "following")).join("");
  const discoverCards = discoverPosts.map(post => storyPostCard(post, "discover")).join("");
  const unread = api.db().notes.filter(note => note.user === me.id && !note.read).length;
  shell(`<section class="screen on community-screen">
    <div class="stories-feed-scroll">
      <header class="stories-header">
        <button class="stories-avatar" id="stories-profile" aria-label="Open your profile"><img src="${esc(me.avatar)}" alt="" /></button>
        <button class="stories-action" id="stories-search" aria-label="Search">${ic.search}</button>
        <h1>Community</h1>
        <button class="stories-action" id="stories-notifications" aria-label="${unread ? `Notifications, ${unread} unread` : "Notifications"}">${ic.bell}${unread ? `<i class="stories-notice">${unread > 9 ? "9+" : unread}</i>` : ""}</button>
        <button class="stories-action" id="stories-add-friend" aria-label="Find people">${ic.user}${ic.plus}</button>
        <button class="stories-action" id="stories-more" aria-label="Open navigation menu" title="Menu">${ic.menu}</button>
      </header>
      <section class="stories-section people-match-section">
        <div class="people-match-heading"><h2 class="stories-heading">People you might vibe with</h2><button type="button" id="edit-match-interests" data-testid="button-edit-match-interests">Edit interests</button></div>
        <div class="people-match-carousel" aria-label="People with shared interests or city">${suggestedPeopleCards || `<div class="people-match-empty">${peopleMatchEmpty}<button type="button" data-edit-match-interests data-testid="button-add-match-interests">Choose interests</button></div>`}</div>
      </section>
      <section class="stories-section friends-section">
        <h2 class="stories-heading">Friends <span aria-hidden="true">›</span></h2>
        <div class="friends-carousel" aria-label="Friends' stories">${storyTiles || `<div class="stories-empty">No stories to show yet.</div>`}</div>
      </section>
      <section class="stories-section quotes-section">
        <h2 class="stories-heading">
          <button class="quotes-open" id="open-community-quotes" type="button" aria-haspopup="dialog" aria-controls="sheet" aria-expanded="false">
            <span>Quotes</span><span class="quotes-open-count">${quotePosts.length}</span><span class="quotes-open-arrow" aria-hidden="true">›</span>
          </button>
        </h2>
      </section>
      <section class="stories-section following-section">
        <h2 class="stories-heading">Following <span aria-hidden="true">›</span></h2>
        <div class="posts-carousel" aria-label="Posts from people you follow">${followingCards || `<div class="stories-empty">Posts from people you follow will appear here.</div>`}</div>
      </section>
      <section class="stories-section discover-section">
        <h2 class="stories-heading">Explore <span aria-hidden="true">›</span></h2>
        <div class="discover-grid">${discoverCards || `<div class="stories-empty discover-empty">No public posts to explore right now.</div>`}</div>
      </section>
    </div>
  </section>`, "light");
  $("#stories-profile").onclick = () => navigateToProfile(me.id);
  $("#stories-search").onclick = () => { navigationStack.push(captureNavigationState()); tab = "search"; render(); };
  $("#stories-add-friend").onclick = () => { navigationStack.push(captureNavigationState()); tab = "search"; render(); };
  $("#stories-notifications").onclick = openNotifications;
  $("#stories-more").onclick = openAppDrawer;
  mountCreativeViewers(app, {onSource:openPostViewer,muted:true});
  $("#edit-match-interests").onclick = openEditProfile;
  app.querySelector("[data-edit-match-interests]")?.addEventListener("click", openEditProfile);
  $("#open-community-quotes").onclick = () => openCommunityQuotes(quotePosts);
  app.querySelectorAll("[data-story]").forEach(button => button.onclick = event => {
    if (button.classList.contains("own-story") && event.target.closest(".friend-note")) return editProfileNote();
    openStory(button.dataset.story);
  });
  app.querySelectorAll("[data-profile-note]").forEach(button => button.onclick = () => {
    navigateToProfile(button.dataset.profileNote);
  });
  app.querySelectorAll("[data-stories-post]").forEach(button => button.onclick = () => {
    openPostViewer(button.dataset.storiesPost);
  });
  app.querySelectorAll("[data-vibe-profile]").forEach(button => button.onclick = () => {
    navigateToProfile(button.dataset.vibeProfile);
  });
  app.querySelectorAll("[data-vibe-follow]").forEach(button => button.onclick = () => follow(button.dataset.vibeFollow));
}

function openCommunityQuotes(posts) {
  const sheet = $("#sheet");
  const trigger = $("#open-community-quotes");
  if (!sheet) return;
  const close = () => {
    sheet.classList.remove("on");
    sheet.innerHTML = "";
    sheet.onclick = null;
    sheet.onkeydown = null;
    trigger?.setAttribute("aria-expanded", "false");
    trigger?.focus();
  };
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel quotes-panel" role="dialog" aria-modal="true" aria-labelledby="community-quotes-title" tabindex="-1">
    <div class="grab" aria-hidden="true"></div>
    <div class="quotes-drawer-header">
      <div><b id="community-quotes-title">Quotes</b><small>${posts.length} ${posts.length === 1 ? "quote" : "quotes"}</small></div>
      <button class="quotes-close" id="close-community-quotes" type="button" aria-label="Close quotes">×</button>
    </div>
    <div class="community-quotes quotes-drawer-list" aria-label="Text posts from the community">
      ${posts.map(communityQuoteCard).join("") || `<div class="stories-empty quote-empty">No quotes yet.</div>`}
    </div>
  </div>`;
  trigger?.setAttribute("aria-expanded", "true");
  mountCreativeViewers(sheet,{onSource:openPostViewer,muted:true});
  sheet.onclick = event => { if (event.target === sheet) close(); };
  sheet.onkeydown = event => { if (event.key === "Escape") close(); };
  $("#close-community-quotes", sheet).onclick = close;
  sheet.querySelectorAll("[data-stories-post]").forEach(button => button.onclick = () => {
    close();
    openPostViewer(button.dataset.storiesPost);
  });
  $("#close-community-quotes", sheet).focus();
}

function storyPostCard(post, type) {
  const author = api.user(post.author);
  const cover = post.media?.[0];
  const visual = post.creativeProject ? creativeMediaMarkup(post,esc,false,true) : post.kind === "video" && cover
    ? `<img src="${esc(author?.avatar || "")}" alt="" loading="lazy" />`
    : cover
      ? `<img src="${esc(cover)}" alt="" loading="lazy" />`
      : `<div class="story-text-visual">${esc(post.caption.slice(0, 70))}</div>`;
  const caption = (post.caption || "").replace(/\s+/g, " ").trim();
  return `<button class="story-post-card ${type}-post-card" data-stories-post="${esc(post.id)}" aria-label="Open post by ${esc(author?.name || "user")}: ${esc(caption)}">
    ${visual}<span class="story-card-shade"></span>
    <span class="story-card-copy"><b>${esc(author?.name || author?.username || "Oldtime member")}</b>${type === "discover" ? `<small>${esc(caption.slice(0, 54))}${caption.length > 54 ? "…" : ""}</small>` : ""}</span>
    ${post.kind === "video" ? `<span class="story-card-play">${ic.play}</span>` : ""}
  </button>`;
}

function communityQuoteCard(post) {
  const author = api.user(post.author);
  if (!author) return "";
  const caption = (post.caption || "").trim();
  return `<button class="community-quote" data-stories-post="${esc(post.id)}" aria-label="Open quote by @${esc(author.username)}">
    <img class="community-quote-avatar" src="${esc(author.avatar)}" alt="" loading="lazy" />
    <span class="community-quote-content">
      <span class="community-quote-author">${esc(author.name || author.username)} <small>@${esc(author.username)} · ${ago(post.created)}</small></span>
      <span class="community-quote-text">${post.creativeProject ? creativeMediaMarkup(post,esc) : esc(caption)}</span>
      <span class="community-quote-activity">${ic.heartOn}<small>${fmt(post.likes.length)}</small>${ic.commentFilled}<small>${fmt(post.comments.length)}</small></span>
    </span>
  </button>`;
}

function search() {
  const q = searchQ.toLowerCase().replace("#", "");
  const users = api.db().users.filter(u => u.id !== api.me().id && !api.blocked(api.me().id, u.id) && (!q || u.username.includes(q) || u.name.toLowerCase().includes(q)));
  const posts = api.posts().filter(p => !q || p.caption.toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)) || (p.location || "").toLowerCase().includes(q));
  const tags = [...new Set(api.posts().flatMap(p => p.tags || []))].filter(t => !q || t.includes(q)).slice(0, 8);
  shell(`<section class="screen on"><div class="scroll page"><button class="sub" id="back" aria-label="Back to previous screen">← Back</button><div class="h1">Search</div>
    <input class="search" id="q" placeholder="People, posts, #tags, places" value="${esc(searchQ)}" />
    <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tags.map(t => `<button class="chip" data-tag="${t}">#${t}</button>`).join("")}</div>
    ${users.slice(0, 8).map(u => `<button class="listbtn" data-profile="${u.id}"><img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" /><div><b>@${u.username}</b><div class="sub">${esc(u.bio || u.city || "")}</div></div></button>`).join("")}
    <div class="grid3" style="margin-top:10px">${posts.slice(0, 12).map(p => `<button class="cell" data-open="${p.id}">${p.creativeProject ? creativeMediaMarkup(p, esc, false, true) : p.media?.[0] ? (p.kind === "video" ? `<video src="${p.media[0]}" muted></video>` : `<img src="${p.media[0]}" />`) : `<div class="textpost" style="height:100%"><p style="font-size:12px">${esc(p.caption.slice(0, 30))}</p></div>`}</button>`).join("")}</div>
    ${!users.length && !posts.length ? `<div class="empty">No results. Try a name, hashtag, or place.</div>` : ""}
  </div></section>`);
  $("#back").onclick = () => {
    if (!navigateBack()) { tab = "updates"; profileId = null; viewer = null; render(); }
  };
  $("#q").oninput = (e) => { const position = e.target.selectionStart; searchQ = e.target.value; render(); $("#q").focus(); $("#q").setSelectionRange(position, position); };
  app.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { searchQ = b.dataset.tag; render(); });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => navigateToProfile(b.dataset.profile));
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openPostViewer(b.dataset.open));
}

function notes() {
  const me = api.me();
  const reqs = api.db().requests.filter(r => r.to === me.id);
  const friendReqs = (Array.isArray(api.db().friendRequests) ? api.db().friendRequests : [])
    .filter(r => r.to === me.id && api.user(r.from));
  mutate(db => db.notes.forEach(n => { if (n.user === me.id) n.read = true; }));
  const filters = [["all","All"],["following","People you follow"],["comments","Comments"],["activity","Activity"],["requests","Requests"]];
  const followedActors = new Set(Array.isArray(me.following) ? me.following : []);
  const commentKinds = new Set(["comment", "reply", "comment-remix"]);
  const activityKinds = new Set(["follow", "like", "share", "friend-accepted"]);
  const filteredRequests = notificationFilter === "all" || notificationFilter === "requests" ? reqs : [];
  const filteredFriendRequests = notificationFilter === "all" || notificationFilter === "requests" ? friendReqs : [];
  const filteredNotes = api.db().notes
    .filter(note => note.user === me.id && (
      notificationFilter === "all" ||
      (notificationFilter === "following" && followedActors.has(note.actor)) ||
      (notificationFilter === "comments" && commentKinds.has(note.kind)) ||
      (notificationFilter === "activity" && activityKinds.has(note.kind))
    ))
    .sort((a, b) => (b.created || 0) - (a.created || 0));
  shell(`<section class="screen on"><div class="scroll page"><div class="notifications-header"><button id="back" class="icon" aria-label="Back to previous screen" title="Back">${ic.back}</button><div class="h1">Notifications</div><span aria-hidden="true"></span></div>
    <button type="button" class="listbtn" data-creator-open="announcements"><span>${ic.bell}</span><span>Announcements &amp; preferences</span></button>
    <nav class="notification-filters" aria-label="Filter notifications">${filters.map(([value,label]) => `<button type="button" class="notification-filter ${notificationFilter === value ? "is-active" : ""}" data-note-filter="${value}" aria-pressed="${notificationFilter === value}">${label}${value === "requests" && reqs.length + friendReqs.length ? `<span>${reqs.length + friendReqs.length}</span>` : ""}</button>`).join("")}</nav>
    ${filteredFriendRequests.map(r => `<div class="listbtn"><img src="${api.user(r.from)?.avatar || ""}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(r.from)?.username || "member"}</b> wants to be Friends<div class="row"><button class="btn small" data-friend-accept="${r.from}">Accept</button><button class="btn ghost small" data-friend-decline="${r.from}">Decline</button></div></div></div>`).join("")}
    ${filteredRequests.map(r => `<div class="listbtn"><img src="${api.user(r.from)?.avatar || ""}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(r.from)?.username || "member"}</b> requested to follow<div class="row"><button class="btn small" data-acc="${r.from}">Accept</button><button class="btn ghost small" data-dec="${r.from}">Decline</button></div></div></div>`).join("")}
    ${filteredNotes.map(n => `<button class="listbtn notification-row" data-note="${n.id}"><img src="${api.user(n.actor)?.avatar || ""}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(n.actor)?.username || "someone"}</b> ${esc(n.body)}<div class="sub">${ago(n.created)}</div></div></button>`).join("") || (filteredRequests.length || filteredFriendRequests.length ? "" : `<div class="empty">${notificationFilter === "requests" ? "No follow or Friend requests right now." : notificationFilter === "all" ? "You’re caught up." : notificationFilter === "following" ? "No activity from people you follow yet." : notificationFilter === "comments" ? "No comment activity yet." : "No post activity yet."}</div>`)}
  </div></section>`);
  $("#back").onclick = leaveNotifications;
  app.querySelectorAll("[data-note-filter]").forEach(button => button.onclick = () => { notificationFilter = button.dataset.noteFilter; notes(); });
  app.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { mutate(db => { const from = b.dataset.acc; const meU = db.users.find(u => u.id === me.id); const them = db.users.find(u => u.id === from); if (!meU.followers.includes(from)) meU.followers.push(from); if (!them.following.includes(me.id)) them.following.push(me.id); db.requests = db.requests.filter(r => !(r.from === from && r.to === me.id)); }); render(); });
  app.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { mutate(db => { db.requests = db.requests.filter(r => !(r.from === b.dataset.dec && r.to === me.id)); }); render(); });
  app.querySelectorAll("[data-friend-accept]").forEach(b => b.onclick = () => respondToFriendRequest(b.dataset.friendAccept, true));
  app.querySelectorAll("[data-friend-decline]").forEach(b => b.onclick = () => respondToFriendRequest(b.dataset.friendDecline, false));
  app.querySelectorAll("[data-note]").forEach(b => b.onclick = () => {
    const n = api.db().notes.find(x => x.id === b.dataset.note);
    if (!n) return;
    notificationsReturnStack.push(captureNavigationState());
    if (n.story) { openStory(n.actor); }
    else if (n.post) { viewer = n.post; profileId = null; tab = "updates"; render(); }
    else if (n.actor) { profileId = n.actor; viewer = null; tab = "updates"; render(); }
  });
}

function settings() {
  const me = api.me();
  if (!api.db().settings) mutate(db => { db.settings = { readReceipts: true, lastSeen: "everyone" }; });
  const prefs = api.db().settings;
  const blocked = api.db().blocks.filter(b => b.by === me.id);
  const titles = { home: "Settings", password: "Password", privacy: "Account privacy", "close-friends": "Close Friends", chat: "Chat privacy", notifications: "Notifications", blocked: "Blocked accounts", help: "Help & Support", about: "About", campaigns: "Campaigns", "privacy-center": "Privacy Center" };
  const editableSettingsViews = new Set(["privacy", "close-friends", "chat", "notifications"]);
  const settingsDraft = {
    isPrivate: Boolean(me.private),
    showCity: me.profileVisibility?.city !== false,
    showInterests: me.profileVisibility?.interests !== false,
    readReceipts: prefs.readReceipts !== false,
    lastSeen: prefs.lastSeen || "everyone",
    notifications: me.notifs !== false,
    closeFriends: new Set(Array.isArray(me.closeFriends) ? me.closeFriends : [])
  };
  const initialSettingsDraft = { ...settingsDraft, closeFriends: new Set(settingsDraft.closeFriends) };
  const sameSet = (left, right) => left.size === right.size && [...left].every(id => right.has(id));
  const hasUnsavedSettings = () => {
    if (settingsView === "privacy") {
      return settingsDraft.isPrivate !== initialSettingsDraft.isPrivate ||
        settingsDraft.showCity !== initialSettingsDraft.showCity ||
        settingsDraft.showInterests !== initialSettingsDraft.showInterests;
    }
    if (settingsView === "close-friends") return !sameSet(settingsDraft.closeFriends, initialSettingsDraft.closeFriends);
    if (settingsView === "chat") {
      return settingsDraft.readReceipts !== initialSettingsDraft.readReceipts ||
        settingsDraft.lastSeen !== initialSettingsDraft.lastSeen;
    }
    if (settingsView === "notifications") return settingsDraft.notifications !== initialSettingsDraft.notifications;
    return false;
  };
  const updateSettingsSaveState = () => {
    const saveButton = $("#settings-save");
    if (!saveButton) return;
    const dirty = hasUnsavedSettings();
    hasPendingSettingsChanges = dirty;
    saveButton.disabled = !dirty;
    const status = $("#settings-save-status");
    if (status) status.textContent = dirty ? "Unsaved changes" : "";
  };
  let content = "";
  let extra = null;
  const entry = (iconName, label, summary, view, id = "") => {
    const value = view === "privacy" ? (me.private ? "Private" : "Public")
      : view === "close-friends" ? String((me.closeFriends || []).length)
      : view === "blocked" ? String(blocked.length)
      : view === "notifications" ? (me.notifs === false ? "Off" : "On")
      : view === "chat" ? `${prefs.readReceipts === false ? "Receipts off" : "Receipts on"} · ${prefs.lastSeen || "everyone"}`
      : "";
    return `<button type="button" class="settings-entry" data-testid="button-settings-${id || view}" ${view ? `data-settings="${view}"` : ""} ${id ? `id="${id}"` : ""}>
      <span class="settings-entry-icon">${ic[iconName] || ic.more}</span>
      <span class="settings-entry-copy"><b>${label}</b>${summary ? `<small>${summary}</small>` : ""}</span>
      ${value ? `<small class="settings-entry-value">${value}</small>` : ""}
      <span class="settings-entry-chevron" aria-hidden="true">›</span>
    </button>`;
  };
  if (settingsView === "home") {
    content = `<div class="settings-home" id="settings-home">
      <button type="button" class="settings-account-card" data-settings-profile data-testid="button-settings-view-profile">
        <img src="${esc(me.avatar || "")}" alt="" />
        <span><b>${esc(me.name || me.username)}</b><small>@${esc(me.username)}</small></span>
        <span class="settings-account-action">View profile</span>
      </button>
      <label class="settings-search"><span aria-hidden="true">${ic.search}</span><input id="settings-search" type="search" placeholder="Search settings" aria-label="Search settings" /></label>
      <div class="settings-groups">
      <section class="settings-group" data-settings-group><h2>Your account</h2>
        <button type="button" class="settings-entry" data-creator-open="account-type"><span class="settings-entry-icon">${ic.user}</span><span class="settings-entry-copy"><b>Account Type</b><small>${esc(getAccountTools().accountType)} · Change your tools, not your identity.</small></span></button>
        <button type="button" class="settings-entry" data-creator-open="${getAccountTools().accountType==="creator"?"creator-studio":getAccountTools().accountType==="business"?"business-dashboard":"personal-activity"}"><span class="settings-entry-icon">${ic.user}</span><span class="settings-entry-copy"><b>${getAccountTools().accountType==="creator"?"Creator Studio":getAccountTools().accountType==="business"?"Business Dashboard":"Your activity"}</b><small>Your recorded profile visits, views and engagement.</small></span></button>
        ${getAccountTools().accountType==="creator"?'<button type="button" class="settings-entry" data-creator-open="creator-center"><span class="settings-entry-icon">'+ic.user+'</span><span class="settings-entry-copy"><b>Creator Center</b><small>Your progress and creator status.</small></span></button>':""}
        <button type="button" class="settings-entry" data-creator-open="blue-badge"><span class="settings-entry-icon">${ic.check}</span><span class="settings-entry-copy"><b>Blue Badge</b><small>Membership and benefits.</small></span></button>
        <button type="button" class="settings-entry" data-creator-open="announcements"><span class="settings-entry-icon">${ic.bell}</span><span class="settings-entry-copy"><b>Notifications &amp; Announcements</b><small>Creator updates, announcements, and offers.</small></span></button>
        ${entry("user", "Edit profile", "Update your photo, bio and interests.", "", "edit")}
        ${entry("lock", "Password", "Change your account password.", "password")}
        ${entry("settings", "About Oldtime", "Learn how this app works.", "about")}
      </section>
      ${settingGroups.map(group => `<section class="settings-group" data-settings-group><h2>${group.title}</h2>${group.items.map(([label, summary, id]) => {
        const direct = ({ privacy:"privacy", "close-friends":"close-friends", chat:"chat", notifications:"notifications", blocked:"blocked", "profile-visibility":"privacy" })[id];
        const iconName = ({ privacy:"lock", "close-friends":"users", chat:"comment", notifications:"bell", blocked:"lock", "profile-visibility":"user" })[id] || "settings";
        return entry(iconName, label, summary, direct || `setting-${id}`);
      }).join("")}</section>`).join("")}
      <section class="settings-group" data-settings-group><h2>Help and support</h2>
        ${entry("comment", "Help & Support", "Quick answers and practical guides.", "help")}
        ${entry("lock", "Privacy Center", "Manage your privacy and data.", "privacy-center")}
        ${entry("users", "Campaigns", "Find and share community support.", "campaigns")}
      </section>
      <section class="settings-group settings-account-actions" data-settings-group>
        <h2>Account actions</h2>
        ${entry("refresh", "Clear all app data", "Remove accounts and content from this device.", "", "reset")}
        ${entry("back", "Log out", "", "", "out")}
      </section>
      </div>
      <div class="settings-empty-search" id="settings-no-results" role="status" hidden>No settings match that search.</div>
    </div>`;
  } else if (settingsView.startsWith("campaign") || settingsView === "help" || settingsView.startsWith("help-") || settingsView === "privacy-center" || settingsView.startsWith("privacy-topic-")) {
    extra = extraScreen(settingsView, { api, me, db: api.db(), mutate, toast, campaignId: selectedCampaignId, navigate: route => {
      if (route === "edit-profile") return openEditProfile();
      if (["account-type","personal-activity","creator-studio","business-dashboard","monthly-recap","best-practices","inspiration","blue-badge"].includes(route)) return navigateFromDrawer(route);
      if (route.startsWith("campaign:")) selectedCampaignId = route.slice(9);
      else if (route === "campaign-edit") selectedCampaignId = settingsView.startsWith("campaign:") ? settingsView.slice(9) : selectedCampaignId;
      settingsView = route;
      render();
    } });
    content = extra.content;
    titles[settingsView] = extra.title;
  } else if (settingsView === "password") {
    content = api.authProvider() === "cognito"
      ? `<p class="sub">Choose “Forgot your password?” on the secure sign-in page to reset your password.</p><button class="btn primary" id="cognito-password" type="button">Open secure sign-in</button><div id="cognito-account-link" style="display:contents"></div>`
      : `<div id="cognito-account-link" style="display:contents"></div><form class="settings-password-form" id="password-form"><input class="field" id="cp" type="password" autocomplete="current-password" placeholder="Current password" aria-label="Current password" required />
      <input class="field" id="np" type="password" autocomplete="new-password" placeholder="New password (8–128 characters)" aria-label="New password" minlength="8" maxlength="128" required />
      <input class="field" id="confirm-pass" type="password" autocomplete="new-password" placeholder="Confirm password" aria-label="Confirm password" minlength="8" maxlength="128" required />
      <button class="btn" id="sp" type="submit" style="margin-top:8px">Save password</button></form>`;
  } else if (settingsView === "privacy") {
    content = `
      <button type="button" class="listbtn" id="private-toggle" data-testid="button-toggle-private" aria-pressed="${settingsDraft.isPrivate}">Private account · ${settingsDraft.isPrivate ? "On" : "Off"}</button>
      <div class="profile-visibility-settings">
        <b>Profile details</b>
        <button type="button" class="listbtn" data-profile-visibility="city" data-testid="button-toggle-city-visibility" aria-pressed="${settingsDraft.showCity}">Show city on profile · ${settingsDraft.showCity ? "On" : "Off"}</button>
        <button type="button" class="listbtn" data-profile-visibility="interests" data-testid="button-toggle-interest-visibility" aria-pressed="${settingsDraft.showInterests}">Show interests on profile · ${settingsDraft.showInterests ? "On" : "Off"}</button>
      </div>`;
  } else if (settingsView === "close-friends") {
    content = `
      <div class="sub close-friends-count" id="close-friends-count">${settingsDraft.closeFriends.size} added</div>
      <p class="sub">Only confirmed Friends can be added to Close Friends.</p>
      <input class="search" id="close-friends-search" type="search" placeholder="Search Friends" aria-label="Search Friends for Close Friends" />
      <div id="close-friends-list" aria-live="polite"></div>`;
  } else if (settingsView === "chat") {
    content = `
      <button type="button" class="listbtn" id="receipts-toggle" data-testid="button-toggle-read-receipts" aria-pressed="${settingsDraft.readReceipts}">Read receipts · ${settingsDraft.readReceipts ? "On" : "Off"}</button>
      <div class="settings-choice-block"><b>Last seen</b><div class="seg">${["everyone", "contacts", "nobody"].map(value => `<button type="button" data-last-seen="${value}" class="${settingsDraft.lastSeen === value ? "on" : ""}" aria-pressed="${settingsDraft.lastSeen === value}">${value[0].toUpperCase() + value.slice(1)}</button>`).join("")}</div></div>`;
  } else if (settingsView === "notifications") {
    content = `
      <button type="button" class="listbtn" id="notifs-toggle" data-testid="button-toggle-notifications" aria-pressed="${settingsDraft.notifications}">Notifications · ${settingsDraft.notifications ? "On" : "Off"}</button>`;
  } else if (settingsView === "blocked") {
    content = blocked.map(b => `<div class="listbtn"><span>@${esc(api.user(b.who)?.username || "unknown")}</span><button data-un="${esc(b.who)}">Unblock</button></div>`).join("") || `<div class="sub">No blocked users.</div>`;
  } else if (settingsView === "about") {
    content = `<b>Oldtime</b>`;
  }
  const hasEditableSettings = editableSettingsViews.has(settingsView);
  const saveBar = hasEditableSettings ? `<footer class="settings-save-bar" aria-live="polite">
    <span id="settings-save-status"></span>
    <button type="button" id="settings-save" data-testid="button-save-settings" disabled>Save changes</button>
  </footer>` : "";
  shell(`<section class="screen on account-settings-screen ${hasEditableSettings ? "settings-has-save" : ""}"><div class="scroll settings-scroll">
    <header class="settings-header">
      <button id="settings-back" class="settings-back" data-testid="button-settings-back" aria-label="${settingsView === "home" ? "Back" : "Back to Settings"}">${ic.back}</button>
       <div><h1>${titles[settingsView] || "Settings"}</h1></div>
      <span aria-hidden="true"></span>
    </header>
    <main class="settings-content">${content}</main>
  </div>${saveBar}</section>`, "light");
  void mountCognitoAction($("#cognito-account-link"), { intent: "link",
    connected: api.authProvider() === "cognito", onError: toast });
  $("#cognito-password") && ($("#cognito-password").onclick = async () => {
    const button = $("#cognito-password");
    button.disabled = true;
    try { await beginCognitoSignIn("login"); }
    catch (error) { if (button.isConnected) button.disabled = false; toast(error.message); }
  });
  if (extra) {
    extra.bind();
    app.querySelectorAll("[data-exp-nav]").forEach(button => {
      if (button.closest("#help-results")) return;
      button.onclick = () => {
      const route = button.dataset.expNav;
      if (route === "edit-profile") return openEditProfile();
      if (["account-type","personal-activity","creator-studio","business-dashboard","monthly-recap","best-practices","inspiration","blue-badge"].includes(route)) return navigateFromDrawer(route);
      if (route.startsWith("campaign:")) selectedCampaignId = route.slice(9);
      else if (route === "campaign-edit") selectedCampaignId = settingsView.startsWith("campaign:") ? settingsView.slice(9) : selectedCampaignId;
      settingsView = route;
      render();
      };
    });
  }
  if (settingsView === "close-friends") {
    const renderCloseFriends = (query = "") => {
      const current = api.me();
      const selected = settingsDraft.closeFriends;
      const normalizedQuery = query.trim().toLowerCase();
      const candidates = api.db().users
        .filter(person => api.areFriends(current.id, person.id) && !api.blocked(current.id, person.id))
        .filter(person => !normalizedQuery || `${person.name || ""} ${person.username || ""}`.toLowerCase().includes(normalizedQuery))
        .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || (a.name || a.username).localeCompare(b.name || b.username));
      $("#close-friends-count").textContent = `${selected.size} added`;
      $("#close-friends-list").innerHTML = candidates.map(person => {
        const added = selected.has(person.id);
        return `<button type="button" class="listbtn close-friend-row ${added ? "is-selected" : ""}" data-close-friend="${esc(person.id)}" aria-pressed="${added}">
          <img src="${esc(person.avatar || "")}" alt="" />
          <span class="close-friend-person"><b>${esc(person.name || person.username)}</b><small>@${esc(person.username)}</small></span>
          <span class="close-friend-state">${added ? "Added" : "Add"}</span>
        </button>`;
      }).join("") || `<div class="empty">${normalizedQuery ? "No Friends match that search." : "Become Friends with someone first to add them here."}</div>`;
      app.querySelectorAll("[data-close-friend]").forEach(button => {
        button.onclick = () => {
          const id = button.dataset.closeFriend;
          if (!api.areFriends(current.id, id) || api.blocked(current.id, id)) {
            selected.delete(id);
            renderCloseFriends($("#close-friends-search").value);
            updateSettingsSaveState();
            return toast("Only confirmed Friends can be added to Close Friends");
          }
          if (selected.has(id)) selected.delete(id);
          else selected.add(id);
          updateSettingsSaveState();
          renderCloseFriends($("#close-friends-search").value);
        };
      });
    };
    $("#close-friends-search").oninput = event => renderCloseFriends(event.currentTarget.value);
    renderCloseFriends();
  }
  const save = (change, message) => {
    try { mutate(change); } catch (e) { toast(e.message); return false; }
    render();
    if (message) toast(message);
    return true;
  };
  const saveSettingsButton = $("#settings-save");
  if (saveSettingsButton) saveSettingsButton.onclick = () => {
    if (!hasUnsavedSettings()) return;
    try {
      mutate(db => {
        const account = db.users.find(user => user.id === me.id);
        if (!account) throw new Error("Account unavailable");
        if (settingsView === "privacy") {
          account.private = settingsDraft.isPrivate;
          account.profileVisibility = {
            ...account.profileVisibility,
            city: settingsDraft.showCity,
            interests: settingsDraft.showInterests
          };
        } else if (settingsView === "close-friends") {
          account.closeFriends = [...settingsDraft.closeFriends].filter(id =>
            id !== account.id && api.areFriends(account.id, id) && !api.blocked(account.id, id)
          );
        } else if (settingsView === "chat") {
          db.settings = {
            ...db.settings,
            readReceipts: settingsDraft.readReceipts,
            lastSeen: settingsDraft.lastSeen
          };
        } else if (settingsView === "notifications") {
          account.notifs = settingsDraft.notifications;
        }
      });
    } catch (error) {
      toast(error.message || "Couldn't save settings");
      return;
    }
    hasPendingSettingsChanges = false;
    render();
    toast("Settings saved");
  };
  $("#settings-back").onclick = () => {
    if ((hasPendingSettingsChanges || hasUnsavedSettings()) && !confirm("Discard your unsaved settings changes?")) return;
    hasPendingSettingsChanges = false;
    if (settingsView.startsWith("campaign:")) { settingsView = "campaigns"; selectedCampaignId = null; render(); }
    else if (settingsView === "campaign-edit") { settingsView = selectedCampaignId ? `campaign:${selectedCampaignId}` : "campaigns"; render(); }
    else if (settingsView === "campaign-create") { settingsView = "campaigns"; render(); }
    else if (settingsView.startsWith("help-article-")) { settingsView = "help"; render(); }
    else if (settingsView.startsWith("privacy-topic-")) { settingsView = "privacy-center"; render(); }
    else if (settingsView !== "home") { settingsView = "home"; render(); }
    else if (!navigateBack()) { tab = "updates"; profileId = me.id; render(); }
  };
  app.querySelectorAll("[data-settings]").forEach(b => b.onclick = () => { settingsView = b.dataset.settings; render(); });
  $("#edit") && ($("#edit").onclick = openEditProfile);
  app.querySelector("[data-settings-profile]")?.addEventListener("click", () => navigateToProfile(me.id));
  $("#settings-search") && ($("#settings-search").oninput = event => {
    const query = event.currentTarget.value.trim().toLowerCase();
    let visibleEntries = 0;
    app.querySelectorAll(".settings-group").forEach(group => {
      const entries = [...group.querySelectorAll(".settings-entry")];
      let visibleInGroup = 0;
      entries.forEach(button => {
        const matches = !query || button.textContent.toLowerCase().includes(query);
        button.hidden = !matches;
        if (matches) visibleInGroup += 1;
      });
      group.hidden = visibleInGroup === 0;
      visibleEntries += visibleInGroup;
    });
    const empty = $("#settings-no-results");
    if (empty) empty.hidden = !query || visibleEntries > 0;
  });
  $("#password-form") && ($("#password-form").onsubmit = async event => {
    event.preventDefault();
    const currentPassword = $("#cp").value;
    const password = $("#np").value;
    if (password.length < 8 || password.length > 128) return toast("Password must be 8–128 characters");
    if (password !== $("#confirm-pass").value) return toast("Passwords do not match");
    try {
      if (api.authMode() === "cloud") {
        await api.changePassword(currentPassword, password);
      } else {
        if (currentPassword !== api.me().password) return toast("Current password is wrong");
        if (!save(db => { db.users.find(u => u.id === me.id).password = password; })) return;
      }
      settingsView = "home";
      render();
      toast("Password updated");
    } catch (error) {
      toast(error.message || "Couldn’t update your password");
    }
  });
  $("#private-toggle") && ($("#private-toggle").onclick = () => {
    settingsDraft.isPrivate = !settingsDraft.isPrivate;
    $("#private-toggle").setAttribute("aria-pressed", String(settingsDraft.isPrivate));
    $("#private-toggle").textContent = `Private account · ${settingsDraft.isPrivate ? "On" : "Off"}`;
    updateSettingsSaveState();
  });
  app.querySelectorAll("[data-profile-visibility]").forEach(button => button.onclick = () => {
    const key = button.dataset.profileVisibility === "city" ? "showCity" : "showInterests";
    settingsDraft[key] = !settingsDraft[key];
    const label = button.dataset.profileVisibility === "city" ? "Show city on profile" : "Show interests on profile";
    button.setAttribute("aria-pressed", String(settingsDraft[key]));
    button.textContent = `${label} · ${settingsDraft[key] ? "On" : "Off"}`;
    updateSettingsSaveState();
  });
  $("#receipts-toggle") && ($("#receipts-toggle").onclick = () => {
    settingsDraft.readReceipts = !settingsDraft.readReceipts;
    $("#receipts-toggle").setAttribute("aria-pressed", String(settingsDraft.readReceipts));
    $("#receipts-toggle").textContent = `Read receipts · ${settingsDraft.readReceipts ? "On" : "Off"}`;
    updateSettingsSaveState();
  });
  app.querySelectorAll("[data-last-seen]").forEach(button => button.onclick = () => {
    settingsDraft.lastSeen = button.dataset.lastSeen;
    app.querySelectorAll("[data-last-seen]").forEach(option => {
      const selected = option.dataset.lastSeen === settingsDraft.lastSeen;
      option.classList.toggle("on", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    updateSettingsSaveState();
  });
  $("#notifs-toggle") && ($("#notifs-toggle").onclick = () => {
    settingsDraft.notifications = !settingsDraft.notifications;
    $("#notifs-toggle").setAttribute("aria-pressed", String(settingsDraft.notifications));
    $("#notifs-toggle").textContent = `Notifications · ${settingsDraft.notifications ? "On" : "Off"}`;
    updateSettingsSaveState();
  });
  app.querySelectorAll("[data-un]").forEach(b => b.onclick = () => save(db => { db.blocks = db.blocks.filter(x => !(x.by === me.id && x.who === b.dataset.un)); }, "Unblocked"));
   $("#save-report") && ($("#save-report").onclick = () => {
    const reason = $("#problem").value.trim();
    if (!reason) return toast("Describe the problem first");
     save(db => db.reports.push({ id: "h" + Date.now(), by: me.id, target: "app", reason, at: Date.now() }), "Report saved");
  });
  $("#out") && ($("#out").onclick = () => { logoutAccount(); settingsView = "home"; tab = "updates"; chatId = null; profileId = null; viewer = null; render(); });
  $("#reset") && ($("#reset").onclick = () => {
    if (!confirm("Permanently delete all Oldtime data in this browser, including accounts, posts, stories, messages, and settings?")) return;
    api.reset();
    settingsView = "home";
    tab = "updates";
    profileId = null;
    viewer = null;
    render();
  });
}

const params = new URLSearchParams(location.search);
let pendingSharedComment = params.get("comment") || "";
if (params.get("post")) viewer = params.get("post");
if (params.get("user")) profileId = api.user(params.get("user"))?.id || null;
window.addEventListener("oldtime-data", () => {
  if ($("#sheet.on") || $("#storyview.on") || $(".emoji-overlay")) return;
  const input = document.activeElement;
  const position = input?.selectionStart;
  const end = input?.selectionEnd;
  render();
  if (input?.id && $( `#${input.id}`) && typeof position === "number") {
    const next = $(`#${input.id}`); next.focus(); next.setSelectionRange(position, end);
  }
});
window.addEventListener("error", e => { if (e.error?.message) toast(e.error.message); });
window.addEventListener("unhandledrejection", e => { if (e.reason?.message) toast(e.reason.message); });
void (async () => {
  let result = null, failure = "";
  try { result = await completeCognitoSignIn(); }
  catch (error) { failure = error.message || "Secure sign-in could not be completed."; }
  render();
  if (failure) {
    const field = $("#err");
    if (field) field.textContent = failure;
    else toast(failure);
  } else if (result === "link") toast("Secure sign-in connected");
  void finishStartup();
})();
