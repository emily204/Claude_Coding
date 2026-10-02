// Run at deploy time: turns the SHOP_PASSWORD secret into a salted PBKDF2 hash in fakeshop/gate-config.js.
// The password itself is never written to the repo or the site.
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const pw = process.env.SHOP_PASSWORD ?? "";
if (pw.length < 8) {
  console.error("SHOP_PASSWORD secret is missing or shorter than 8 characters. Add it under Settings > Secrets and variables > Actions.");
  process.exit(1);
}
const iters = 210000, salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(pw, Buffer.from(salt, "hex"), iters, 32, "sha256").toString("hex");
writeFileSync(new URL("../fakeshop/gate-config.js", import.meta.url), `window.GATE = ${JSON.stringify({ salt, iters, hash })};\n`);
console.log("gate-config.js written");
