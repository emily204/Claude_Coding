import {bananaRepublicUrl,parseBananaRepublic,type BananaCursor} from './bananarepublic-catalog.ts';
export async function bananaRepublicPage(previous: string | null) {
 const cursor: BananaCursor | null = previous ? JSON.parse(previous) : null;
 const refresh=cursor?.refresh || crypto.randomUUID();
 const response=await fetch(bananaRepublicUrl(cursor?.page || 1,refresh),{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json','User-Agent':'MerchCurator/1.0 (catalog importer)'}});
 if(!response.ok)throw Error('Banana Republic returned HTTP '+response.status+'. Previous snapshot kept.');
 if(!/application\/json/.test(response.headers.get('Content-Type')||''))throw Error('Banana Republic did not return JSON.');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty Banana Republic response.');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>8000000){await reader.cancel();throw Error('Banana Republic response too large.');}chunks.push(next.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const result=parseBananaRepublic(JSON.parse(new TextDecoder().decode(bytes)),cursor?.page || 1,cursor);
 return {...result,cursor:JSON.stringify({...JSON.parse(result.cursor),refresh})};
}
