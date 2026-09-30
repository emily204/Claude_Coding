"use strict";
/* PretendPay Shop — a browse-and-buy demo. No payment is ever processed and nothing leaves your device. */

const KEY = "pretendpay.v1";
const $ = s => document.querySelector(s);
const view = $("#view");
const money = n => "$" + n.toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = id => PRODUCTS.find(p => p.id === Number(id));

// ---------- state ----------
const emptyAddr = { name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "United States" };
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.cart) && s.profile && Array.isArray(s.orders)) return s;
  } catch (e) {}
  return { cart: [], orders: [], profile: { shipping: { ...emptyAddr }, billing: { ...emptyAddr }, billingSame: true, card: null } };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} updateBadge(); }
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1600); }

// ---------- cart math ----------
const cartItems = () => state.cart.map(i => ({ ...i, p: byId(i.id) })).filter(i => i.p);
function totals() {
  const sub = cartItems().reduce((s, i) => s + i.p.price * i.qty, 0);
  const ship = sub === 0 || sub >= 50 ? 0 : 4.99;
  const tax = Math.round(sub * 0.08 * 100) / 100;
  return { sub, ship, tax, total: sub + ship + tax };
}
function addToCart(id) {
  const l = state.cart.find(i => i.id === id);
  l ? l.qty++ : state.cart.push({ id, qty: 1 });
  save(); toast("Added to cart 🛒");
}
function updateBadge() {
  const n = state.cart.reduce((s, i) => s + i.qty, 0);
  const b = $("#cart-count"); b.textContent = n; b.hidden = n === 0;
}

// ---------- forms ----------
const FIELDS = [["name", "Full name", "name"], ["line1", "Address line 1", "address-line1"], ["line2", "Apt, suite (optional)", "address-line2"]];
function addrForm(prefix, a) {
  const inp = (k, label, ac, extra = "") => `<label for="${prefix}-${k}">${label}</label><input id="${prefix}-${k}" name="${prefix}.${k}" autocomplete="${prefix === "ship" ? "shipping " : "billing "}${ac}" value="${esc(a[k])}" ${extra}>`;
  return FIELDS.map(([k, l, ac]) => inp(k, l, ac)).join("") +
    `<div class="two"><div>${inp("city", "City", "address-level2")}</div><div>${inp("state", "State / Region", "address-level1")}</div></div>
     <div class="two"><div>${inp("zip", "ZIP / Postal code", "postal-code")}</div><div>${inp("country", "Country", "country-name")}</div></div>`;
}
function cardForm(c) {
  return `<div class="ccard"><div class="top"><span>FAKE CARD</span><span>DEMO ONLY</span></div>
    <div class="num" id="cc-preview">${c ? "•••• •••• •••• " + esc(c.last4) : "•••• •••• •••• ••••"}</div>
    <div class="bot"><span id="cc-name">${esc(c?.name || "YOUR NAME")}</span><span id="cc-exp">${esc(c?.exp || "MM/YY")}</span></div></div>
    <label for="cc-holder">Name on card</label><input id="cc-holder" name="card.name" autocomplete="off" value="${esc(c?.name)}">
    <label for="cc-number">Card number ${c ? "(leave blank to use saved •••• " + esc(c.last4) + ")" : ""}</label>
    <input id="cc-number" name="card.number" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242">
    <div class="two"><div><label for="cc-exp-in">Expiry (MM/YY)</label><input id="cc-exp-in" name="card.exp" inputmode="numeric" autocomplete="off" placeholder="12/30" maxlength="5" value="${esc(c?.exp)}"></div>
    <div><label for="cc-cvc">CVC</label><input id="cc-cvc" name="card.cvc" inputmode="numeric" autocomplete="off" placeholder="123" maxlength="4"></div></div>
    <p class="muted">Made-up numbers only, please. Only the last 4 digits are kept, and nothing is ever sent anywhere.
    <a href="#" data-action="testcard">Fill a test card</a></p>`;
}
const val = (root, n) => (root.querySelector(`[name="${n}"]`)?.value ?? "").trim();
const readAddr = (root, p) => Object.fromEntries(Object.keys(emptyAddr).map(k => [k, val(root, `${p}.${k}`)]));

function mark(root, name, msg, errs) { errs.push([name, msg]); }
function checkAddr(root, p, a, errs) {
  if (!a.name) mark(root, `${p}.name`, "Required", errs);
  if (!a.line1) mark(root, `${p}.line1`, "Required", errs);
  if (!a.city) mark(root, `${p}.city`, "Required", errs);
  if (!a.state) mark(root, `${p}.state`, "Required", errs);
  if (!a.zip) mark(root, `${p}.zip`, "Required", errs);
  if (!a.country) mark(root, `${p}.country`, "Required", errs);
}
function readCard(root, errs, existing) {
  const name = val(root, "card.name"), digits = val(root, "card.number").replace(/[\s-]/g, ""), exp = val(root, "card.exp"), cvc = val(root, "card.cvc");
  if (!name) mark(root, "card.name", "Required", errs);
  let last4 = existing?.last4;
  if (digits || !existing) {
    if (!/^\d{13,19}$/.test(digits)) mark(root, "card.number", "Enter 13–19 digits (any made-up number works)", errs);
    else last4 = digits.slice(-4);
  }
  const m = /^(\d{2})\/(\d{2})$/.exec(exp);
  if (!m || +m[1] < 1 || +m[1] > 12) mark(root, "card.exp", "Use MM/YY", errs);
  else if (2000 + +m[2] < new Date().getFullYear() || (2000 + +m[2] === new Date().getFullYear() && +m[1] < new Date().getMonth() + 1)) mark(root, "card.exp", "Card expired", errs);
  if (!/^\d{3,4}$/.test(cvc) && !(existing && !digits && !cvc)) mark(root, "card.cvc", "3–4 digits", errs);
  const brand = /^4/.test(digits) ? "Visa" : /^5[1-5]/.test(digits) ? "Mastercard" : /^3[47]/.test(digits) ? "Amex" : existing?.brand || "Card";
  return { name, last4, exp, brand };
}
function showErrors(root, errs) {
  root.querySelectorAll(".err").forEach(e => e.remove());
  root.querySelectorAll(".bad").forEach(e => e.classList.remove("bad"));
  errs.forEach(([n, m]) => {
    const el = root.querySelector(`[name="${n}"]`); if (!el) return;
    el.classList.add("bad"); const d = document.createElement("div"); d.className = "err"; d.textContent = m; el.after(d);
  });
  if (errs.length) root.querySelector(".bad")?.focus();
}

// ---------- views ----------
let shopCat = "All", shopStore = "All", shopQ = "";
const cats = ["All", ...new Set(PRODUCTS.map(p => p.cat))];
const stores = ["All", ...new Set(PRODUCTS.map(p => p.store))];
function gridHtml() {
  const q = shopQ.toLowerCase();
  const list = PRODUCTS.filter(p => (shopCat === "All" || p.cat === shopCat) && (shopStore === "All" || p.store === shopStore) && (!q || (p.name + p.cat + p.store).toLowerCase().includes(q)));
  if (!list.length) return `<div class="empty"><div class="em">🔍</div><p>Nothing matches “${esc(shopQ)}”.</p></div>`;
  return `<div class="grid">${list.map(p => `<div class="card"><a href="#/product/${p.id}"><div class="thumb" style="background:${p.bg}">${p.emoji}</div>
    <div class="info"><div class="muted store">${esc(p.store)}</div><div class="name">${esc(p.name)}</div><div class="price">${money(p.price)}</div></div></a>
    <button class="btn sm" data-action="add" data-id="${p.id}">Add to cart</button></div>`).join("")}</div>`;
}
function shopView() {
  setTitle("Shop");
  view.innerHTML = `<input class="search" id="q" type="search" placeholder="Search products…" value="${esc(shopQ)}" aria-label="Search products">
    <div class="chips" aria-label="Stores">${stores.map(c => `<button class="chip ${c === shopStore ? "on" : ""}" data-action="store" data-store="${esc(c)}">${c === "All" ? "All stores" : esc(c)}</button>`).join("")}</div>
    <div class="chips" aria-label="Categories">${cats.map(c => `<button class="chip ${c === shopCat ? "on" : ""}" data-action="cat" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div id="grid">${gridHtml()}</div>`;
}
function productView(id) {
  const p = byId(id); if (!p) return location.hash = "#/";
  setTitle(p.name);
  view.innerHTML = `<div class="hero" style="background:${p.bg}">${p.emoji}</div>
    <div class="panel"><div class="muted">${esc(p.store)} · ${esc(p.cat)}</div><h2 class="big" style="margin:4px 0">${esc(p.name)}</h2>
    <div class="price big">${money(p.price)}</div><p>${esc(p.desc)}</p>
    <button class="btn" data-action="add" data-id="${p.id}">Add to cart</button>
    <button class="btn ghost" style="margin-top:8px" data-action="buynow" data-id="${p.id}">Buy now</button></div>`;
}
function summaryHtml() {
  const t = totals();
  return `<div class="row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="row"><span>Shipping</span><span>${t.ship ? money(t.ship) : "Free"}</span></div>
    <div class="row"><span>Tax (8%)</span><span>${money(t.tax)}</span></div>
    <div class="row"><b>Total</b><b class="price">${money(t.total)}</b></div>`;
}
function cartView() {
  setTitle("Your cart");
  const items = cartItems();
  if (!items.length) { view.innerHTML = `<div class="empty"><div class="em">🛒</div><p>Your cart is empty.</p><a class="btn" href="#/">Start browsing</a></div>`; return; }
  view.innerHTML = `<div class="panel">${items.map(i => `<div class="line"><div class="em" style="background:${i.p.bg}">${i.p.emoji}</div>
    <div class="grow"><div class="nm">${esc(i.p.name)}</div><div class="price">${money(i.p.price)}</div>
    <div class="qty"><button data-action="dec" data-id="${i.id}" aria-label="Decrease quantity">−</button><span>${i.qty}</span><button data-action="inc" data-id="${i.id}" aria-label="Increase quantity">+</button></div></div>
    <button class="icon-btn" style="color:inherit;font-size:20px" data-action="remove" data-id="${i.id}" aria-label="Remove ${esc(i.p.name)}">🗑️</button></div>`).join("")}</div>
    <div class="panel">${summaryHtml()}</div><a class="btn" href="#/checkout">Checkout</a>`;
}
function checkoutView() {
  if (!cartItems().length) return location.hash = "#/cart";
  setTitle("Checkout");
  const pr = state.profile;
  view.innerHTML = `<div class="fakebar">🎭 Pretend checkout — no real money moves, ever.</div>
    <form id="checkout" novalidate>
    <div class="panel"><h2>📮 Shipping address</h2>${addrForm("ship", pr.shipping)}</div>
    <div class="panel"><h2>🧾 Billing address</h2>
      <label class="check"><input type="checkbox" id="same" name="same" ${pr.billingSame ? "checked" : ""}> Same as shipping</label>
      <div id="billing" ${pr.billingSame ? "hidden" : ""}>${addrForm("bill", pr.billing)}</div></div>
    <div class="panel"><h2>💳 Payment (fake)</h2>${cardForm(pr.card)}</div>
    <div class="panel"><h2>Order summary</h2>${summaryHtml()}
      <label class="check"><input type="checkbox" name="remember" checked> Save address &amp; card for next time</label></div>
    <button class="btn" type="submit">Place pretend order</button></form>`;
}
function placeOrder(form) {
  const errs = [], pr = state.profile;
  const shipping = readAddr(form, "ship"); checkAddr(form, "ship", shipping, errs);
  const same = form.querySelector("#same").checked;
  const billing = same ? shipping : readAddr(form, "bill"); if (!same) checkAddr(form, "bill", billing, errs);
  const card = readCard(form, errs, pr.card);
  showErrors(form, errs);
  if (errs.length) return toast("Please fix the highlighted fields");
  const items = cartItems(), t = totals();
  const order = { id: "PP-" + Date.now().toString(36).toUpperCase(), date: new Date().toISOString(), total: t.total, shipping, billing,
    card: { brand: card.brand, last4: card.last4 }, items: items.map(i => ({ name: i.p.name, emoji: i.p.emoji, price: i.p.price, qty: i.qty })) };
  state.orders.unshift(order);
  if (form.querySelector('[name="remember"]').checked) state.profile = { shipping, billing, billingSame: same, card };
  state.cart = []; save();
  location.hash = "#/confirm/" + order.id;
}
function confirmView(id) {
  const o = state.orders.find(x => x.id === id); if (!o) return location.hash = "#/orders";
  setTitle("Order placed");
  view.innerHTML = `<div class="panel success"><div class="em">🎉</div><h2 class="big">Order confirmed!</h2>
    <p>Order <b>${esc(o.id)}</b> for <b>${money(o.total)}</b>.<br>You paid <b>$0.00</b> in real money. Enjoy the satisfaction.</p></div>
    ${orderCard(o)}<a class="btn" href="#/">Keep shopping</a>`;
  confetti();
}
const addrText = a => `${esc(a.name)}<br>${esc(a.line1)}${a.line2 ? ", " + esc(a.line2) : ""}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}<br>${esc(a.country)}`;
function orderCard(o) {
  return `<div class="panel"><div class="row"><b>${esc(o.id)}</b><span class="muted">${new Date(o.date).toLocaleDateString()}</span></div>
    ${o.items.map(i => `<div class="row"><span>${i.emoji} ${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
    <div class="row"><b>Total (pretend)</b><b class="price">${money(o.total)}</b></div><hr>
    <p class="muted"><b>Ships to</b><br>${addrText(o.shipping)}</p>
    <p class="muted"><b>Billed to</b><br>${addrText(o.billing)}</p>
    <p class="muted"><b>Paid with</b> ${esc(o.card.brand)} •••• ${esc(o.card.last4)}</p></div>`;
}
function ordersView() {
  setTitle("Orders");
  view.innerHTML = state.orders.length ? state.orders.map(orderCard).join("") + `<button class="btn danger" data-action="clearorders">Clear order history</button>`
    : `<div class="empty"><div class="em">📦</div><p>No orders yet. Go treat yourself!</p><a class="btn" href="#/">Browse</a></div>`;
}
function profileView() {
  setTitle("Profile");
  const pr = state.profile;
  view.innerHTML = `<form id="profile" novalidate><div class="fakebar">Saved on this device only.</div>
    <div class="panel"><h2>📮 Shipping address</h2>${addrForm("ship", pr.shipping)}</div>
    <div class="panel"><h2>🧾 Billing address</h2><label class="check"><input type="checkbox" id="same" ${pr.billingSame ? "checked" : ""}> Same as shipping</label>
      <div id="billing" ${pr.billingSame ? "hidden" : ""}>${addrForm("bill", pr.billing)}</div></div>
    <div class="panel"><h2>💳 Fake credit card</h2>${cardForm(pr.card)}</div>
    <button class="btn" type="submit">Save</button>
    <button class="btn danger" type="button" style="margin-top:8px" data-action="wipe">Erase all my data</button></form>`;
}
function saveProfile(form) {
  const errs = [], pr = state.profile;
  const shipping = readAddr(form, "ship"), same = form.querySelector("#same").checked;
  const billing = same ? shipping : readAddr(form, "bill");
  const anyAddr = Object.entries(shipping).some(([k, v]) => k !== "country" && v);
  if (anyAddr) checkAddr(form, "ship", shipping, errs);
  if (!same && Object.entries(billing).some(([k, v]) => k !== "country" && v)) checkAddr(form, "bill", billing, errs);
  const wantsCard = val(form, "card.number") || val(form, "card.name") || val(form, "card.exp") || val(form, "card.cvc") || pr.card;
  let card = pr.card;
  if (wantsCard) card = readCard(form, errs, pr.card);
  showErrors(form, errs);
  if (errs.length) return toast("Please fix the highlighted fields");
  state.profile = { shipping, billing, billingSame: same, card };
  save(); toast("Saved ✅"); profileView();
}

// ---------- misc ----------
function setTitle(t) { $("#title").textContent = t; document.title = t + " · PretendPay"; }
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("span"); s.className = "confetti"; s.textContent = ["🎉", "✨", "🎊", "💜", "🛍️"][i % 5];
    s.style.left = Math.random() * 100 + "vw"; s.style.animationDelay = Math.random() * 0.8 + "s";
    document.body.appendChild(s); setTimeout(() => s.remove(), 3600);
  }
}
function router() {
  const [, route = "", arg] = location.hash.replace(/^#/, "").split("/");
  const tab = { "": "shop", product: "shop", cart: "cart", checkout: "cart", orders: "orders", confirm: "orders", profile: "profile" }[route];
  document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
  ({ "": shopView, product: () => productView(arg), cart: cartView, checkout: checkoutView, orders: ordersView,
     confirm: () => confirmView(arg), profile: profileView }[route] || shopView)();
  scrollTo(0, 0);
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]"); if (!el) return;
  const id = Number(el.dataset.id), a = el.dataset.action, line = state.cart.find(i => i.id === id);
  e.preventDefault();
  if (a === "add") addToCart(id);
  else if (a === "buynow") { addToCart(id); location.hash = "#/checkout"; }
  else if (a === "store") { shopStore = el.dataset.store; shopView(); }
  else if (a === "cat") { shopCat = el.dataset.cat; shopView(); }
  else if (a === "inc" || a === "dec") { if (line) { line.qty += a === "inc" ? 1 : -1; if (line.qty < 1) state.cart = state.cart.filter(i => i !== line); save(); cartView(); } }
  else if (a === "remove") { state.cart = state.cart.filter(i => i.id !== id); save(); cartView(); }
  else if (a === "clearorders") { if (confirm("Clear your pretend order history?")) { state.orders = []; save(); ordersView(); } }
  else if (a === "wipe") { if (confirm("Erase saved addresses, card, cart and orders?")) { localStorage.removeItem(KEY); state = load(); save(); profileView(); toast("Erased"); } }
  else if (a === "testcard") {
    const f = el.closest("form"), set = (n, v) => { f.querySelector(`[name="${n}"]`).value = v; };
    set("card.name", val(f, "card.name") || "Pat Pretend"); set("card.number", "4242 4242 4242 4242"); set("card.exp", "12/34"); set("card.cvc", "123");
    f.querySelector("#cc-number").dispatchEvent(new Event("input", { bubbles: true }));
  }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "q") { shopQ = t.value; $("#grid").innerHTML = gridHtml(); }
  else if (t.id === "cc-number") {
    const d = t.value.replace(/\D/g, "").slice(0, 19); t.value = d.replace(/(.{4})/g, "$1 ").trim();
    $("#cc-preview").textContent = d ? d.padEnd(16, "•").replace(/(.{4})/g, "$1 ").trim() : "•••• •••• •••• ••••";
  } else if (t.id === "cc-exp-in") {
    let d = t.value.replace(/\D/g, "").slice(0, 4); if (d.length > 2) d = d.slice(0, 2) + "/" + d.slice(2);
    t.value = d; $("#cc-exp").textContent = d || "MM/YY";
  } else if (t.id === "cc-holder") $("#cc-name").textContent = t.value.toUpperCase() || "YOUR NAME";
});
document.addEventListener("change", e => { if (e.target.id === "same") $("#billing").hidden = e.target.checked; });
document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "checkout") placeOrder(e.target); else if (e.target.id === "profile") saveProfile(e.target);
});
$("#cart-btn").addEventListener("click", () => (location.hash = "#/cart"));
addEventListener("hashchange", router);
updateBadge(); router();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
