/* market-ui.js: the buy / bid / review panels inside the artwork viewer on the home page.
   gallery.js calls KG.marketUI.mount(artwork, onChange) every time a work is shown. */
window.KG = window.KG || {};
(() => {
'use strict';
const { $, esc } = KG, M = KG.market;
let work = null, onChange = async () => {}, timer = null, flash = "";

const MSG = {
  OWN_WORK: "You can't do this on your own artwork.", SOLD: "This work has just been sold.",
  ENDED: "This auction has ended.", LEADING: "You already hold the highest bid.",
  STORAGE: "Could not save. Please try again.", NETWORK: "Cannot reach the gallery server. Please try again.",
  UNAUTHORIZED: "Your login has expired. Please log in again.", NOT_FOUND: "This artwork no longer exists.",
  BAD_INPUT: "Please check the details you entered.",
  NOT_AUCTION: "This work is not an auction.", NOT_FOR_SALE: "This work is not for sale at a fixed price.",
  BAD_RATING: "Choose a rating from 1 to 5.", TOO_LONG: "Keep the review under 600 characters."
};
const say = e => e.code === "TOO_LOW" ? `Your bid must be at least ${KG.money.format(e.min)}.` : (MSG[e.code] || "Something went wrong. Please try again.");
const money = KG.money.format.bind(KG.money);
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const when = ts => KG.dateFmt.format(new Date(ts));
const first = name => String(name || "").split(" ")[0];
const loginLink = `<a href="login.html?next=index.html">Log in</a>`;
const LABEL = { 5: "Excellent", 4: "Very good", 3: "Good", 2: "Fair", 1: "Poor" };

function left(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

/* ---------- markup ---------- */
function auctionHTML(user, own) {
  const a = work, bids = M.bids(a.id), ended = Date.now() >= a.endsAt, min = M.minBid(a);
  let h = `<div class="m-box">
    <div class="m-row">
      <div><span class="m-label">${bids.length ? "Current bid" : "Starting bid"}</span><strong class="m-big">${money(M.currentBid(a))}</strong></div>
      <div><span class="m-label">${ended ? "Status" : "Time left"}</span><strong id="bidTimer">${ended ? "Ended" : left(a.endsAt - Date.now())}</strong></div>
    </div>
    <p class="muted">${bids.length} ${bids.length === 1 ? "bid" : "bids"}. Ends ${new Date(a.endsAt).toLocaleString(KG.SITE.locale, { dateStyle: "medium", timeStyle: "short" })}.</p>`;
  if (ended) h += `<p>${bids.length ? "This auction has ended. Finalising the result…" : "This auction ended without any bids."}</p>`;
  else if (own) h += `<p class="muted">This is your artwork, so you cannot bid on it.</p>`;
  else if (!user) h += `<p>${loginLink} to place a bid.</p>`;
  else h += `<form data-form="bid" class="m-form" novalidate>
      <label for="bidAmt">Your bid in INR (minimum ${money(min)})</label>
      <div class="bid-row"><input id="bidAmt" type="number" min="${min}" step="1" value="${min}" inputmode="numeric">
      <button class="btn primary" type="submit">Place bid</button></div>
      <p class="m-msg" role="alert"></p></form>`;
  if (bids.length) h += `<ol class="bid-list" aria-label="Latest bids">${bids.slice(0, 5).map(b =>
    `<li><span>${esc(first(b.name))}</span><strong>${money(b.amount)}</strong><span class="muted">${when(b.at)}</span></li>`).join("")}</ol>`;
  return h + `</div>`;
}

function fixedHTML(user, own) {
  let h = `<div class="m-box">`;
  if (own) h += `<p class="muted">This is your artwork.</p>`;
  else if (!user) h += `<p>${loginLink} to buy this work.</p>`;
  else h += `<button class="btn primary" type="button" data-act="buy-open">Buy now, ${money(work.price)}</button>
    <form data-form="buy" class="m-form" hidden novalidate>
      <label for="bName">Full name</label><input id="bName" value="${esc(user.name)}" autocomplete="name">
      <label for="bPhone">Phone</label><input id="bPhone" type="tel" autocomplete="tel">
      <label for="bAddr">Delivery address</label><textarea id="bAddr" rows="3" autocomplete="street-address"></textarea>
      <p class="muted">Demo checkout: no money is taken. To charge real payments, add your gateway (for example Razorpay) in <code>KG.market.buy</code>.</p>
      <button class="btn primary" type="submit">Confirm purchase</button>
      <p class="m-msg" role="alert"></p></form>`;
  return h + `</div>`;
}

function marketHTML(user) {
  const a = work, own = !!user && a.ownerId === user.id, type = M.saleType(a);
  let h = flash ? `<p class="m-ok" role="status">${esc(flash)}</p>` : "";
  flash = "";
  if (a.sold) {
    const mine = !!user && a.soldTo === user.id;
    return h + `<div class="m-box"><p><strong>${mine ? "This work is yours." : "This work has been sold."}</strong></p>` +
      (mine ? `<p class="muted">The artist will contact you at ${esc(user.email)} about payment and delivery. Your orders are listed on the My art page.</p>` : "") + `</div>`;
  }
  return h + (type === "auction" ? auctionHTML(user, own) : type === "fixed" ? fixedHTML(user, own) : "");
}

function reviewsHTML(user) {
  const list = M.reviews(work.id), r = M.rating(work.id);
  const mine = user && list.find(x => x.userId === user.id), own = user && work.ownerId === user.id;
  let h = `<h3>Reviews</h3><p class="rev-sum">${r.count
    ? `<span class="stars" aria-hidden="true">${stars(r.avg)}</span> ${r.avg.toFixed(1)} out of 5 (${r.count})`
    : "No reviews yet."}</p>`;
  if (list.length) h += `<ul class="rev-list">${list.map(x => `<li class="review">
      <div><span class="stars" role="img" aria-label="${x.rating} out of 5">${stars(x.rating)}</span>
      <strong>${esc(first(x.name))}</strong>${M.hasBought(x.userId, work.id) ? ` <span class="verified">Buyer</span>` : ""}
      <span class="muted">${when(x.at)}</span></div>
      ${x.text ? `<p>${esc(x.text)}</p>` : ""}
      ${mine && x.id === mine.id ? `<button class="linklike" type="button" data-act="del-review" data-id="${x.id}">Delete my review</button>` : ""}
    </li>`).join("")}</ul>`;
  if (own) h += `<p class="muted">Artists cannot review their own work.</p>`;
  else if (!user) h += `<p>${loginLink} to write a review.</p>`;
  else h += `<form data-form="review" class="m-form" novalidate>
      <label for="rRating">Your rating</label>
      <select id="rRating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}"${mine && mine.rating === n ? " selected" : ""}>${n}, ${LABEL[n]}</option>`).join("")}</select>
      <label for="rText">Your review (optional)</label>
      <textarea id="rText" rows="3" maxlength="600">${esc(mine ? mine.text : "")}</textarea>
      <button class="btn" type="submit">${mine ? "Update review" : "Post review"}</button>
      <p class="m-msg" role="alert"></p></form>`;
  return h;
}

function render() {
  const user = KG.auth.current();
  $("#vPrice").textContent = M.priceLabel(work);
  $("#vMarket").innerHTML = marketHTML(user);
  $("#vReviews").innerHTML = reviewsHTML(user);
}

/* ---------- countdown ---------- */
function stop() { if (timer) { clearInterval(timer); timer = null; } }
function startTimer() {
  stop();
  if (!work || !M.isLive(work)) return;
  timer = setInterval(() => {
    const ms = work.endsAt - Date.now();
    if (ms <= 0) { stop(); onChange(); return; }          // auction just ended: reload, which settles it
    const el = $("#bidTimer"); if (el) el.textContent = left(ms);
  }, 1000);
}

/* ---------- actions (one listener per panel, so re-rendering never loses them) ---------- */
async function onSubmit(e) {
  const form = e.target.closest("form[data-form]"); if (!form) return;
  e.preventDefault();
  const user = KG.auth.current(), msg = form.querySelector(".m-msg"), btn = form.querySelector("button[type=submit]");
  const show = t => { msg.textContent = t; };
  if (!user) return show("Please log in first.");
  const kind = form.dataset.form;
  btn.disabled = true;
  try {
    if (kind === "bid") {
      await M.placeBid(work.id, user, form.querySelector("#bidAmt").value);
      flash = "Your bid was placed. You are the highest bidder.";
    } else if (kind === "buy") {
      const ship = { name: form.querySelector("#bName").value.trim(), phone: form.querySelector("#bPhone").value.trim(), address: form.querySelector("#bAddr").value.trim() };
      if (ship.name.length < 2) { btn.disabled = false; return show("Enter your full name."); }
      if (ship.phone.replace(/\D/g, "").length < 7) { btn.disabled = false; return show("Enter a phone number the artist can reach you on."); }
      if (ship.address.length < 10) { btn.disabled = false; return show("Enter your full delivery address."); }
      await M.buy(work.id, user, ship);
      flash = "Thank you. Your purchase is confirmed and the artist has been notified.";
    } else if (kind === "review") {
      await M.saveReview(work.id, user, form.querySelector("#rRating").value, form.querySelector("#rText").value);
      flash = "Your review was saved.";
    }
    KG.announce(flash);
    await onChange();
  } catch (err) {
    btn.disabled = false;
    show(say(err));
  }
}

async function onClick(e) {
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  if (btn.dataset.act === "buy-open") {
    const form = $("#vMarket form[data-form=buy]");
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("#bPhone").focus();
  }
  if (btn.dataset.act === "del-review") {
    const user = KG.auth.current(); if (!user) return;
    try { await M.removeReview(btn.dataset.id, user); } catch (err) { KG.toast(say(err), "error"); return; }
    flash = "Your review was deleted.";
    await onChange();
  }
}

["#vMarket", "#vReviews"].forEach(sel => { const el = $(sel); el.addEventListener("submit", onSubmit); el.addEventListener("click", onClick); });

KG.marketUI = {
  mount(w, cb) { work = w; onChange = cb; render(); startTimer(); },
  stop
};
})();
