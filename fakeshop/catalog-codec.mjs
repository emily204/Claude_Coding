// Shared verbatim with Claude_Coding/fakeshop/catalog-codec.mjs.
export const MAX_CATALOG_BYTES=64*1024*1024;
export const MAX_PACKED_BYTES=9*1024*1024;
const encoder=new TextEncoder();
async function readBounded(stream,limit){
 const reader=stream.getReader(),chunks=[];let size=0;
 while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit){await reader.cancel();throw Error('Catalog exceeds the supported size.');}chunks.push(next.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function base64(bytes){let text='';for(let offset=0;offset<bytes.length;offset+=32768)text+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(text);}
export async function encodeCatalog(data){
 if(data?.schema_version!==1||!Array.isArray(data.products))throw Error('Invalid catalog schema.');
 const json=JSON.stringify(data),bytes=encoder.encode(json);
 if(bytes.length>MAX_CATALOG_BYTES)throw Error('The shop feed exceeds the 64 MB expanded catalog limit. Saved curator products were kept.');
 if(bytes.length<750000)return json+'\n';
 const compressed=await readBounded(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_PACKED_BYTES);
 return JSON.stringify({schema_version:1,encoding:'gzip-base64',exported_at:data.exported_at,count:data.products.length,data:base64(compressed)})+'\n';
}
export async function decodeCatalog(data){
 if(data?.encoding===undefined){if(data?.schema_version!==1||!Array.isArray(data.products))throw Error('Invalid catalog schema.');return data;}
 if(data.schema_version!==1||data.encoding!=='gzip-base64'||typeof data.data!=='string'||data.data.length>Math.ceil(MAX_PACKED_BYTES/3)*4||!Number.isInteger(data.count)||data.count<0||typeof data.exported_at!=='string'||!Number.isFinite(Date.parse(data.exported_at)))throw Error('Invalid compressed catalog.');
 const packed=Uint8Array.from(atob(data.data),char=>char.charCodeAt(0));
 const bytes=await readBounded(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_CATALOG_BYTES);
 const expanded=JSON.parse(new TextDecoder().decode(bytes));
 if(expanded?.schema_version!==1||!Array.isArray(expanded.products)||expanded.products.length!==data.count||expanded.exported_at!==data.exported_at||expanded.encoding!==undefined)throw Error('Compressed catalog metadata does not match its contents.');
 return expanded;
}
