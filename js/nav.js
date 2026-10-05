/* nav.js: navigation bar used on every page (account links + mobile menu) */
window.KG = window.KG || {};
(() => {
'use strict';
const { $, esc, SITE } = KG;

function fillNames() {
  [["#brandName", SITE.name], ["#footerName", SITE.name], ["#copyName", SITE.fullName]]
    .forEach(([sel, text]) => { const el = $(sel); if (el) el.textContent = text; });
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
}

// Log in / Sign up when signed out. Name, My art and Log out when signed in.
function renderAuth() {
  const slot = $("#authLinks"); if (!slot) return;
  const user = KG.auth.current();
  if (user) {
    slot.innerHTML = `<span class="user-chip">Hi, ${esc(user.name.split(" ")[0])}</span>
      <a href="dashboard.html">My art</a>
      <button class="linklike" id="logoutBtn" type="button">Log out</button>`;
    $("#logoutBtn").addEventListener("click", () => { KG.auth.logout(); location.href = "index.html"; });
  } else {
    slot.innerHTML = `<a href="login.html">Log in</a><a class="btn small primary" href="signup.html">Sign up</a>`;
  }
}

/* Mobile menu */
function closeMenu() {
  const menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
  if (!menuBtn) return;
  navLinks.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.setAttribute("aria-label", "Open menu");
}

function bindMenu() {
  const menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
  if (!menuBtn) return;
  menuBtn.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  navLinks.addEventListener("click", e => { if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && navLinks.classList.contains("open")) { closeMenu(); menuBtn.focus(); }
  });
}

KG.nav = { init() { fillNames(); renderAuth(); bindMenu(); }, closeMenu };
})();
