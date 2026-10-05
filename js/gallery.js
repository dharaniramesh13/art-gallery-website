/* gallery.js: the home page (hero, filters by category, grid, viewer, exhibitions, contact).
   Artworks come from KG.artworks.all(), so anything users add or replace on the
   My art page appears here automatically. */
(() => {
'use strict';
const { $, esc, parseDate, dateFmt, announce, priceText, altOf, artSrc, generatedSrc, SITE, EXHIBITIONS } = KG;

const M = KG.market;
let ARTWORKS = [];
const byId = id => ARTWORKS.find(a => a.id === id);

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.200-4.400-9.200-8.900C1.400 8.300 3.100 5 6.400 5c2 0 3.400 1 3.900 2.100h3.400C14.200 6 15.600 5 17.600 5c3.300 0 5 3.300 3.600 6.600-2 4.500-9.200 8.900-9.200 8.900z"/></svg>`;

/* ==========================================================================
   FAVORITES  (remembered per signed-in user, or per browser for guests)
   ========================================================================== */
const user = KG.auth.current();
const FAV_KEY = "kg_fav_" + (user ? user.id : "guest");
const favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; } })());
const saveFavorites = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch {} };

function toggleFavorite(id) {
  const a = byId(id); if (!a) return;
  if (favorites.has(id)) { favorites.delete(id); announce(`${a.title} removed from saved works`); }
  else { favorites.add(id); announce(`${a.title} saved`); }
  saveFavorites();
  $("#savedCount").textContent = favorites.size;

  document.querySelectorAll(`.fav[data-id="${id}"]`).forEach(b => b.setAttribute("aria-pressed", favorites.has(id)));
  if (viewerOpen && currentWork && currentWork.id === id) renderViewerHeart();
  if (state.savedOnly && !favorites.has(id)) renderGrid();
}

/* ==========================================================================
   FILTERS, SORTING AND THE GRID
   ========================================================================== */
const state = { category: "All", medium: "All", year: "All", sort: "newest", savedOnly: false };
let view = [];

function buildFilters() {
  const categories = ["All", ...new Set(ARTWORKS.map(a => a.category))];
  $("#categoryPills").innerHTML = categories.map(c =>
    `<button class="pill" type="button" data-cat="${esc(c)}" aria-pressed="${state.category === c}">${esc(c)}</button>`).join("");

  const mediums = [...new Set(ARTWORKS.map(a => a.medium))].sort();
  $("#mediumSelect").innerHTML = `<option value="All">All media</option>` + mediums.map(m => `<option>${esc(m)}</option>`).join("");

  const years = [...new Set(ARTWORKS.map(a => a.year))].sort((a, b) => b - a);
  $("#yearSelect").innerHTML = `<option value="All">All years</option>` + years.map(y => `<option>${y}</option>`).join("");
}

function sortList(list) {
  const cmp = {
    newest:    (a, b) => b.year - a.year || b.id - a.id,
    oldest:    (a, b) => a.year - b.year || a.id - b.id,
    priceLow:  (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    priceHigh: (a, b) => (b.price ?? -1) - (a.price ?? -1),
    title:     (a, b) => a.title.localeCompare(b.title)
  }[state.sort];
  return [...list].sort(cmp);
}

// Images load only when they come near the screen
const lazyObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        loadImage(e.target);
        lazyObserver.unobserve(e.target);
      });
    }, { rootMargin: "300px" })
  : null;

function loadImage(img) {
  const a = byId(Number(img.dataset.id)); if (!a) return;
  img.onload = () => img.classList.add("loaded");
  img.onerror = () => { img.onerror = null; img.src = generatedSrc(a); };   // broken upload: fall back to sample art
  img.src = artSrc(a);
}

function renderGrid() {
  view = sortList(ARTWORKS.filter(a =>
    (state.category === "All" || a.category === state.category) &&
    (state.medium === "All" || a.medium === state.medium) &&
    (state.year === "All" || String(a.year) === state.year) &&
    (!state.savedOnly || favorites.has(a.id))));

  const grid = $("#grid");
  const ratings = M.ratingMap();
  const stars = a => ratings[a.id] ? ` <span class="card-rating">★ ${ratings[a.id].avg.toFixed(1)} (${ratings[a.id].count})</span>` : "";
  grid.innerHTML = view.map(a => `
    <li class="card">
      <button class="card-btn" type="button" data-id="${a.id}" aria-label="View ${esc(a.title)} by ${esc(a.artist)}">
        <img data-id="${a.id}" alt="${esc(altOf(a))}" width="${a.ratio[0] * 100}" height="${a.ratio[1] * 100}" decoding="async">
        <span class="card-cap"><strong>${esc(a.title)}</strong><span>${esc(a.artist)}${stars(a)}</span></span>
        ${a.sold ? `<span class="tag-sold">Sold</span>` : (M.isLive(a) ? `<span class="tag-auction">Auction</span>` : "")}
      </button>
      <button class="fav" type="button" data-id="${a.id}" aria-pressed="${favorites.has(a.id)}" aria-label="Save ${esc(a.title)}">${HEART}</button>
    </li>`).join("");

  grid.querySelectorAll(".card-btn img").forEach(img => lazyObserver ? lazyObserver.observe(img) : loadImage(img));

  const empty = $("#empty");
  empty.hidden = view.length > 0;
  if (!view.length) {
    empty.innerHTML = ARTWORKS.length
      ? `No works match these filters. <button class="pill" id="resetFilters" type="button">Clear filters</button>`
      : `The gallery has no artworks yet. <a href="dashboard.html">Log in and add the first one.</a>`;
  }
  const n = view.length;
  $("#resultCount").textContent = `${n} ${n === 1 ? "work" : "works"}`;
}

function syncFilterUI() {
  document.querySelectorAll("#categoryPills .pill").forEach(b => b.setAttribute("aria-pressed", b.dataset.cat === state.category));
  $("#mediumSelect").value = state.medium;
  $("#yearSelect").value = state.year;
  $("#sortSelect").value = state.sort;
  $("#savedOnly").setAttribute("aria-pressed", state.savedOnly);
}

function bindGallery() {
  $("#categoryPills").addEventListener("click", e => {
    const b = e.target.closest(".pill"); if (!b) return;
    state.category = b.dataset.cat; syncFilterUI(); renderGrid();
  });
  $("#mediumSelect").addEventListener("change", e => { state.medium = e.target.value; renderGrid(); });
  $("#yearSelect").addEventListener("change", e => { state.year = e.target.value; renderGrid(); });
  $("#sortSelect").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });
  $("#savedOnly").addEventListener("click", () => { state.savedOnly = !state.savedOnly; syncFilterUI(); renderGrid(); });
  $("#empty").addEventListener("click", e => {
    if (!e.target.closest("#resetFilters")) return;
    Object.assign(state, { category: "All", medium: "All", year: "All", sort: "newest", savedOnly: false });
    syncFilterUI(); renderGrid();
  });

  $("#grid").addEventListener("click", e => {
    const fav = e.target.closest(".fav");
    if (fav) { toggleFavorite(Number(fav.dataset.id)); return; }
    const card = e.target.closest(".card-btn");
    if (card) openViewer(Number(card.dataset.id), card);
  });

  $("#savedBtn").addEventListener("click", () => {
    state.savedOnly = true; syncFilterUI(); renderGrid();
    KG.nav.closeMenu();
    $("#gallery").scrollIntoView();
  });
}

/* ==========================================================================
   HERO  (the featured artwork: chosen on the My art page, otherwise the first one)
   ========================================================================== */
function renderHero() {
  $("#tagline").textContent = SITE.tagline;
  const a = byId(KG.featured.get()) || byId(SITE.featuredId) || ARTWORKS[0];
  if (!a) {
    $("#heroWork").innerHTML = `<p class="muted">Artworks added by signed-in users appear here.</p>`;
    return;
  }
  $("#heroWork").innerHTML = `
    <button class="hero-btn" type="button" id="heroBtn" aria-label="View ${esc(a.title)} in detail">
      <img src="${artSrc(a)}" alt="${esc(altOf(a))}" width="${a.ratio[0] * 100}" height="${a.ratio[1] * 100}">
    </button>
    <figcaption><em>${esc(a.title)}</em>${esc(a.artist)}, ${a.year}, ${esc(a.medium)}</figcaption>`;
  $("#heroBtn").addEventListener("click", e => openViewer(a.id, e.currentTarget));
}

/* ==========================================================================
   ARTWORK VIEWER (dialog): zoom, previous/next, keyboard support
   ========================================================================== */
const viewer = $("#viewer");
const zoomWrap = $("#zoomWrap");
let viewerOpen = false, viewerList = [], viewerIndex = 0, currentWork = null, lastFocus = null, zoomed = false;

function openViewer(id, opener) {
  viewerList = view.some(a => a.id === id) ? view : sortList(ARTWORKS);
  viewerIndex = viewerList.findIndex(a => a.id === id);
  lastFocus = opener || document.activeElement;
  showWork();
  viewer.showModal();
  viewerOpen = true;
  document.body.classList.add("lock");
  $("#vClose").focus();
}

function showWork() {
  currentWork = viewerList[viewerIndex];
  const a = currentWork;
  setZoom(false);

  const img = $("#vImg");
  img.onerror = () => { img.onerror = null; img.src = generatedSrc(a); };
  img.src = artSrc(a);
  img.alt = altOf(a);
  img.width = a.ratio[0] * 100; img.height = a.ratio[1] * 100;

  $("#vTitle").textContent = a.title;
  $("#vArtist").textContent = a.artist;
  $("#vFacts").innerHTML = `
    <dt>Year</dt><dd>${a.year}</dd>
    <dt>Category</dt><dd>${esc(a.category)}</dd>
    <dt>Medium</dt><dd>${esc(a.medium)}</dd>
    <dt>Dimensions</dt><dd>${esc(a.dimensions)}</dd>`;
  $("#vDesc").textContent = a.description;
  KG.marketUI.mount(a, refreshWork);      // price, buy / bid panel and reviews
  $("#vInquire").textContent = a.sold ? "Ask about similar work" : (a.price == null ? "Inquire about this work" : "Inquire to purchase");
  $("#vCount").textContent = `${viewerIndex + 1} of ${viewerList.length}`;

  // Signed-in users can jump straight to replacing this image
  const edit = $("#vEdit");
  edit.hidden = !(user && a.ownerId === user.id);   // only the artist can edit
  edit.href = `dashboard.html?edit=${a.id}`;
  edit.textContent = "Edit this artwork";

  renderViewerHeart();
  const many = viewerList.length > 1;
  $("#vPrev").hidden = $("#vNext").hidden = !many;
}

function renderViewerHeart() {
  const on = favorites.has(currentWork.id);
  $("#vHeart").setAttribute("aria-pressed", on);
  $("#vHeartText").textContent = on ? "Saved" : "Save";
}

// After a bid, purchase or review: settle finished auctions, reload the works and redraw the open viewer
async function refreshWork() {
  await M.settleEnded();
  ARTWORKS = await KG.artworks.all();
  const id = currentWork.id;
  viewerList = viewerList.map(x => byId(x.id)).filter(Boolean);
  viewerIndex = Math.max(0, viewerList.findIndex(x => x.id === id));
  renderGrid();
  showWork();
}

function step(dir) {
  viewerIndex = (viewerIndex + dir + viewerList.length) % viewerList.length;
  showWork();
}

function setZoom(on) {
  zoomed = on;
  zoomWrap.classList.toggle("zoomed", on);
  $("#zoomBtn").textContent = on ? "Zoom out" : "Zoom in";
  if (on) { zoomWrap.tabIndex = 0; zoomWrap.setAttribute("role", "region"); zoomWrap.setAttribute("aria-label", "Zoomed artwork, scroll to pan"); }
  else { zoomWrap.removeAttribute("tabindex"); zoomWrap.removeAttribute("role"); zoomWrap.removeAttribute("aria-label"); zoomWrap.scrollTo(0, 0); }
}

function bindViewer() {
  $("#vClose").addEventListener("click", () => viewer.close());
  $("#vPrev").addEventListener("click", () => step(-1));
  $("#vNext").addEventListener("click", () => step(1));
  $("#zoomBtn").addEventListener("click", () => setZoom(!zoomed));
  $("#vImg").addEventListener("click", () => setZoom(!zoomed));
  $("#vHeart").addEventListener("click", () => toggleFavorite(currentWork.id));
  $("#vInquire").addEventListener("click", () => { const id = currentWork.id; viewer.close(); goToInquiry(id); });

  zoomWrap.addEventListener("mousemove", e => {
    if (!zoomed) return;
    const r = zoomWrap.getBoundingClientRect();
    zoomWrap.scrollLeft = (zoomWrap.scrollWidth - zoomWrap.clientWidth) * ((e.clientX - r.left) / r.width);
    zoomWrap.scrollTop  = (zoomWrap.scrollHeight - zoomWrap.clientHeight) * ((e.clientY - r.top) / r.height);
  });

  viewer.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); step(-1); }
  });

  viewer.addEventListener("close", () => {
    viewerOpen = false;
    KG.marketUI.stop();
    document.body.classList.remove("lock");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
}

/* ==========================================================================
   ABOUT, EXHIBITIONS
   ========================================================================== */
function renderAbout() { $("#portraitImg").src = KG.portraitSrc(); }

function renderExhibitions() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const range = e => `${dateFmt.format(parseDate(e.start))} to ${dateFmt.format(parseDate(e.end))}`;

  const upcoming = EXHIBITIONS.filter(e => parseDate(e.end) >= today).sort((a, b) => parseDate(a.start) - parseDate(b.start));
  const past = EXHIBITIONS.filter(e => parseDate(e.end) < today).sort((a, b) => parseDate(b.start) - parseDate(a.start));

  const item = (e, isPast) => {
    const open = !isPast && parseDate(e.start) <= today;
    const status = isPast ? "Closed" : (open ? "On now" : "Opening soon");
    return `<li class="ex-item">
      <div class="ex-dates">${range(e)}</div>
      <div><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p><p>${esc(e.venue)}</p></div>
      <span class="ex-status ${open ? "now" : ""}">${status}</span>
    </li>`;
  };

  $("#exhibitionList").innerHTML = `
    <div class="ex-group"><h3>Upcoming and current</h3>
      ${upcoming.length ? `<ul class="ex-list">${upcoming.map(e => item(e, false)).join("")}</ul>` : `<p class="muted">No exhibitions are scheduled right now.</p>`}
    </div>
    <div class="ex-group"><h3>Past exhibitions</h3>
      ${past.length ? `<ul class="ex-list">${past.map(e => item(e, true)).join("")}</ul>` : `<p class="muted">No past exhibitions yet.</p>`}
    </div>`;
}

/* ==========================================================================
   CONTACT / INQUIRY FORM and NEWSLETTER
   ========================================================================== */
function buildContact() {
  $("#cWork").innerHTML = `<option value="">General inquiry</option>` +
    ARTWORKS.map(a => `<option value="${a.id}">${esc(a.title)}, ${esc(a.artist)}</option>`).join("");
  $("#emailLink").textContent = SITE.email;
  $("#emailLink").href = "mailto:" + SITE.email;
}

function goToInquiry(id) {
  $("#cWork").value = String(id);
  const a = byId(id);
  if (a && !$("#cMessage").value.trim()) $("#cMessage").value = `I am interested in "${a.title}" by ${a.artist}. Please send me more details.`;
  $("#formNote").hidden = true;
  $("#contact").scrollIntoView();
  setTimeout(() => $("#cName").focus({ preventScroll: true }), 400);
}

function setError(input, errEl, message) {
  errEl.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  return !message;
}

function bindContact() {
  const form = $("#contactForm");
  // Signed-in visitors do not need to type their details again
  if (user) { $("#cName").value = user.name; $("#cEmail").value = user.email; }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#cName"), email = $("#cEmail"), msg = $("#cMessage");
    const okName  = setError(name,  $("#cNameErr"),  name.value.trim() ? "" : "Please enter your name.");
    const okEmail = setError(email, $("#cEmailErr"), /^\S+@\S+\.\S+$/.test(email.value.trim()) ? "" : "Please enter a valid email address.");
    const okMsg   = setError(msg,   $("#cMessageErr"), msg.value.trim().length >= 10 ? "" : "Please write a short message (at least 10 characters).");
    if (!(okName && okEmail && okMsg)) { [name, email, msg].find(i => i.getAttribute("aria-invalid") === "true").focus(); return; }

    /* This demo does not send data to a server. To make it live, replace this block
       with a fetch() call to a form service (such as Formspree) or your own backend. */
    const work = byId(Number($("#cWork").value));
    const subject = work ? `Inquiry: ${work.title}` : "Gallery inquiry";
    const body = `${msg.value.trim()}\n\nFrom: ${name.value.trim()} (${email.value.trim()})`;
    const note = $("#formNote");
    note.innerHTML = `<p><strong>Thank you, ${esc(name.value.trim().split(" ")[0])}.</strong> Your inquiry has been noted.</p>
      <p class="muted">To send it straight away, open it in your email app.</p>
      <a class="btn small" href="mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Open in email app</a>`;
    note.hidden = false;
    form.reset();
    if (user) { $("#cName").value = user.name; $("#cEmail").value = user.email; }
    form.querySelectorAll("[aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));
    note.scrollIntoView({ block: "nearest" });
  });

  form.addEventListener("input", e => {
    if (e.target.getAttribute("aria-invalid") === "true") {
      e.target.removeAttribute("aria-invalid");
      const err = document.getElementById(e.target.getAttribute("aria-describedby")); if (err) err.textContent = "";
    }
  });
}

function bindNewsletter() {
  $("#newsForm").addEventListener("submit", e => {
    e.preventDefault();
    const input = $("#newsEmail"), msg = $("#newsMsg");
    if (!/^\S+@\S+\.\S+$/.test(input.value.trim())) {
      msg.style.color = ""; msg.textContent = "Please enter a valid email address."; input.setAttribute("aria-invalid", "true"); input.focus(); return;
    }
    input.removeAttribute("aria-invalid");
    msg.style.color = "var(--ink)";
    msg.textContent = "Thank you. You are on the list.";
    input.value = "";
  });
}

/* ==========================================================================
   START
   ========================================================================== */
async function init() {
  KG.nav.init();
  document.title = `${SITE.fullName} | Contemporary Art from India`;
  $("#heroTitle").textContent = SITE.name;

  bindGallery(); bindViewer(); bindContact(); bindNewsletter();

  ARTWORKS = await KG.artworks.all();
  if (await M.settleEnded()) ARTWORKS = await KG.artworks.all();     // finished auctions become sales
  [...favorites].forEach(id => { if (!byId(id)) favorites.delete(id); });
  $("#savedCount").textContent = favorites.size;

  // index.html?category=Painting opens the collection already filtered
  const wanted = new URLSearchParams(location.search).get("category");
  if (wanted && ARTWORKS.some(a => a.category === wanted)) state.category = wanted;

  buildFilters();
  renderHero();
  renderGrid();
  renderAbout();
  renderExhibitions();
  buildContact();
}
init();
})();
