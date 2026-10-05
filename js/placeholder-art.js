/* placeholder-art.js: draws the sample artworks as SVG so no image files are needed.
   Once a user uploads a real image, that image is used instead. */
window.KG = window.KG || {};
(() => {
'use strict';

// Small random number generator: the same seed always gives the same picture
function makeRng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 6; i++) rnd();
  return rnd;
}

// Shared filters: film grain, painterly edges, soft blur, vignette
function svgDefs(W) {
  return `<defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 .22"/></feComponentTransfer></filter>
    <filter id="brush" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${W * .035}"/></filter>
    <filter id="paint" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${W * .02}" result="d"/><feGaussianBlur in="d" stdDeviation="${W * .005}"/></filter>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${W * .045}"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="${W * .006}"/></filter>
    <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".005" numOctaves="2" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${W * .09}"/></filter>
    <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
  </defs>`;
}

// A wavy hill silhouette across the whole width
function hill(W, H, base, amp, rnd) {
  const n = 6, step = W / n, pts = [];
  for (let i = -1; i <= n + 1; i++) pts.push([i * step, base + (rnd() - .5) * amp]);
  let d = `M${pts[0][0]} ${H + 60} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` Q${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]} L${last[0]} ${H + 60} Z`;
}

// One drawing function per style. p = palette, r = random generator
const STYLES = {
  // Landscape painting: sky, sun, three layers of hills, reflection stripes
  landscape(r, p, W, H) {
    const sx = W * (.25 + r() * .5), sy = H * (.24 + r() * .1);
    let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${p[2]}" stop-opacity=".9"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#sky)"/>
      <circle cx="${sx}" cy="${sy}" r="${W * .32}" fill="url(#glow)"/>
      <circle cx="${sx}" cy="${sy}" r="${W * .065}" fill="${p[2]}"/>
      <rect y="${H * .78}" width="${W}" height="${H * .25}" fill="${p[5]}"/>
      <g filter="url(#brush)">
        <path d="${hill(W, H, H * .56, H * .12, r)}" fill="${p[3]}"/>
        <path d="${hill(W, H, H * .66, H * .10, r)}" fill="${p[4]}"/>
        <path d="${hill(W, H, H * .77, H * .07, r)}" fill="${p[5]}"/>
      </g>`;
    for (let i = 0; i < 7; i++) {
      const w = W * (.26 - i * .028) + r() * W * .05;
      s += `<rect x="${sx - w / 2}" y="${H * .82 + i * H * .026}" width="${w}" height="${H * .006}" rx="2" fill="${p[2]}" opacity="${.55 - i * .06}"/>`;
    }
    return s;
  },

  // Colour field: soft rectangles on a dark ground
  colorfield(r, p, W, H) {
    const m = W * .09;
    return `<rect width="${W}" height="${H}" fill="${p[0]}"/>
      <g filter="url(#paint)">
        <rect x="${m}" y="${H * .09}" width="${W - m * 2}" height="${H * .42}" fill="${p[1]}"/>
        <rect x="${m * 1.4}" y="${H * .13}" width="${W - m * 2.8}" height="${H * .34}" fill="${p[2]}" opacity=".35"/>
        <rect x="${m}" y="${H * .555}" width="${W - m * 2}" height="${H * .34}" fill="${p[2]}"/>
        <rect x="${m}" y="${H * .518}" width="${W - m * 2}" height="${H * .012}" fill="${p[3]}"/>
      </g>`;
  },

  // Geometric: circles, arches and flat shapes
  geometric(r, p, W, H) {
    return `<rect width="${W}" height="${H}" fill="${p[0]}"/>
      <circle cx="${W * (.55 + r() * .1)}" cy="${H * .36}" r="${W * .26}" fill="${p[1]}"/>
      <rect x="${W * .08}" y="${H * .52}" width="${W * .5}" height="${H * .34}" fill="${p[2]}"/>
      <path d="M0 ${H} L0 ${H * .62} A${W * .5} ${W * .5} 0 0 1 ${W * .5} ${H} Z" fill="${p[3]}" opacity=".95"/>
      <path d="M${W * .6} ${H} A${W * .2} ${W * .2} 0 0 1 ${W} ${H} Z" fill="${p[4]}"/>
      <rect x="${W * .66}" y="${H * .62}" width="${W * .22}" height="${H * .02}" fill="${p[4]}"/>
      <line x1="${W * .08}" y1="${H * .1}" x2="${W * .5}" y2="${H * .1}" stroke="${p[4]}" stroke-width="${W * .008}"/>
      <rect width="${W}" height="${H}" fill="none" stroke="${p[0]}" stroke-width="${W * .04}"/>`;
  },

  // Neon: blurred glowing shapes with thin lines
  neon(r, p, W, H) {
    let s = `<rect width="${W}" height="${H}" fill="${p[0]}"/><g filter="url(#blur)">`;
    for (let i = 0; i < 5; i++) s += `<circle cx="${r() * W}" cy="${r() * H}" r="${W * (.14 + r() * .17)}" fill="${p[1 + i % 3]}" opacity=".8"/>`;
    s += `</g>`;
    for (let i = 0; i < 9; i++) {
      const y = H * (.08 + i * .1) + r() * H * .03;
      s += `<path d="M0 ${y} C${W * .25} ${y - H * .1} ${W * .5} ${y + H * .1} ${W} ${y - H * .02}" fill="none" stroke="${p[1 + i % 3]}" stroke-width="${1.5 + i % 3}" opacity=".7"/>`;
    }
    return s + `<circle cx="${W * (.35 + r() * .3)}" cy="${H * (.35 + r() * .2)}" r="${W * .16}" fill="none" stroke="#fff" stroke-width="2.5" opacity=".8"/>`;
  },

  // Photograph of a skyline in silhouette
  photoCity(r, p, W, H) {
    let s = `<defs><linearGradient id="ps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
      <radialGradient id="pg"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#ps)"/>
      <circle cx="${W * (.3 + r() * .4)}" cy="${H * .44}" r="${W * .36}" fill="url(#pg)"/>`;
    let x = -W * .03;
    while (x < W) {
      const w = W * (.07 + r() * .11), h = H * (.16 + r() * .36);
      s += `<rect x="${x}" y="${H * .92 - h}" width="${w}" height="${h + H * .1}" fill="${p[2]}" opacity="${.78 + r() * .22}"/>`;
      x += w + r() * W * .01;
    }
    return s + `<rect y="${H * .92}" width="${W}" height="${H * .1}" fill="${p[2]}"/><rect width="${W}" height="${H}" fill="url(#vig)"/>`;
  },

  // Photograph of a calm sea with a small boat
  photoSea(r, p, W, H) {
    const hz = H * .56, bx = W * (.3 + r() * .4);
    let s = `<defs><linearGradient id="ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
      <linearGradient id="sw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient>
      <radialGradient id="sg"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${hz}" fill="url(#ss)"/>
      <circle cx="${bx}" cy="${hz - H * .08}" r="${W * .26}" fill="url(#sg)"/>
      <rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#sw)"/>`;
    for (let i = 0; i < 9; i++) s += `<rect x="0" y="${hz + i * (H - hz) / 9}" width="${W}" height="${H * .004 + r() * H * .008}" fill="#fff" opacity="${.12 + r() * .2}"/>`;
    s += `<path d="M${bx - W * .07} ${hz + H * .02} L${bx + W * .07} ${hz + H * .02} L${bx + W * .04} ${hz + H * .045} L${bx - W * .05} ${hz + H * .045} Z" fill="${p[2]}"/>
          <rect x="${bx}" y="${hz - H * .05}" width="${W * .004}" height="${H * .07}" fill="${p[2]}"/>
          <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
    return s;
  },

  // Topographic contour lines, wobbled to look organic
  topo(r, p, W, H) {
    let s = `<rect width="${W}" height="${H}" fill="${p[0]}"/><g filter="url(#wobble)" fill="none">`;
    const cx = W * (.4 + r() * .2), cy = H * (.4 + r() * .2);
    for (let i = 1; i <= 20; i++) {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${i * W * .034}" ry="${i * H * .026}" stroke="${i % 5 === 0 ? p[2] : p[1]}" stroke-width="${i % 5 === 0 ? 3 : 1.4}" opacity="${.9 - i * .02}" transform="rotate(${r() * 30 - 15} ${cx} ${cy})"/>`;
    }
    return s + `</g>`;
  },

  // Layered wavy bands, like dunes or terraced fields
  dunes(r, p, W, H) {
    let s = `<rect width="${W}" height="${H}" fill="${p[0]}"/>`;
    const layers = p.length + 1;
    for (let i = 0; i < layers; i++) {
      const base = H * (.18 + i * (.82 / layers)), amp = H * (.05 + r() * .04), ph = r() * 6, fq = 1.2 + r() * 1.4;
      let d = `M0 ${H}`;
      for (let x = 0; x <= W; x += W / 40) d += ` L${x.toFixed(1)} ${(base + Math.sin(x / W * Math.PI * fq + ph) * amp).toFixed(1)}`;
      s += `<path d="${d} L${W} ${H} Z" fill="${p[Math.min(i, p.length - 1)]}" opacity=".96"/>`;
    }
    return s;
  }
};

const DEFAULT_PALETTE = ["#d9e4a8","#b6d07a","#8bb45a","#5f9a4a","#3f7a45","#27553a"];
const artCache = new Map();

// Returns a data: URL for the generated picture of an artwork
function generatedSrc(a) {
  const pal = (a.palette && a.palette.length >= 6) ? a.palette : DEFAULT_PALETTE;
  const key = [a.id, a.style, a.seed, a.ratio.join("x"), pal.join(",")].join("|");
  if (artCache.has(key)) return artCache.get(key);
  const W = 800, H = Math.max(200, Math.min(2000, Math.round(W * a.ratio[1] / a.ratio[0])));
  const body = (STYLES[a.style] || STYLES.landscape)(makeRng(a.seed || 1), pal, W, H);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svgDefs(W)}${body}<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  const url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  artCache.set(key, url);
  return url;
}

// Uses the image the user uploaded when "image" is set, otherwise the generated picture
const artSrc = a => a.image || generatedSrc(a);

// Placeholder portrait for the About section (replace by setting PORTRAIT_URL)
const PORTRAIT_URL = "";
function portraitSrc() {
  if (PORTRAIT_URL) return PORTRAIT_URL;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfd3e6"/><stop offset="1" stop-color="#8f98c4"/></linearGradient>
    <radialGradient id="l" cx=".3" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="800" height="1000" fill="url(#b)"/><rect width="800" height="1000" fill="url(#l)"/>
    <path d="M110 1000 C130 760 260 690 400 690 C540 690 670 760 690 1000 Z" fill="#2b2f4a"/>
    <rect x="352" y="590" width="96" height="120" rx="30" fill="#b98a6a"/>
    <ellipse cx="400" cy="470" rx="130" ry="158" fill="#c99a78"/>
    <path d="M262 470 C250 300 360 262 430 276 C520 290 560 380 538 480 C520 410 470 366 400 372 C330 378 280 410 262 470 Z" fill="#1c1a24"/>
    <filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .18"/></feComponentTransfer></filter>
    <rect width="800" height="1000" filter="url(#g)"/></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

KG.generatedSrc = generatedSrc;
KG.artSrc = artSrc;
KG.portraitSrc = portraitSrc;
})();
