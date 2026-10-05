/* server.js: the shared backend for Kalakriti Gallery.

   Run:  node server.js        then open  http://localhost:3000

   It serves the website AND stores everything in the data/ folder, so every laptop and
   every visitor sees the same artworks, accounts, bids, reviews and orders:
     data/db.json     users, sessions, artworks, bids, reviews, orders
     data/images/     the uploaded artwork pictures

   No npm install is needed (only Node 18 or newer).
   Environment variables: PORT (default 3000), HOST (default 0.0.0.0), DATA_DIR (default ./data),
                          TRUST_PROXY=1 when running behind a proxy such as Nginx or Render.        */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const crypto = require('crypto'), vm = require('vm'), os = require('os');
const scrypt = require('util').promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(IMG_DIR, { recursive: true });

/* =========================== database (a JSON file) =========================== */
let db = { users: [], sessions: [], artworks: [], bids: [], reviews: [], orders: [], featured: null, seeded: false };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
catch (e) { if (e.code !== 'ENOENT') { console.error('data/db.json is damaged:', e.message); process.exit(1); } }

function save() {                                   // write to a temp file first so a crash never corrupts db.json
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

// First run: add the 12 sample artworks from js/artworks-data.js
if (!db.seeded) {
  const sandbox = {}; sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'artworks-data.js'), 'utf8'), sandbox);
  db.artworks.push(...sandbox.KG.DEFAULT_ARTWORKS.map(a => ({ ...a })));
  db.seeded = true; save();
}

/* =========================== small helpers =========================== */
class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; }
}
const bad = (code, extra) => new HttpError(400, code, extra);
const uid = () => crypto.randomBytes(8).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const str = (v, max, min, field) => {
  v = String(v ?? '').trim();
  if (v.length < min || v.length > max) throw bad('BAD_INPUT', { field });
  return v;
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, over = false;
    req.on('data', c => {
      if (over) return;
      size += c.length;
      if (size > limit) { over = true; chunks.length = 0; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (over) return reject(new HttpError(413, 'TOO_BIG'));
      if (!chunks.length) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch { reject(bad('BAD_JSON')); }
    });
    req.on('error', reject);
  });
}

/* =========================== accounts and sessions =========================== */
async function hashPassword(password, salt) { return (await scrypt(password, salt, 64)).toString('hex'); }

function startSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = db.sessions.filter(s => s.exp > Date.now());
  db.sessions.push({ t: sha(token), userId: user.id, exp: Date.now() + 30 * 864e5 });
  return token;
}

function authUser(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const t = sha(m[1]);
  const s = db.sessions.find(x => x.t === t && x.exp > Date.now());
  return s ? db.users.find(u => u.id === s.userId) || null : null;
}
const needUser = user => { if (!user) throw new HttpError(401, 'UNAUTHORIZED'); return user; };
const publicUser = u => ({ id: u.id, name: u.name, email: u.email });

const attempts = new Map();                        // simple brute-force protection
function throttle(key, max = 10) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < 15 * 60e3);
  if (list.length >= max) throw new HttpError(429, 'TOO_MANY');
  list.push(now); attempts.set(key, list);
}
const clientIp = req => (process.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'ip';

/* =========================== artworks =========================== */
const STYLES = ['landscape', 'colorfield', 'geometric', 'neon', 'photoCity', 'photoSea', 'topo', 'dunes'];
const DEFAULT_PALETTE = ['#d9e4a8', '#b6d07a', '#8bb45a', '#5f9a4a', '#3f7a45', '#27553a'];
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };

function storeImage(dataUrl) {                       // "data:image/jpeg;base64,...." -> file on disk -> "/uploads/xxxx.jpg"
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const m = /^data:image\/(jpeg|png|webp|gif);base64$/.exec(head);
  if (comma < 0 || !m) throw bad('BAD_IMAGE');
  const buf = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  if (!buf.length || buf.length > 10 * 1024 * 1024) throw bad('BAD_IMAGE');
  const name = crypto.randomBytes(12).toString('hex') + '.' + EXT[m[1]];
  fs.writeFileSync(path.join(IMG_DIR, name), buf);
  return '/uploads/' + name;
}
function removeImage(url) {
  const m = /^\/uploads\/([a-f0-9]{24}\.(?:jpg|png|webp|gif))$/.exec(url || '');
  if (m) fs.unlink(path.join(IMG_DIR, m[1]), () => {});
}

const findWork = id => db.artworks.find(a => a.id === Number(id));

// Checks every field the browser sends. Returns the cleaned artwork (never trusts ownerId, soldTo etc. from the client).
function cleanArtwork(b, ex, user) {
  const out = ex ? { ...ex } : { ownerId: user.id, ownerName: user.name, sold: false };

  out.title = str(b.title, 120, 1, 'title');
  out.artist = str(b.artist, 120, 1, 'artist');
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) throw bad('BAD_INPUT', { field: 'year' });
  out.year = year;
  out.category = str(b.category, 40, 1, 'category');
  out.medium = str(b.medium || 'Mixed media', 120, 0, 'medium');
  out.dimensions = str(b.dimensions || 'Not stated', 60, 0, 'dimensions');
  out.description = str(b.description, 2000, 0, 'description');
  out.alt = str(b.alt || `${out.title} by ${out.artist}`, 400, 0, 'alt');

  out.sold = !!b.sold;
  if (!out.sold) { delete out.soldTo; delete out.soldFor; }

  // Sale rules cannot change once somebody has bid
  const locked = !!ex && db.bids.some(x => x.workId === ex.id);
  if (!locked) {
    if (b.saleType === 'auction') {
      const startBid = Math.floor(Number(b.startBid)), endsAt = Number(b.endsAt);
      if (!(startBid >= 1 && startBid <= 1e9)) throw bad('BAD_INPUT', { field: 'startBid' });
      const unchanged = !!ex && ex.saleType === 'auction' && ex.endsAt === endsAt;
      if (!Number.isFinite(endsAt) || (!unchanged && endsAt <= Date.now() + 60000)) throw bad('BAD_INPUT', { field: 'endsAt' });
      Object.assign(out, { saleType: 'auction', startBid, endsAt, price: null });
    } else {
      const price = (b.price === null || b.price === '' || b.price === undefined) ? null : Number(b.price);
      if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1e10)) throw bad('BAD_INPUT', { field: 'price' });
      Object.assign(out, { saleType: 'fixed', price, startBid: null, endsAt: null });
    }
  }

  // Look of the generated "sample art" used when there is no picture
  out.ratio = (Array.isArray(b.ratio) && b.ratio.length === 2 && b.ratio.every(n => Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) < 1e4))
    ? b.ratio.map(Number) : (out.ratio || [80, 100]);
  out.style = STYLES.includes(b.style) ? b.style : (out.style || 'dunes');
  out.seed = Number.isFinite(Number(b.seed)) ? Math.floor(Number(b.seed)) : (out.seed || 1);
  out.palette = (Array.isArray(b.palette) && b.palette.length <= 8 && b.palette.every(c => /^#[0-9a-f]{3,8}$/i.test(c)))
    ? b.palette : (out.palette || DEFAULT_PALETTE);

  // Picture (done last, so a rejected form never leaves stray files behind)
  const img = typeof b.image === 'string' ? b.image : (ex ? ex.image : '');
  if (img.startsWith('data:')) { const url = storeImage(img); if (ex && ex.image) removeImage(ex.image); out.image = url; }
  else if (img === '') { if (ex && ex.image) removeImage(ex.image); out.image = ''; }
  else out.image = ex ? ex.image : '';             // any other value is ignored

  return out;
}

/* =========================== bids, orders, reviews =========================== */
const bidsFor = id => db.bids.filter(b => b.workId === id).sort((x, y) => y.amount - x.amount || x.at - y.at);
const increment = amount => Math.max(100, Math.ceil(amount * 0.05 / 100) * 100);     // next bid must beat the last by about 5%

function finalize(work, buyer, amount, type, ship) {
  db.orders.push({
    id: uid(), workId: work.id, title: work.title, artist: work.artist, sellerId: work.ownerId || null,
    buyerId: buyer.id, buyerName: buyer.name, buyerEmail: buyer.email, amount, type, ship: ship || null,
    status: type === 'auction' ? 'Won, payment to be arranged' : 'Paid (demo)', at: Date.now()
  });
  work.sold = true; work.soldTo = buyer.id; work.soldFor = amount;
}

// Finished auctions that have bids become an order for the highest bidder
function settleEnded() {
  let changed = false;
  for (const a of db.artworks) {
    if (a.saleType !== 'auction' || a.sold || Date.now() < a.endsAt) continue;
    const top = bidsFor(a.id)[0]; if (!top) continue;
    finalize(a, { id: top.userId, name: top.name, email: top.email }, top.amount, 'auction', null);
    changed = true;
  }
  if (changed) save();
  return changed;
}
setInterval(settleEnded, 30000).unref();

/* =========================== API routes =========================== */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern + '$'), handler });

route('GET', '/bootstrap', ({ user }) => {
  settleEnded();
  return {
    me: user ? publicUser(user) : null,
    artworks: db.artworks,
    bids: db.bids.map(({ email, ...b }) => b),                                 // emails stay private
    reviews: db.reviews,
    purchases: db.orders.map(o => ({ buyerId: o.buyerId, workId: o.workId })),  // only used for the "Buyer" badge
    orders: user ? db.orders.filter(o => o.sellerId === user.id || o.buyerId === user.id) : [],
    featured: db.featured
  };
});

route('POST', '/register', async ({ req, body }) => {
  throttle('reg:' + clientIp(req), 20);
  const name = str(body.name, 80, 2, 'name');
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email) || email.length > 200) throw bad('BAD_INPUT', { field: 'email' });
  if (password.length < 8 || password.length > 200 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw bad('BAD_INPUT', { field: 'password' });
  if (db.users.some(u => u.email === email)) throw new HttpError(409, 'EMAIL_EXISTS');
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: uid(), name, email, salt, hash: await hashPassword(password, salt), created: Date.now() };
  if (db.users.some(u => u.email === email)) throw new HttpError(409, 'EMAIL_EXISTS');   // re-check after the await
  db.users.push(user);
  const token = startSession(user); save();
  return { token, user: publicUser(user) };
});

route('POST', '/login', async ({ req, body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const key = 'login:' + clientIp(req) + ':' + email;
  throttle(key);
  const user = db.users.find(u => u.email === email);
  const given = Buffer.from(await hashPassword(String(body.password || ''), user ? user.salt : 'x'.repeat(32)), 'hex');
  const real = Buffer.from(user ? user.hash : '0'.repeat(128), 'hex');
  if (!user || given.length !== real.length || !crypto.timingSafeEqual(given, real)) throw new HttpError(401, 'BAD_LOGIN');
  attempts.delete(key);
  const token = startSession(user); save();
  return { token, user: publicUser(user) };
});

route('POST', '/logout', ({ req }) => {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (m) { db.sessions = db.sessions.filter(s => s.t !== sha(m[1])); save(); }
  return { ok: true };
});

// Create (no id) or update (id) an artwork. Only the owner may update.
route('POST', '/artworks', ({ user, body }) => {
  needUser(user);
  let work;
  if (body.id != null) {
    const ex = findWork(body.id);
    if (!ex) throw new HttpError(404, 'NOT_FOUND');
    if (ex.ownerId !== user.id) throw new HttpError(403, 'NOT_OWNER');
    work = cleanArtwork(body, ex, user);
    db.artworks[db.artworks.indexOf(ex)] = work;
  } else {
    work = cleanArtwork(body, null, user);
    work.id = db.artworks.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    db.artworks.push(work);
  }
  save();
  return { artwork: work };
});

route('DELETE', '/artworks/(\\d+)', ({ user, params }) => {
  needUser(user);
  const work = findWork(params[0]);
  if (!work) throw new HttpError(404, 'NOT_FOUND');
  if (work.ownerId !== user.id) throw new HttpError(403, 'NOT_OWNER');
  if (work.saleType === 'auction' && !work.sold && Date.now() < work.endsAt && bidsFor(work.id).length) throw new HttpError(409, 'HAS_BIDS');
  removeImage(work.image);
  db.artworks = db.artworks.filter(a => a !== work);
  db.bids = db.bids.filter(b => b.workId !== work.id);
  db.reviews = db.reviews.filter(r => r.workId !== work.id);
  if (db.featured === work.id) db.featured = null;
  save();
  return { ok: true };
});

route('POST', '/artworks/(\\d+)/bids', ({ user, params, body }) => {
  needUser(user);
  const a = findWork(params[0]);
  if (!a || a.saleType !== 'auction') throw bad('NOT_AUCTION');
  if (a.ownerId === user.id) throw new HttpError(403, 'OWN_WORK');
  if (a.sold) throw new HttpError(409, 'SOLD');
  if (Date.now() >= a.endsAt) throw new HttpError(409, 'ENDED');
  const top = bidsFor(a.id)[0];
  const min = top ? top.amount + increment(top.amount) : a.startBid;
  const amount = Math.floor(Number(body.amount));
  if (top && top.userId === user.id) throw new HttpError(409, 'LEADING');
  if (!Number.isFinite(amount) || amount < min || amount > 1e10) throw new HttpError(409, 'TOO_LOW', { min });
  db.bids.push({ id: uid(), workId: a.id, userId: user.id, name: user.name, email: user.email, amount, at: Date.now() });
  save();
  return { ok: true };
});

route('POST', '/artworks/(\\d+)/buy', ({ user, params, body }) => {
  needUser(user);
  const a = findWork(params[0]);
  if (!a || a.saleType === 'auction' || a.price == null) throw bad('NOT_FOR_SALE');
  if (a.ownerId === user.id) throw new HttpError(403, 'OWN_WORK');
  if (a.sold) throw new HttpError(409, 'SOLD');
  const s = body.ship || {};
  const ship = { name: str(s.name, 100, 2, 'name'), phone: str(s.phone, 40, 7, 'phone'), address: str(s.address, 400, 10, 'address') };
  finalize(a, user, a.price, 'fixed', ship);        // To take real payments, charge the card here BEFORE finalize().
  save();
  return { ok: true };
});

route('PUT', '/artworks/(\\d+)/review', ({ user, params, body }) => {
  needUser(user);
  const a = findWork(params[0]);
  if (!a) throw new HttpError(404, 'NOT_FOUND');
  if (a.ownerId === user.id) throw new HttpError(403, 'OWN_WORK');
  const rating = Number(body.rating), text = String(body.text || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw bad('BAD_RATING');
  if (text.length > 600) throw bad('TOO_LONG');
  const mine = db.reviews.find(r => r.workId === a.id && r.userId === user.id);
  if (mine) Object.assign(mine, { rating, text, at: Date.now() });
  else db.reviews.push({ id: uid(), workId: a.id, userId: user.id, name: user.name, rating, text, at: Date.now() });
  save();
  return { ok: true };
});

route('DELETE', '/reviews/([a-f0-9]+)', ({ user, params }) => {
  needUser(user);
  db.reviews = db.reviews.filter(r => !(r.id === params[0] && r.userId === user.id));
  save();
  return { ok: true };
});

// Which artwork is shown large on the home page (you can only pick your own)
route('POST', '/featured', ({ user, body }) => {
  needUser(user);
  if (body.id == null) {
    const cur = findWork(db.featured);
    if (cur && cur.ownerId !== user.id) throw new HttpError(403, 'NOT_OWNER');
    db.featured = null;
  } else {
    const w = findWork(body.id);
    if (!w) throw new HttpError(404, 'NOT_FOUND');
    if (w.ownerId !== user.id) throw new HttpError(403, 'NOT_OWNER');
    db.featured = w.id;
  }
  save();
  return { featured: db.featured };
});

async function handleApi(req, res, pathname) {
  const sub = pathname.slice(4);                    // strip "/api"
  const r = routes.map(x => x.method === req.method && x.re.exec(sub) ? { x, m: x.re.exec(sub) } : null).find(Boolean);
  if (!r) throw new HttpError(404, 'NOT_FOUND');
  const body = (req.method === 'GET' || req.method === 'HEAD') ? {} : await readBody(req);
  const out = await r.x.handler({ req, body, user: authUser(req), params: r.m.slice(1) });
  send(res, 200, out);
}

/* =========================== static files =========================== */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'METHOD');
  if (pathname === '/') pathname = '/index.html';
  let file, cache = 'no-cache';
  if (/^\/[\w-]+\.html$/.test(pathname) || /^\/(css|js)\/[\w.-]+$/.test(pathname)) file = path.join(ROOT, pathname);
  else if (/^\/uploads\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(pathname)) { file = path.join(IMG_DIR, path.basename(pathname)); cache = 'public, max-age=31536000, immutable'; }
  else throw new HttpError(404, 'NOT_FOUND');

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'NOT_FOUND' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

/* =========================== HTTP server =========================== */
const CORS = {                                       // lets migrate-old-art.html (opened from a file) talk to this server
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

http.createServer(async (req, res) => {
  try {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { throw bad('BAD_URL'); }
    if (pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
      return await handleApi(req, res, pathname);
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.code, ...err.extra });
    console.error(err);
    send(res, 500, { error: 'SERVER_ERROR' });
  }
}).listen(PORT, HOST, () => {
  console.log(`\nKalakriti Gallery is running.\n  On this computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`  On your network:   http://${i.address}:${PORT}   (other laptops and phones on the same Wi-Fi)`);
  console.log(`  Data is saved in:  ${DATA_DIR}\n`);
});
