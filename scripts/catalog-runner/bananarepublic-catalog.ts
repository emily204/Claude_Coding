import {clean} from './calvinklein-http.ts';
type Color = {ccId?: string; ccName?: string; effectivePrice?: string; inventoryStatus?: string; images?: {type?: string; path?: string}[]};
type Style = {styleId?: string; styleName?: string; webProductType?: string; styleColors?: Color[]};
type Feed = {locale?: string; pagination?: {pageSize?: string; currentPage?: string; pageNumberTotal?: string}; totalColors?: string; products?: Style[]};
export type BananaCursor = {page: number; totalPages: number; total: number; seen: string[]; refresh?: string};
export function bananaRepublicUrl(page: number, refresh?: string) {
 const url = new URL('https://api.gap.com/v2/product_search_cc_aggregations/v2');
 for (const [key,value] of Object.entries({pageSize:'200',pageNumber:String(page-1),ignoreInventory:'false',cid:'1158705',vendor:'constructorio',client_id:'0',session_id:'0',includeMarketingFlagsDetails:'true',enableDynamicPhoto:'true',brand:'br',locale:'en_US',market:'us',department:'136'})) url.searchParams.set(key,value);
 if (refresh) url.searchParams.set('merch_refresh',refresh);
 return url.href;
}
export function parseBananaRepublic(data: Feed, page: number, previous: BananaCursor | null) {
 const totalPages = Number(data.pagination?.pageNumberTotal), total = Number(data.totalColors);
 if (previous && (previous.totalPages !== totalPages || previous.total !== total)) throw Error('Banana Republic’s catalog changed during this refresh. Retry Refresh store to collect a consistent catalog. Saved products were kept.');
 if (data.locale !== 'en_US' || Number(data.pagination?.pageSize) !== 200 || Number(data.pagination?.currentPage) !== page-1 || !Number.isInteger(totalPages) || totalPages < page || totalPages > 500 || !Number.isInteger(total) || total < 1 || previous && (previous.page !== page || previous.totalPages !== totalPages || previous.total !== total) || !Array.isArray(data.products) || !data.products.length || data.products.length > 1000) throw Error('Banana Republic returned an incomplete or changed US catalog page. Saved products were kept.');
 const all = data.products.flatMap(style => {
  if (!/^\d+$/.test(style.styleId || '') || !clean(style.styleName) || !Array.isArray(style.styleColors) || !style.styleColors.length) throw Error('Banana Republic returned an invalid style.');
  return style.styleColors.map(color => {
   if (!/^\d+$/.test(color.ccId || '') || !/^\d+(?:\.\d+)?$/.test(color.effectivePrice || '') || !Number.isFinite(Number(color.effectivePrice))) throw Error('Banana Republic returned an invalid product or price.');
   const images = [...new Set((color.images || []).filter(image => /^(P01|AV\d+)$/.test(image.type || '')).flatMap(image => {
    try { const path = (image.path || '').replace(/^\//,''); if (!/^webcontent\/[a-z0-9/_.-]+$/i.test(path) || path.includes('..')) return []; return [new URL('/'+path,'https://bananarepublic.gap.com').href]; } catch { return []; }
   }))].slice(0,40);
   return {id:'bananarepublic:'+color.ccId,retailer:'Banana Republic',url:'https://bananarepublic.gap.com/browse/product.do?pid='+color.ccId,title:clean(style.styleName)+(clean(color.ccName)?' — '+clean(color.ccName):''),brand:'Banana Republic',category:clean(style.webProductType),description:'',price:Number(color.effectivePrice),price_max:Number(color.effectivePrice),currency:'USD',images,variants:[],availability:color.inventoryStatus === 'In Stock' ? 'InStock' : color.inventoryStatus === 'Out of Stock' ? 'OutOfStock' : 'Unknown',sku:color.ccId || '',fetched_at:new Date().toISOString(),method:'Public US women’s catalog',warnings:['USD from the configured US market. Color records include related colors; size-level stock and cart promotions are not included.']};
  });
 });
 const seen = new Set(previous?.seen || []);
 const products = all.filter(product => {if (seen.has(product.id)) return false; seen.add(product.id); return true;});
 if (!products.length) throw Error('Banana Republic repeated a catalog page. Saved products were kept.');
 return {products,done:page === totalPages,cursor:JSON.stringify({page:page+1,totalPages,total,seen:[...seen]})};
}
