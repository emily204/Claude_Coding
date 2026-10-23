// Shared by the live shop and the command-line importer.
import {shopCategory,removedStore} from './shop-categories.mjs';
const EMOJI = [[/skin|serum|cream|toner|mask|cleans|essence|sunscreen|lip/i, "🧴"], [/album|cd\b|photocard|lightstick|k-?pop/i, "💿"],
  [/shoe|sneaker|boot|sandal|heel|loafer/i, "👟"], [/bag|tote|purse|wallet/i, "👜"], [/dress|skirt/i, "👗"], [/jacket|coat|blazer/i, "🧥"],
  [/jean|pant|trouser|legging|short/i, "👖"], [/shirt|top|tee|sweater|hoodie|knit/i, "👚"], [/phone|laptop|tv|camera|headphone|watch/i, "📱"]];
const BG = ["#fde68a", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#bbf7d0", "#fed7aa", "#c7d2fe", "#fecaca", "#bae6fd", "#e7d5c3"];
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clean = (v, n) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const https = u => { try { const x = new URL(u); return x.protocol === "https:" ? x.toString() : ""; } catch { return ""; } };


export function convertCatalog(data, {perStore = Infinity, withImages = false, rates = {USD: 1}} = {}) {
  if (data?.schema_version !== 1 || !Array.isArray(data.products)) throw Error("Invalid catalog schema");
const seen = new Set(), counts = {}, skipped = { noPrice: 0, noTitle: 0, currency: 0, outOfStock: 0, extra: 0, removedStore: 0 };
const out = [];
for (const p of data.products) {
  if(removedStore(p)){skipped.removedStore++;continue;}
  const title = clean(p.title, 90);
  if (!title) { skipped.noTitle++; continue; }
  if (p.availability === "OutOfStock") { skipped.outOfStock++; continue; }
  const cur = String(p.currency || "").toUpperCase(), rate = rates[cur];
  if (!rate) { skipped.currency++; continue; }
  const raw = Number(p.price);
  if (!Number.isFinite(raw) || raw <= 0) { skipped.noPrice++; continue; }
  const store = clean(p.retailer, 40) || "Other";
  if ((counts[store] = (counts[store] || 0) + 1) > perStore) { skipped.extra++; continue; }
  const id = hash(p.id || p.url || title) % 2000000000 + 1000;
  if (seen.has(id)) continue; seen.add(id);
  const group = shopCategory({...p,retailer:store});
  const text = title + " " + clean(p.category, 80);
  const item = { id, name: title, store, cat: group, price: Math.round(raw * rate * 100) / 100,
    emoji: (EMOJI.find(([re]) => re.test(text)) || [0, "🛍️"])[1], bg: BG[id % BG.length], desc: clean(p.description, 220) || title };
  if (withImages) { const img = (Array.isArray(p.images) ? p.images : []).map(https).find(Boolean); if (img) item.img = img; }
  out.push(item);
}

out.sort((a,b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name));
return {products: out, skipped};
}
