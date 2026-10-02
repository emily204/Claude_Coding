"use strict";
/* Password gate. Compares a PBKDF2 hash made at deploy time (gate-config.js). This is a front door for casual visitors,
   not strong security: everything runs in the browser. Use a long passphrase. */
(function () {
  const REMEMBER = "pretendpay.unlock", DAYS = 30;
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  const fromHex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
  const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);

  async function derive(pw) {
    const g = window.GATE;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(g.salt), iterations: g.iters }, key, 256));
  }
  function same(a, b) { let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return d === 0; }
  const remembered = () => { try { const r = JSON.parse(localStorage.getItem(REMEMBER)); return r && window.GATE && r.h === window.GATE.hash && r.exp > Date.now(); } catch (e) { return false; } };

  window.lockShop = () => { try { localStorage.removeItem(REMEMBER); } catch (e) {} location.reload(); };
  window.gateEnabled = () => !!window.GATE;

  window.requireGate = function (start) {
    if (!window.GATE) {
      if (local) return start();                    // local dev without a deploy-time config
      return show("This shop can't load its lock right now. Check your connection and reload.", false);
    }
    if (remembered()) return start();
    show("Enter the password to come in", true, start);
  };

  function show(msg, form, start) {
    document.body.classList.add("locked");
    const el = document.createElement("div");
    el.className = "gate";
    el.innerHTML = `<form class="gate-box" novalidate><div class="gate-em">🛍️</div><h2>PretendPay Shop</h2><p class="muted"></p>
      ${form ? `<input type="password" name="pw" autocomplete="current-password" placeholder="Password" aria-label="Password" autofocus>
      <button class="btn" type="submit">Enter</button><div class="err" role="alert" hidden></div>` : ""}</form>`;
    el.querySelector("p").textContent = msg;
    document.body.appendChild(el);
    if (!form) return;
    const f = el.querySelector("form"), input = f.pw, err = f.querySelector(".err"), btn = f.querySelector("button");
    let fails = 0;
    f.addEventListener("submit", async e => {
      e.preventDefault();
      if (!input.value) return;
      btn.disabled = true;
      let ok = false;
      try { ok = same(await derive(input.value), window.GATE.hash); } catch (x) { err.textContent = "This browser can't check the password (needs https)."; err.hidden = false; btn.disabled = false; return; }
      if (ok) {
        try { localStorage.setItem(REMEMBER, JSON.stringify({ h: window.GATE.hash, exp: Date.now() + DAYS * 864e5 })); } catch (x) {}
        document.body.classList.remove("locked"); el.remove(); start();
      } else {
        fails++; err.textContent = "Wrong password."; err.hidden = false; input.value = ""; input.focus();
        await new Promise(r => setTimeout(r, Math.min(fails, 6) * 1000));   // slow down guessing
        btn.disabled = false;
      }
    });
  }
})();
