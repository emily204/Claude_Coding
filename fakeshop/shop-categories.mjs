// Shared verbatim between the curator and Atelier Emi.
export const STORE_GROUP = { Zara: "Fashion", Taobao: "Fashion", DSW: "Fashion", ALO: "Fashion", POPFLEX: "Fashion",
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
export const SHOP_CATEGORIES=['Fashion','K-pop','Skincare','Tech','Plush & gifts','Accessories','Home','Other'];
export function validShopCategory(value){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=80&&!/[\u0000-\u001f\u007f]/.test(value);}
export function shopCategory(p){return validShopCategory(p.shop_category)?p.shop_category.trim():groupFor(String(p.retailer||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,40),String(p.category||'').slice(0,120),String(p.title||'').slice(0,90));}
export function removedStore(p){return String(p.retailer||p.store||'').trim().toLowerCase()==='nordstrom';}
