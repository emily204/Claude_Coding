// Shared by the live shop and the command-line importer.
const STORE_GROUP = { Zara: "Fashion", Taobao: "Fashion", Nordstrom: "Fashion", DSW: "Fashion", ALO: "Fashion", POPFLEX: "Fashion",
  "Charles & Keith": "Fashion", "A-Kpop": "K-pop", Cokodive: "K-pop", Sephora: "Skincare", "Olive Young": "Skincare", "Best Buy": "Tech", Jellycat: "Plush & gifts", Cider: "Fashion",
  "Calvin Klein": "Fashion", "Banana Republic": "Fashion", Cuyana: "Fashion", "Maui Divers Jewelry": "Fashion", "The Only Nails": "Skincare", Byredo: "Skincare" };
// Group an item by its own category (store wording varies a lot), then by its name for stores that publish
// no usable category, and finally by the store's usual group.
const RULES = [
  [/skin ?care|face masks?|suncare|bath & body|body ?care|hand care|make ?up|fragrance|perfumes?|\bnails?\b|^(hair|hair ?care|wellness|beauty|skin|lips|eyes|cleansers?|toner\/essence)$/, "Skincare"],
  [/plush|gift ?(box|boxes|card)|giftcard|^service$|hobby\/pet|snack/, "Plush & gifts"],
  [/\b(home|candles?|towels?|yoga mats?|home deco|decor)\b/, "Home"],
  [/laptops?|headphones?/, "Tech"],
  [/\b(bras?|sports bras?|leggings?|shorts?|pants?|jackets?|coats?|vests?|tanks?|tees?|t-shirts?|shirts?|tops?|sweaters?|sweatshirts?|sweatpants|hoodies?|pullovers?|skirts?|skorts?|sklegging|dress(es)?|onesies?|one piece|jeans?|swim(wear)?|bikini|panty|underwear|undergarments|socks?|sleepwear|homewear|crops?|shrug|outerwear|activewear|apparel|clothing|lounge|bottoms?|trousers?|blazers?|boots?|shoes?|sneakers?|flats|slides|pumps|loafers|sandals|heels|cover ?ups?|matching set|knit|cardigan|bodysuit)\b/, "Fashion"],
  [/\b(bags?|totes?|crossbody|wallets?|small leather goods|small goods|jewelry|earrings?|rings?|necklaces?|bracelets?|chains?|charms?|pendants?|pearl|belts?|hats?|caps?|visors?|beanies|scarves|mufflers?|headwear|sunglasses|watch(es)?|accessor(y|ies)|headbands?|hair ties|hair management|gloves|pouch)\b/, "Accessories"],
];
const hit = s => (RULES.find(([re]) => re.test(s)) || [])[1];
// Product names mix many words, so clothing and accessory words outrank the rest ("Towel Terry Sweatshirt" is clothing).
const TITLE_ORDER = [4, 5, 0, 2, 1, 3].map(i => RULES[i]);
const hitTitle = s => (TITLE_ORDER.find(([re]) => re.test(s)) || [])[1];
const TITLE_OK = new Set(["Charles & Keith", "DSW", "Zara", "Calvin Klein", "Banana Republic", "Cuyana", "ALO", "POPFLEX", "Maui Divers Jewelry", "Byredo"]);
function groupFor(store, category, title) {
  const segs = String(category || "").toLowerCase().split(/\s*[_:>·|]\s*/).map(x => x.trim()).filter(Boolean);
  const first = segs[0] || "";
  if (/^k-(pop|stationery|merch)/.test(first)) return "K-pop";
  if (first === "k-beauty") return "Skincare";
  if (first === "k-food") return "Plush & gifts";
  if (first === "k-fashion") return segs.slice(1).reduceRight((g, x) => g || hit(x), "") || "Fashion";
  for (let i = segs.length - 1; i >= 0; i--) { const g = hit(segs[i]); if (g) return g; }
  if (TITLE_OK.has(store)) { const g = hitTitle(String(title).toLowerCase()); if (g) return g; }
  return STORE_GROUP[store] || "Other";
}
const EMOJI = [[/skin|serum|cream|toner|mask|cleans|essence|sunscreen|lip/i, "🧴"], [/album|cd\b|photocard|lightstick|k-?pop/i, "💿"],
  [/shoe|sneaker|boot|sandal|heel|loafer/i, "👟"], [/bag|tote|purse|wallet/i, "👜"], [/dress|skirt/i, "👗"], [/jacket|coat|blazer/i, "🧥"],
  [/jean|pant|trouser|legging|short/i, "👖"], [/shirt|top|tee|sweater|hoodie|knit/i, "👚"], [/phone|laptop|tv|camera|headphone|watch/i, "📱"]];
const BG = ["#fde68a", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#bbf7d0", "#fed7aa", "#c7d2fe", "#fecaca", "#bae6fd", "#e7d5c3"];
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clean = (v, n) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const https = u => { try { const x = new URL(u); return x.protocol === "https:" ? x.toString() : ""; } catch { return ""; } };


export function convertCatalog(data, {perStore = Infinity, withImages = false, rates = {USD: 1}} = {}) {
  if (data?.schema_version !== 1 || !Array.isArray(data.products)) throw Error("Invalid catalog schema");
const seen = new Set(), counts = {}, skipped = { noPrice: 0, noTitle: 0, currency: 0, outOfStock: 0, extra: 0 };
const out = [];
for (const p of data.products) {
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
  const group = groupFor(store, clean(p.category, 120), title);
  const text = title + " " + clean(p.category, 80);
  const item = { id, name: title, store, cat: group, price: Math.round(raw * rate * 100) / 100,
    emoji: (EMOJI.find(([re]) => re.test(text)) || [0, "🛍️"])[1], bg: BG[id % BG.length], desc: clean(p.description, 220) || title };
  if (withImages) { const img = (Array.isArray(p.images) ? p.images : []).map(https).find(Boolean); if (img) item.img = img; }
  out.push(item);
}

out.sort((a,b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name));
return {products: out, skipped};
}
