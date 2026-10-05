/* storage.js: talks to the Kalakriti server (server.js).

   Accounts, artworks, bids, reviews and orders are now stored on the SERVER, so every laptop and
   every visitor sees the same gallery. Only the login token is kept in this browser.
   The pages still call KG.auth.* and KG.artworks.* exactly as before.                               */
window.KG = window.KG || {};
(() => {
'use strict';

/* ---------- tiny safe wrappers (browser storage can be blocked in private mode) ---------- */
const store = which => which === "session" ? window.sessionStorage : window.localStorage;
const read  = (which, key, fallback = null) => { try { const v = store(which).getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (which, key, val) => { try { store(which).setItem(key, JSON.stringify(val)); return true; } catch { return false; } };
const drop  = (which, key) => { try { store(which).removeItem(key); } catch {} };

const SESSION = "kg_session";
const fail = (code, extra) => Object.assign(new Error(code), { code }, extra);
const stored = () => read("session", SESSION) || read("local", SESSION);

/* =======================================================================
   API helper: KG.api("POST", "/login", {...}). Throws an Error with .code on failure.
   ======================================================================= */
let warned = false;
KG.api = async (method, url, body, opts = {}) => {
  const s = stored();
  let res;
  try {
    res = await fetch("/api" + url, {
      method, keepalive: !!opts.keepalive,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(s ? { Authorization: "Bearer " + s.token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    if (!warned && KG.toast) { warned = true; KG.toast("Cannot reach the gallery server. Start it with: node server.js", "error"); }
    throw fail("NETWORK");
  }
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && data.error === "UNAUTHORIZED") { drop("local", SESSION); drop("session", SESSION); }   // token expired
    throw fail(data.error || (res.status === 413 ? "TOO_BIG" : "ERROR"), data);
  }
  return data;
};

/* =======================================================================
   ACCOUNTS  (KG.auth)
   ======================================================================= */
KG.auth = {
  current() { const s = stored(); return s ? { id: s.id, name: s.name, email: s.email } : null; },

  async register({ name, email, password }) {
    const d = await KG.api("POST", "/register", { name, email, password });
    return { ...d.user, token: d.token };
  },

  async login({ email, password }) {
    const d = await KG.api("POST", "/login", { email, password });
    return { ...d.user, token: d.token };
  },

  // remember = true keeps the user signed in after the browser closes
  startSession(user, remember) {
    drop("local", SESSION); drop("session", SESSION);
    const ok = write(remember ? "local" : "session", SESSION, { id: user.id, name: user.name, email: user.email, token: user.token });
    if (!ok) throw fail("STORAGE");
  },

  logout() {
    if (stored()) KG.api("POST", "/logout", {}, { keepalive: true }).catch(() => {});
    drop("local", SESSION); drop("session", SESSION);
  },

  // Call at the top of a protected page. Redirects to the login page when nobody is signed in.
  requireLogin() {
    const user = KG.auth.current();
    if (!user) {
      const page = location.pathname.split("/").pop() || "index.html";
      location.replace("login.html?next=" + encodeURIComponent(page));
      return null;
    }
    return user;
  }
};

/* =======================================================================
   ARTWORKS  (KG.artworks)
   Every call to all() downloads the latest artworks, bids, reviews and orders from the server and keeps
   them in KG.cache, which market.js reads from. That is why other laptops see the same gallery.
   ======================================================================= */
KG.cache = { artworks: [], bids: [], reviews: [], purchases: [], orders: [], featured: null };
KG.storageOK = true;                                  // false when the server cannot be reached

KG.artworks = {
  async all() {
    try {
      const d = await KG.api("GET", "/bootstrap");
      if (!d.me && stored()) { drop("local", SESSION); drop("session", SESSION); location.reload(); }   // saved login is no longer valid
      Object.assign(KG.cache, { artworks: d.artworks, bids: d.bids, reviews: d.reviews, purchases: d.purchases, orders: d.orders, featured: d.featured });
      KG.storageOK = true;
      return d.artworks.map(a => ({ ...a })).sort((a, b) => a.id - b.id);
    } catch (err) {
      console.warn("Server unavailable, showing the built-in sample artworks:", err);
      KG.storageOK = false;
      return KG.DEFAULT_ARTWORKS.map(a => ({ ...a }));
    }
  },

  // New artwork: leave out `id` (the server picks it). Returns the saved artwork.
  async save(artwork) { return (await KG.api("POST", "/artworks", artwork)).artwork; },
  remove(id)          { return KG.api("DELETE", "/artworks/" + id); }
};

// Which artwork is shown large on the home page (shared by everybody)
KG.featured = {
  get() { return KG.cache.featured == null ? null : Number(KG.cache.featured); },
  async set(id) { const d = await KG.api("POST", "/featured", { id }); KG.cache.featured = d.featured; }
};
})();
