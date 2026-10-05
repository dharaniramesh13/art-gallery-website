/* auth.js: behaviour for login.html and signup.html (chosen by <body data-page="...">) */
(() => {
'use strict';
const { $ } = KG;
KG.nav.init();

const page = document.body.dataset.page;               // "login" or "signup"
const form = $("#form");

// Already signed in? Go straight on.
if (KG.auth.current()) location.replace(KG.safeNext());

// Decorative artwork beside the form
const sample = KG.DEFAULT_ARTWORKS.find(a => a.title === (page === "login" ? "Dusk at the Barrage" : "Neon Monsoon")) || KG.DEFAULT_ARTWORKS[0];
$("#authArt").src = KG.generatedSrc(sample);

// Keep ?next= when moving between the two pages
const next = new URLSearchParams(location.search).get("next");
if (next) $("#altLink").href += "?next=" + encodeURIComponent(next);

/* ---------- small helpers ---------- */
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function setError(input, message) {
  const err = $("#" + input.id + "Err");
  err.textContent = message;
  if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  return !message;
}
function showAlert(html) { const a = $("#formAlert"); a.innerHTML = html; a.hidden = !html; }
function busy(on, label) {
  const b = $("#submitBtn");
  b.disabled = on;
  b.textContent = on ? label : (page === "login" ? "Log in" : "Create account");
}
function focusFirstError() { const el = form.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }

// Show / hide password buttons
document.querySelectorAll(".pw-toggle").forEach(btn => btn.addEventListener("click", () => {
  const input = $("#" + btn.dataset.target);
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "Hide" : "Show";
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
}));

// Clear an error as soon as the visitor starts fixing it
form.addEventListener("input", e => {
  if (e.target.matches("input")) { setError(e.target, ""); showAlert(""); }
});

/* ---------- LOGIN ---------- */
async function handleLogin(e) {
  e.preventDefault(); showAlert("");
  const email = $("#email"), password = $("#password");
  let ok = setError(email, EMAIL_RE.test(email.value.trim()) ? "" : "Enter the email address you signed up with.");
  ok = setError(password, password.value ? "" : "Enter your password.") && ok;
  if (!ok) return focusFirstError();

  busy(true, "Logging in…");
  try {
    const user = await KG.auth.login({ email: email.value, password: password.value });
    KG.auth.startSession(user, $("#remember").checked);
    location.href = KG.safeNext();
  } catch (err) {
    busy(false);
    showAlert(err.code === "BAD_LOGIN"
      ? `That email and password do not match an account. Check them and try again, or <a href="signup.html">create an account</a>.`
      : err.code === "NETWORK" ? `Cannot reach the gallery server. Check your connection and try again.`
      : err.code === "TOO_MANY" ? `Too many attempts. Please wait a few minutes and try again.`
      : `Something went wrong while logging in. Please try again.`);
  }
}

/* ---------- SIGN UP ---------- */
function passwordProblem(pw) {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Add at least one letter.";
  if (!/\d/.test(pw)) return "Add at least one number.";
  return "";
}

async function handleSignup(e) {
  e.preventDefault(); showAlert("");
  const name = $("#name"), email = $("#email"), password = $("#password"), confirm = $("#confirm");
  let ok = setError(name, name.value.trim().length >= 2 ? "" : "Enter your full name.");
  ok = setError(email, EMAIL_RE.test(email.value.trim()) ? "" : "Enter a valid email address, like name@example.com.") && ok;
  ok = setError(password, passwordProblem(password.value)) && ok;
  ok = setError(confirm, confirm.value === password.value ? "" : "The two passwords do not match.") && ok;
  if (!ok) return focusFirstError();

  busy(true, "Creating account…");
  try {
    const user = await KG.auth.register({ name: name.value, email: email.value, password: password.value });
    KG.auth.startSession(user, true);
    location.href = KG.safeNext();
  } catch (err) {
    busy(false);
    if (err.code === "EMAIL_EXISTS") {
      setError(email, "An account with this email already exists.");
      showAlert(`You already have an account with this email. <a href="login.html">Log in instead</a>.`);
      email.focus();
    } else {
      showAlert(err.code === "NETWORK" ? `Cannot reach the gallery server. Check your connection and try again.`
        : err.code === "TOO_MANY" ? `Too many attempts. Please wait a few minutes and try again.`
        : err.code === "BAD_INPUT" ? `Please check your details: the name, email or password is not valid.`
        : `The account could not be created. Please try again.`);
    }
  }
}

form.addEventListener("submit", page === "login" ? handleLogin : handleSignup);
})();
