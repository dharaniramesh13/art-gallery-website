/* dashboard.js: "My art" page. Signed-in users add, edit, replace and delete artworks.
   Everything saved here shows up on the home page straight away. */
(() => {
'use strict';
const { $, esc, priceText, altOf, artSrc, generatedSrc, toast, announce } = KG;

const M = KG.market;
KG.nav.init();
const user = KG.auth.requireLogin();     // sends visitors to login.html if nobody is signed in
if (!user) return;

const DEFAULT_CATEGORIES = ["Painting", "Photography", "Digital", "Drawing", "Sculpture", "Mixed media"];
// Used only if a new work later goes back to "sample art"
const PALETTES = [
  ["#d9e4a8","#b6d07a","#8bb45a","#5f9a4a","#3f7a45","#27553a"],
  ["#f6e3c4","#f0c48a","#e39c64","#c46f55","#8e4a5a","#4a2f55"],
  ["#dfe9f5","#b4cbe8","#86a8d6","#5a80b8","#3a5a94","#23386b"]
];

let works = [];            // only this artist's works
let allWorks = [];         // everyone's works (needed for unique ids)
let editingId = null;     // null = adding a new work
let pending;              // undefined = image unchanged, object = new image chosen, "remove" = back to sample art
let replaceId = null;

const dialog = $("#editDialog"), form = $("#editForm");

/* ---------- helpers ---------- */
const storageMessage = err => {
  const code = err && err.code;
  if (code === "NETWORK")      return "Cannot reach the gallery server. Check your connection and that the server is running, then try again.";
  if (code === "TOO_BIG" || code === "BAD_IMAGE") return "That image could not be uploaded. Please choose a smaller JPG, PNG or WebP.";
  if (code === "UNAUTHORIZED") return "Your login has expired. Please log in again.";
  if (code === "NOT_OWNER")    return "You can only change your own artworks.";
  if (code === "HAS_BIDS")     return "This auction has bids, so it cannot be deleted until it ends.";
  if (code === "BAD_INPUT")    return "Please check the form: one of the fields is not valid.";
  return "The change could not be saved. Please try again.";
};

function guardStorage() {
  if (KG.storageOK) return true;
  toast("Cannot reach the gallery server, so changes cannot be saved.", "error");
  return false;
}

/* ---------- list of artworks ---------- */
async function load() {
  await M.settleEnded();
  allWorks = await KG.artworks.all();
  works = allWorks.filter(a => a.ownerId === user.id);
  $("#storageWarn").hidden = KG.storageOK;
  render();
  renderOrders();
}

function render() {
  const n = works.length;
  $("#workCount").textContent = n ? `${n} ${n === 1 ? "artwork" : "artworks"} in the gallery` : "No artworks yet";
  const featuredId = KG.featured.get();

  $("#manageGrid").innerHTML = n ? works.map(a => `
    <li class="m-card" data-id="${a.id}">
      <div class="m-img">
        <img src="${artSrc(a)}" alt="${esc(altOf(a))}" loading="lazy">
        <div class="badges">
          ${a.image ? "" : `<span class="badge sample">Sample art</span>`}
          ${featuredId === a.id ? `<span class="badge">On home page</span>` : ""}
          ${a.sold ? `<span class="badge">Sold</span>` : ""}
        </div>
      </div>
      <div class="m-body">
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.artist)}, ${a.year}</p>
        <p>${esc(a.category)}, ${esc(M.priceLabel(a))}</p>${auctionNote(a)}
        <div class="m-actions">
          <button class="btn small primary" type="button" data-act="replace">Replace image</button>
          <button class="btn small" type="button" data-act="edit">Edit details</button>
          <button class="btn small danger" type="button" data-act="delete" aria-label="Delete ${esc(a.title)}">Delete</button>
        </div>
      </div>
    </li>`).join("")
    : `<li class="notice">You have no artworks yet. Choose <strong>Add artwork</strong> to upload the first one.</li>`;
}

function auctionNote(a) {
  if (a.saleType !== "auction") return "";
  const bids = M.bids(a.id), top = bids[0];
  const ends = new Date(a.endsAt).toLocaleString(KG.SITE.locale, { dateStyle: "medium", timeStyle: "short" });
  return `<p class="m-extra">Auction ${Date.now() >= a.endsAt ? "ended" : "ends"} ${esc(ends)}. ${bids.length} ${bids.length === 1 ? "bid" : "bids"}${top ? `, highest ${esc(KG.money.format(top.amount))}` : ""}.</p>`;
}

/* ---------- sales and purchases ---------- */
function renderOrders() {
  const sales = M.ordersAsSeller(user.id), buys = M.ordersAsBuyer(user.id);
  const date = ts => KG.dateFmt.format(new Date(ts));

  $("#salesList").innerHTML = sales.length ? `<ul class="o-list">${sales.map(o => `<li class="o-item">
      <div><strong>${esc(o.title)}</strong>
        <p>${o.type === "auction" ? "Won at auction" : "Bought"} by ${esc(o.buyerName)} (${esc(o.buyerEmail)}) on ${date(o.at)}</p>
        ${o.ship ? `<p>Ship to: ${esc(o.ship.name)}, ${esc(o.ship.phone)}, ${esc(o.ship.address)}</p>` : `<p>Contact the buyer to arrange payment and delivery.</p>`}</div>
      <div class="o-amount">${esc(KG.money.format(o.amount))}</div></li>`).join("")}</ul>`
    : `<p class="muted">No sales yet. When someone buys or wins one of your works, it appears here with their contact details.</p>`;

  const bids = M.myBids(user.id).filter(b => !buys.some(o => o.workId === b.workId));
  const rows = [
    ...buys.map(o => `<li class="o-item"><div><strong>${esc(o.title)}</strong><p>${esc(o.artist)}. ${esc(o.status)}, ${date(o.at)}</p></div><div class="o-amount">${esc(KG.money.format(o.amount))}</div></li>`),
    ...bids.map(b => {
      const w = allWorks.find(x => x.id === b.workId); if (!w) return "";
      const top = M.topBid(w), state = !top ? "" : (top.userId === user.id ? "You are the highest bidder" : "You have been outbid");
      return `<li class="o-item"><div><strong>${esc(w.title)}</strong><p>Your bid. ${esc(state)}. Current: ${esc(KG.money.format(M.currentBid(w)))}</p></div><div class="o-amount">${esc(KG.money.format(b.amount))}</div></li>`;
    })
  ];
  $("#buysList").innerHTML = rows.length ? `<ul class="o-list">${rows.join("")}</ul>` : `<p class="muted">You have not bought or bid on anything yet.</p>`;
}

/* ---------- sale type fields in the dialog ---------- */
const pad = n => String(n).padStart(2, "0");
const toLocalInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function syncSaleType() {
  const auction = $("#fSaleType").value === "auction";
  $("#startBidBox").hidden = $("#endsBox").hidden = !auction;
  $("#priceBox").hidden = auction;
}

/* ---------- replace just the image ---------- */
async function replaceImage(file) {
  const work = works.find(w => w.id === replaceId);
  if (!work || !file) return;
  try {
    const img = await KG.processImage(file);
    await KG.artworks.save({ ...work, image: img.dataUrl, ratio: img.ratio });
    await load();
    toast(`Image replaced for "${work.title}".`);
    announce("Image replaced");
  } catch (err) {
    toast(err.code ? storageMessage(err) : err.message, "error");
  }
}

/* ---------- add / edit dialog ---------- */
function updatePreview() {
  const img = $("#previewImg"), dz = $("#dropzone");
  const work = editingId != null ? works.find(w => w.id === editingId) : null;
  let src = "";
  if (pending && pending !== "remove") src = pending.dataUrl;
  else if (work) src = pending === "remove" ? generatedSrc(work) : artSrc(work);

  img.hidden = !src;
  if (src) img.src = src;
  dz.classList.toggle("has-image", !!src);
  $("#dzText").innerHTML = src ? "<strong>Replace image</strong>: click or drop a file" : "<strong>Choose an image</strong> or drop it here<br>JPG, PNG or WebP";

  // "Use sample art" only makes sense for a saved work that currently has its own image
  const hasOwnImage = (pending && pending !== "remove") || (work && work.image && pending !== "remove");
  $("#removeImageBtn").hidden = !(work && hasOwnImage);
}

function openEditor(id) {
  const work = id != null ? works.find(w => w.id === id) : null;
  if (id != null && !work) return;
  editingId = id; pending = undefined;

  $("#dialogTitle").textContent = work ? "Edit artwork" : "Add artwork";
  $("#saveBtn").textContent = work ? "Save changes" : "Add artwork";
  $("#fTitle").value    = work ? work.title : "";
  $("#fArtist").value   = work ? work.artist : (user.name || "");
  $("#fYear").value     = work ? work.year : new Date().getFullYear();
  $("#fCategory").value = work ? work.category : "Painting";
  $("#fMedium").value   = work ? work.medium : "";
  $("#fDims").value     = work && work.dimensions !== "Not stated" ? work.dimensions : "";
  $("#fPrice").value    = work && work.price != null ? work.price : "";
  $("#fSaleType").value = work && work.saleType === "auction" ? "auction" : "fixed";
  $("#fStartBid").value = work && work.startBid ? work.startBid : "";
  $("#fEnds").value     = toLocalInput(work && work.endsAt ? work.endsAt : Date.now() + 7 * 864e5);
  const locked = !!work && M.bids(work.id).length > 0;          // no changing the rules once bidding has started
  ["#fSaleType", "#fStartBid", "#fEnds", "#fPrice"].forEach(s => { $(s).disabled = locked; });
  $("#lockHint").hidden = !locked;
  syncSaleType();
  $("#fDesc").value     = work ? work.description : "";
  $("#fAlt").value      = work ? work.alt : "";
  $("#fSold").checked   = work ? !!work.sold : false;
  $("#fFeatured").checked = work ? KG.featured.get() === work.id : false;
  $("#fileInput").value = "";
  $("#formError").textContent = "";
  form.querySelectorAll("[aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));

  const cats = [...new Set([...DEFAULT_CATEGORIES, ...works.map(w => w.category)])];
  $("#catList").innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join("");

  updatePreview();
  dialog.showModal();
  $("#fTitle").focus();
}

async function chooseFile(file) {
  if (!file) return;
  $("#formError").textContent = "";
  $("#dzText").textContent = "Preparing image…";
  try {
    pending = await KG.processImage(file);
  } catch (err) {
    $("#formError").textContent = err.message;
    $("#fileInput").value = "";
  }
  updatePreview();
}

function fail(el, message) {
  $("#formError").textContent = message;
  el.setAttribute("aria-invalid", "true");
  el.focus();
}

async function saveWork(e) {
  e.preventDefault();
  form.querySelectorAll("[aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));
  $("#formError").textContent = "";

  const title = $("#fTitle"), artist = $("#fArtist"), yearEl = $("#fYear"), cat = $("#fCategory"), priceEl = $("#fPrice");
  const existing = editingId != null ? works.find(w => w.id === editingId) : null;

  if (!title.value.trim())  return fail(title, "Enter a title for the artwork.");
  if (!artist.value.trim()) return fail(artist, "Enter the artist's name.");
  const year = Number(yearEl.value);
  if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) return fail(yearEl, "Enter a four-digit year.");
  if (!cat.value.trim())    return fail(cat, "Choose or type a category.");
  const price = priceEl.value.trim() === "" ? null : Number(priceEl.value);
  if (price !== null && (!Number.isFinite(price) || price < 0)) return fail(priceEl, "Enter a price of 0 or more, or leave it empty.");
  const locked = !!existing && M.bids(existing.id).length > 0;
  const saleType = $("#fSaleType").value;
  let startBid = null, endsAt = null;
  if (!locked && saleType === "auction") {
    startBid = Math.floor(Number($("#fStartBid").value));
    if (!(startBid >= 1)) return fail($("#fStartBid"), "Enter a starting bid of at least 1.");
    endsAt = new Date($("#fEnds").value).getTime();
    if (!Number.isFinite(endsAt) || endsAt <= Date.now() + 60000) return fail($("#fEnds"), "Choose an end time at least a few minutes from now.");
  }
  if (!existing && !(pending && pending !== "remove")) return fail($("#fileInput"), "Choose an image for this artwork.");
  if (!guardStorage()) return;

  const work = existing ? { ...existing } : {
    style: "dunes", seed: Math.floor(Math.random() * 90) + 1,
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    ratio: [80, 100], image: ""
  };
  Object.assign(work, {
    title: title.value.trim(), artist: artist.value.trim(), year,
    category: cat.value.trim(),
    medium: $("#fMedium").value.trim() || "Mixed media",
    dimensions: $("#fDims").value.trim() || "Not stated",
    sold: $("#fSold").checked,
    description: $("#fDesc").value.trim(),
    alt: $("#fAlt").value.trim() || `${title.value.trim()} by ${artist.value.trim()}`
  });
  if (!locked) {
    work.saleType = saleType;
    work.startBid = startBid;
    work.endsAt = endsAt;
    work.price = saleType === "auction" ? null : price;
  }
  if (pending && pending !== "remove") { work.image = pending.dataUrl; work.ratio = pending.ratio; }
  else if (pending === "remove") work.image = "";

  $("#saveBtn").disabled = true;
  try {
    const saved = await KG.artworks.save(work);            // the server returns the saved work (with its id)
    if ($("#fFeatured").checked) await KG.featured.set(saved.id);
    else if (KG.featured.get() === saved.id) await KG.featured.set(null);
    dialog.close();
    await load();
    toast(existing ? `Saved changes to "${work.title}".` : `Added "${work.title}" to the gallery.`);
  } catch (err) {
    $("#formError").textContent = storageMessage(err);
  } finally {
    $("#saveBtn").disabled = false;
  }
}

/* ---------- events ---------- */
$("#addBtn").addEventListener("click", () => { if (guardStorage()) openEditor(null); });

$("#manageGrid").addEventListener("click", async e => {
  const btn = e.target.closest("button[data-act]"); if (!btn) return;
  const id = Number(btn.closest(".m-card").dataset.id);
  const work = works.find(w => w.id === id);
  if (!guardStorage()) return;

  if (btn.dataset.act === "edit") openEditor(id);
  if (btn.dataset.act === "replace") { replaceId = id; $("#replaceInput").click(); }
  if (btn.dataset.act === "delete") {
    if (M.isLive(work) && M.bids(id).length) return toast("This auction has bids, so it cannot be deleted until it ends.", "error");
    if (!confirm(`Delete "${work.title}" from the gallery? This cannot be undone.`)) return;
    try {
      await KG.artworks.remove(id);                         // the server also removes its bids, reviews and picture
      await load();
      toast(`Deleted "${work.title}".`);
    } catch (err) { toast(storageMessage(err), "error"); }
  }
});

$("#replaceInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  await replaceImage(file);
});

$("#fSaleType").addEventListener("change", syncSaleType);

form.addEventListener("submit", saveWork);
$("#cancelBtn").addEventListener("click", () => dialog.close());
$("#fileInput").addEventListener("change", e => chooseFile(e.target.files[0]));
$("#removeImageBtn").addEventListener("click", () => { pending = "remove"; updatePreview(); });
dialog.addEventListener("close", () => { editingId = null; pending = undefined; });

// Drag and drop onto the picture area
const dz = $("#dropzone");
["dragenter", "dragover"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", e => chooseFile(e.dataTransfer.files[0]));

/* ---------- start ---------- */
(async () => {
  await load();
  // Coming from "Replace this image" in the gallery viewer: dashboard.html?edit=3
  const editId = new URLSearchParams(location.search).get("edit");
  if (editId && KG.storageOK) openEditor(Number(editId));
})();
})();
