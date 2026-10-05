/* market.js: selling, buying, auctions and reviews (KG.market).

   Reads come from KG.cache (filled by KG.artworks.all(), which loads everything from the server).
   Writes go to the server, which re-checks every rule (bid too low, auction ended, already sold,
   who owns what), so they cannot be bypassed from the browser.

   An artwork has these extra fields:
     ownerId, ownerName   who uploaded it (set by the server)
     saleType             "fixed" (price) or "auction" (startBid + endsAt)
     startBid, endsAt     auction only; endsAt is a timestamp in milliseconds
     soldTo, soldFor      set when it is bought or the auction is won                                */
window.KG = window.KG || {};
(() => {
'use strict';

const C = () => KG.cache;
const money = n => KG.money.format(n);

const M = KG.market = {
  /* ---------- what kind of sale is this? ---------- */
  saleType: a => a.saleType === "auction" ? "auction" : (a.price == null ? "inquiry" : "fixed"),
  isLive:   a => a.saleType === "auction" && !a.sold && Date.now() < a.endsAt,

  priceLabel(a) {
    if (a.sold) return "Sold";
    if (a.saleType === "auction") {
      if (Date.now() >= a.endsAt) return "Auction ended";
      return M.topBid(a) ? `Current bid ${money(M.topBid(a).amount)}` : `Starting bid ${money(a.startBid)}`;
    }
    return a.price == null ? "Price on request" : money(a.price);
  },

  /* ---------- bids ---------- */
  bids:       id => C().bids.filter(b => b.workId === id).sort((x, y) => y.amount - x.amount || x.at - y.at),
  topBid:     a  => M.bids(a.id)[0] || null,
  increment:  amount => Math.max(100, Math.ceil(amount * 0.05 / 100) * 100),     // next bid must beat the last by about 5%
  currentBid: a  => { const t = M.topBid(a); return t ? t.amount : a.startBid; },
  minBid:     a  => { const t = M.topBid(a); return t ? t.amount + M.increment(t.amount) : a.startBid; },
  myBids:     userId => {                                                         // latest bid per artwork for one user
    const latest = new Map();
    C().bids.filter(b => b.userId === userId).forEach(b => { if (!latest.has(b.workId) || latest.get(b.workId).amount < b.amount) latest.set(b.workId, b); });
    return [...latest.values()];
  },

  placeBid: async (workId, user, amount) => { await KG.api("POST", `/artworks/${workId}/bids`, { amount }); },

  /* ---------- orders ---------- */
  // Fixed-price purchase. To take real payments, call your gateway (Razorpay, Stripe) in server.js, route POST /artworks/:id/buy.
  buy: async (workId, user, ship) => { await KG.api("POST", `/artworks/${workId}/buy`, { ship }); },

  // The server turns finished auctions into orders by itself; kept so older code keeps working.
  settleEnded: async () => 0,

  ordersAsSeller: id => C().orders.filter(o => o.sellerId === id).sort((a, b) => b.at - a.at),
  ordersAsBuyer:  id => C().orders.filter(o => o.buyerId === id).sort((a, b) => b.at - a.at),
  hasBought:      (userId, workId) => C().purchases.some(o => o.buyerId === userId && o.workId === workId),

  /* ---------- reviews (one per person per artwork, editable) ---------- */
  reviews: id => C().reviews.filter(r => r.workId === id).sort((a, b) => b.at - a.at),

  rating(id) {
    const list = M.reviews(id);
    return { count: list.length, avg: list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0 };
  },

  ratingMap() {                                       // { artworkId: {count, avg} } in one pass, used by the grid
    const out = {};
    C().reviews.forEach(r => { const o = out[r.workId] || (out[r.workId] = { sum: 0, count: 0 }); o.sum += r.rating; o.count++; });
    Object.values(out).forEach(o => { o.avg = o.sum / o.count; });
    return out;
  },

  saveReview:   async (workId, user, rating, text) => { await KG.api("PUT", `/artworks/${workId}/review`, { rating, text }); },
  removeReview: async (id) => { await KG.api("DELETE", "/reviews/" + id); },

  // The server removes a work's bids and reviews when it is deleted
  purgeWork() {}
};
})();
