/* utils.js: small helpers used on every page */
window.KG = window.KG || {};
(() => {
'use strict';

KG.$  = (sel, root = document) => root.querySelector(sel);
KG.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape text before putting it inside HTML
KG.esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

KG.money   = new Intl.NumberFormat(KG.SITE.locale, { style: "currency", currency: KG.SITE.currency, maximumFractionDigits: 0 });
KG.dateFmt = new Intl.DateTimeFormat(KG.SITE.locale, { day: "numeric", month: "short", year: "numeric" });
KG.parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

KG.priceText = a => a.sold ? "Sold" : (a.price == null ? "Price on request" : KG.money.format(a.price));
KG.altOf = a => a.alt || `${a.title} by ${a.artist}`;

// Tell screen readers about a change
KG.announce = msg => {
  const el = KG.$("#announcer"); if (!el) return;
  el.textContent = "";
  setTimeout(() => el.textContent = msg, 50);
};

// Short message at the bottom of the screen
KG.toast = (msg, kind = "") => {
  const old = KG.$(".toast"); if (old) old.remove();
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.setAttribute("role", kind === "error" ? "alert" : "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
};

// Only allow redirects to our own pages (prevents ?next=https://evil.example)
KG.safeNext = (fallback = "dashboard.html") => {
  const next = new URLSearchParams(location.search).get("next");
  return ["dashboard.html", "index.html"].includes(next) ? next : fallback;
};

/* Reads an image file, shrinks it so it fits in browser storage, and returns
   { dataUrl, ratio }. Rejects with a readable message if the file is not usable. */
KG.processImage = (file, maxSide = 1600, quality = 0.85) => new Promise((resolve, reject) => {
  if (!file || !/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
    return reject(new Error("Please choose a JPG, PNG or WebP image."));
  }
  if (file.size > 25 * 1024 * 1024) {
    return reject(new Error("That image is larger than 25 MB. Please choose a smaller one."));
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (!img.naturalWidth || !img.naturalHeight) return reject(new Error("That file could not be read as an image."));
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);      // white behind transparent PNGs
    ctx.drawImage(img, 0, 0, w, h);
    resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), ratio: [Math.round(w / h * 100), 100] });
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as an image.")); };
  img.src = url;
});
})();
