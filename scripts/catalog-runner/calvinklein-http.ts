// Node equivalent of curator importer helpers, restricted to the CK US origin.
export function clean(value: unknown) {
 return String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n) => {const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/\s+/g,' ').trim().slice(0,12000);
}
export async function fetchPage(url: string, accept: string, signal: AbortSignal) {
 let current = url;
 for (let i=0;i<4;i++) {
  const u=new URL(current);if(u.origin!=='https://www.calvinklein.us'||u.username||u.password)throw Error('Invalid Calvin Klein source URL.');
  const response=await fetch(u,{redirect:'manual',signal,headers:{Accept:accept,'User-Agent':'MerchCurator/1.0 (product metadata importer)'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw Error('Missing redirect location.');current=new URL(location,u).href;continue;}
  if(!response.ok)throw Error('Calvin Klein returned HTTP '+response.status+'. Previous snapshot kept.');
  if(!/text\/html|application\/xhtml\+xml/.test(response.headers.get('Content-Type')||''))throw Error('Calvin Klein did not return HTML.');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty Calvin Klein response.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>3000000){await reader.cancel();throw Error('Calvin Klein page is too large.');}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return {text:new TextDecoder().decode(bytes),url:u.href};
 }
 throw Error('Too many Calvin Klein redirects.');
}
