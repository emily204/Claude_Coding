import {readFile,writeFile} from 'node:fs/promises';
export function catalogStatus(data){
 if(data?.schema_version!==1||!Array.isArray(data.products)||data.exported_at!==null&&(typeof data.exported_at!=='string'||!Number.isFinite(Date.parse(data.exported_at))))throw Error('Invalid published catalog metadata.');
 return {schema_version:1,exported_at:data.exported_at,count:data.products.length};
}
if(process.argv[1] && import.meta.url===new URL(process.argv[1],'file:').href){
 const directory=new URL('../fakeshop/data/',import.meta.url);
 const data=JSON.parse(await readFile(new URL('catalog.json',directory),'utf8'));
 await writeFile(new URL('catalog-status.json',directory),JSON.stringify(catalogStatus(data))+'\n');
}
