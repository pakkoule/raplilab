/* Shared helpers for user-supplied jersey lettering fonts.
 * No third-party font downloads, network fetch or auto-publication. */
(function(root){
 'use strict';
 const MAX_BYTES=5*1024*1024;
 const MIME=Object.freeze({woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf'});
 const format=value=>Object.hasOwn(MIME,String(value||'').toLowerCase())?String(value).toLowerCase():'';
 const safeData=value=>typeof value==='string'&&
   /^data:font\/(woff2|woff|ttf|otf);base64,[a-z0-9+/=]+$/i.test(value) &&
   value.length<=Math.ceil(MAX_BYTES*4/3)+100;
 const formatOfName=name=>format(String(name||'').split('.').at(-1));
 function validHeader(bytes,ext) {
   if(!bytes||bytes.byteLength<4)return false;
   const b=new Uint8Array(bytes,0,4);
   const value=String.fromCharCode(...b);
   if(ext==='woff')return value==='wOFF';
   if(ext==='woff2')return value==='wOF2';
   if(ext==='otf')return value==='OTTO';
   return ext==='ttf'&&(
     (b[0]===0&&b[1]===1&&b[2]===0&&b[3]===0)||value==='true');
 }
 function bufferToBase64(buffer) {
   const bytes=new Uint8Array(buffer),parts=[];
   for(let offset=0;offset<bytes.length;offset+=8192){
     parts.push(String.fromCharCode(...bytes.subarray(offset,offset+8192)));
   }
   if(typeof btoa!=='function')throw Error('L’encodage de fichiers de police est indisponible.');
   return btoa(parts.join(''));
 }
 async function importFile(file) {
   if(!file||!file.name)throw Error('Choisis un fichier de police.');
   const ext=formatOfName(file.name);
   if(!ext)throw Error('Formats pris en charge : WOFF2, WOFF, TTF, OTF.');
   if(!Number.isFinite(file.size)||file.size<12||file.size>MAX_BYTES)
     throw Error('Le fichier de police doit faire moins de 5 Mo.');
   const bytes=await file.arrayBuffer();
   if(!validHeader(bytes,ext))
     throw Error('Ce fichier ne contient pas une police '+ext.toUpperCase()+' valide.');
   const content='data:'+MIME[ext]+';base64,'+bufferToBase64(bytes);
   if(!safeData(content))throw Error('Fichier de police invalide ou trop volumineux.');
   return {format:ext,data:content,size:file.size,fileName:String(file.name).slice(0,140)};
 }
 const safeRecord=row=>row?.type==='jersey-font'&&
   typeof row.id==='string'&&row.id.startsWith('jersey-font:')&&row.id.length<=180&&
   typeof row.name==='string'&&row.name.trim().length>0&&row.name.length<=100&&
   format(row.format);
 const fonts=logos=>(Array.isArray(logos)?logos:[])
   .filter(safeRecord)
   .sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
 const metadata=logos=>fonts(logos).map(row=>({
   id:row.id,name:row.name,format:format(row.format),
   fileName:String(row.fileName||'').slice(0,140),size:Number(row.size)||0,updatedAt:Number(row.updatedAt)||0
 }));
 const find=(logos,id)=>fonts(logos).find(row=>row.id===id)||null;
 const previewText=(name,number)=>{
   const safeName=String(name??'').trim().slice(0,40)||'JOUEUR';
   const safeNumber=String(number??'').trim().slice(0,3)||'10';
   return safeName+' '+safeNumber;
 };
 const api=Object.freeze({MAX_BYTES,MIME,format,formatOfName,validHeader,importFile,safeData,safeRecord,fonts,metadata,find,previewText});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.RapliJerseyFonts=api;
})(typeof window!=='undefined'?window:null);
