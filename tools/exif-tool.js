/* RAPLI TOOLS V2.9 · EXIF inspecteur / nettoyage local sans réencodage par défaut.
   JPEG : retire APP1 (EXIF/XMP), APP13 (IPTC), COM.
   PNG : retire eXIf, tEXt, zTXt, iTXt, tIME.
   WebP : retire EXIF/XMP et remet à jour les drapeaux VP8X.
   Les profils ICC, les pixels compressés et les données de décodage sont conservés.
*/
(() => {
'use strict';
const MAX_BYTES=100*1024*1024;
const td=new TextDecoder('latin1');
const utf8=new TextEncoder();
const be16=(b,p)=> (b[p]*256+b[p+1])>>>0;
const be32=(b,p)=> ((b[p]*16777216)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0;
const le32=(b,p)=> (b[p]+(b[p+1]<<8)+(b[p+2]<<16)+(b[p+3]*16777216))>>>0;
function ascii(b,p,n){return td.decode(b.subarray(p,Math.min(b.length,p+n)));}
function join(chunks,size){const out=new Uint8Array(size??chunks.reduce((s,c)=>s+c.length,0));let pos=0;for(const c of chunks){out.set(c,pos);pos+=c.length;}return out;}
function writeLE32(b,p,v){b[p]=v&255;b[p+1]=(v>>>8)&255;b[p+2]=(v>>>16)&255;b[p+3]=(v>>>24)&255;}
function formatOf(b){
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'jpeg';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>v===b[i]))return 'png';
 if(b.length>=12&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP')return 'webp';
 throw Error('Format non pris en charge : utilisez JPG, PNG ou WebP.');
}
const names={
 '0100':'Largeur EXIF','0101':'Hauteur EXIF','010e':'Description','010f':'Fabricant','0110':'Appareil photo','0112':'Orientation','011a':'Résolution horizontale','011b':'Résolution verticale','0128':'Unité de résolution','0131':'Logiciel','0132':'Date du fichier','013b':'Auteur','0213':'Positionnement YCbCr','8298':'Droits / copyright','8769':'Sous-répertoire EXIF','8825':'Sous-répertoire GPS',
 '829a':'Vitesse d’obturation','829d':'Ouverture f/','8822':'Programme d’exposition','8827':'Sensibilité ISO','8830':'Type de sensibilité','9000':'Version EXIF','9003':'Date de prise de vue','9004':'Date de numérisation','9010':'Décalage horaire','9011':'Décalage horaire prise de vue','9012':'Décalage horaire numérisation','9101':'Configuration des canaux','9102':'Bits compressés par pixel','9201':'Vitesse d’obturation APEX','9202':'Ouverture APEX','9204':'Correction d’exposition','9205':'Ouverture maximale','9207':'Mode de mesure','9208':'Source lumineuse','9209':'Flash','920a':'Focale','9214':'Zone du sujet','927c':'Notes fabricant','9286':'Commentaire utilisateur','a000':'Version FlashPix','a001':'Espace de couleur','a002':'Largeur des pixels','a003':'Hauteur des pixels','a005':'Interopérabilité','a20e':'Résolution plan focal X','a20f':'Résolution plan focal Y','a210':'Unité de résolution focale','a217':'Type de capteur','a300':'Origine du fichier','a301':'Type de scène','a401':'Rendu personnalisé','a402':'Mode d’exposition','a403':'Balance des blancs','a404':'Zoom numérique','a405':'Focale équivalente 35 mm','a406':'Type de capture','a407':'Type de scène','a408':'Contraste','a409':'Saturation','a40a':'Netteté','a420':'Identifiant image','a430':'Propriétaire','a431':'Numéro de série boîtier','a432':'Informations objectif','a433':'Fabricant de l’objectif','a434':'Modèle de l’objectif','a435':'Numéro de série objectif'
};
const gpsNames={'0000':'Version GPS','0001':'Latitude N/S','0002':'Latitude','0003':'Longitude E/O','0004':'Longitude','0005':'Référence altitude','0006':'Altitude GPS','0007':'Heure GPS','0008':'Satellites','0009':'Statut GPS','000a':'Mode de mesure GPS','000b':'Précision GPS','000c':'Unité vitesse','000d':'Vitesse GPS','000e':'Référence direction','000f':'Direction GPS','0010':'Référence direction photo','0011':'Direction photo','0012':'Datum géodésique','0013':'Destination latitude ref','0014':'Destination latitude','0015':'Destination longitude ref','0016':'Destination longitude','001d':'Date GPS','001f':'Erreur de positionnement'};
const typeSizes={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,13:4};
function decodeExif(b,offset,end){
 const tags=[], raw={}, places={};
 if(ascii(b,offset,6)==='Exif\0\0')offset+=6;
 if(offset+8>end)throw Error('En-tête EXIF tronqué.');
 const byteOrder=ascii(b,offset,2);if(byteOrder!=='II'&&byteOrder!=='MM')throw Error('Format TIFF EXIF invalide.');
 const little=byteOrder==='II',dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const u16=p=>{if(p<offset||p+2>end)throw Error('EXIF tronqué');return dv.getUint16(p,little);};
 const u32=p=>{if(p<offset||p+4>end)throw Error('EXIF tronqué');return dv.getUint32(p,little);};
 if(u16(offset+2)!==42)throw Error('Signature TIFF absente.');
 const seen=new Set();
 function readValue(type,n,at,bytes){
   if(type===2){return ascii(b,at,Math.min(n,1000)).replace(/\0.*$/s,'').trim();}
   if(type===7){if(n===4)return ascii(b,at,4).replace(/\0/g,'');return 'Données binaires ('+n+' octets)';}
   const values=[];let count=Math.min(n,50);
   for(let j=0;j<count;j++){
    const p=at+j*(typeSizes[type]||1);let v;
    if(type===1)v=b[p];
    else if(type===6)v=dv.getInt8(p);
    else if(type===3)v=dv.getUint16(p,little);
    else if(type===8)v=dv.getInt16(p,little);
    else if(type===4||type===13)v=dv.getUint32(p,little);
    else if(type===9)v=dv.getInt32(p,little);
    else if(type===5||type===10){const numerator=type===5?dv.getUint32(p,little):dv.getInt32(p,little),denominator=type===5?dv.getUint32(p+4,little):dv.getInt32(p+4,little);v=denominator?numerator/denominator:null;}
    else if(type===11)v=dv.getFloat32(p,little);
    else if(type===12)v=dv.getFloat64(p,little);
    else v=null;
    values.push(typeof v==='number'&&Number.isFinite(v)?Math.round(v*1e6)/1e6:v);
   }
   return n===1?values[0]:values;
 }
 function sectionTags(relative,section,depth=0){
  if(depth>4||!relative||tags.length>600)return;
  const key=section+':'+relative;if(seen.has(key))return;seen.add(key);
  const at=offset+relative;if(at<offset||at+2>end)return;
  let count;try{count=u16(at);}catch{return;}
  count=Math.min(count,190);
  for(let i=0;i<count;i++){
   const p=at+2+i*12;if(p+12>end)break;
   try{
    const tag=u16(p),type=u16(p+2),n=u32(p+4),unit=typeSizes[type];if(!unit||n>300000||!n)continue;
    const bytes=n*unit;if(bytes>400000||!Number.isSafeInteger(bytes))continue;
    const valuePos=bytes<=4?p+8:offset+u32(p+8);
    if(valuePos<offset||valuePos+bytes>end)continue;
    if(tag===0x8769||tag===0x8825||tag===0xa005){sectionTags(u32(p+8),tag===0x8769?'EXIF':tag===0x8825?'GPS':'Interopérabilité',depth+1);continue;}
    const value=readValue(type,n,valuePos,bytes);const id=tag.toString(16).padStart(4,'0'),name=(section==='GPS'?gpsNames:names)[id]||'Champ 0x'+id.toUpperCase();
    tags.push({group:section,name,id,value});
    if(section==='GPS')places[id]=value;
    if(section==='IFD0'||section==='EXIF')raw[id]=value;
   }catch{}
  }
  if(section==='IFD0'){
   const after=at+2+u16(at)*12;
   if(after+4<=end){const second=u32(after);if(second)sectionTags(second,'IFD1',1);}
  }
 }
 sectionTags(u32(offset+4),'IFD0');
 function gpsDecimal(v,ref){if(!Array.isArray(v)||v.length<2)return null;const n=Number(v[0])+Number(v[1])/60+Number(v[2]||0)/3600;if(!Number.isFinite(n))return null;return ['S','W'].includes(String(ref).trim().toUpperCase())?-n:n;}
 const lat=gpsDecimal(places['0002'],places['0001']),lon=gpsDecimal(places['0004'],places['0003']);
 const geo=lat!==null&&lon!==null?{lat,lon}:null;
 const val=k=>raw[k]??null;
 const overview={make:val('010f'),model:val('0110'),lens:val('a434'),date:val('9003')||val('0132'),iso:val('8827'),focal:val('920a'),aperture:val('829d'),shutter:val('829a'),software:val('0131'),orientation:val('0112')??1,gps:geo};
 return {tags,overview};
}
function readICCProfile(b,offset,end){
 // ICC profile header + description tag, when fully available; never infer sRGB from RGB alone.
 if(end-offset<132||ascii(b,offset+36,4)!=='acsp')return 'Profil ICC (nom indisponible)';
 const space=ascii(b,offset+16,4).trim();
 try{
  const count=Math.min(64,be32(b,offset+128));
  for(let i=0;i<count;i++){
   const p=offset+132+i*12;if(p+12>end)break;
   if(ascii(b,p,4)!=='desc')continue;
   const at=offset+be32(b,p+4),len=be32(b,p+8);
   if(at<offset||at+len>end||len<12)continue;
   const type=ascii(b,at,4);
   if(type==='desc'){
    const n=Math.min(100,be32(b,at+8));
    if(at+12+n<=end){const name=ascii(b,at+12,n).replace(/\0/g,'').trim();if(name)return name;}
   }else if(type==='mluc'&&len>=28){
    const count2=be32(b,at+8),recsz=be32(b,at+12);
    if(count2&&recsz>=12&&at+16+recsz<=end){
      const n=be32(b,at+20),ofs=be32(b,at+24),start=at+ofs;
      if(n>0&&n<=256&&start>=at&&start+n<=at+len){
       const bytes=b.subarray(start,start+n),chars=[];
       for(let j=0;j+1<bytes.length;j+=2)chars.push(String.fromCharCode(bytes[j]*256+bytes[j+1]));
       const name=chars.join('').trim();if(name)return name;
      }
    }
   }
  }
 }catch{}
 return space?'Profil ICC ('+space+')':'Profil ICC (nom indisponible)';
}
function filenameFormatCheck(filename,actual){
 const match=/\.([^.\/]+)$/.exec(filename||'');
 if(!match)return {mismatch:false,extension:'',actual:actual};
 const ext=match[1].toLowerCase();
 const expected=({jpg:'jpeg',jpeg:'jpeg',png:'png',webp:'webp'})[ext]||null;
 return {mismatch:!!expected&&expected!==actual,extension:ext,actual};
}
function emptyReport(format){return {format,tags:[],overview:{},width:null,height:null,exif:0,xmp:0,iptc:0,comments:0,text:0,icc:false,iccName:'',colorProfile:'Non embarqué',bitDepth:null,channels:null,alpha:false,compression:'',progressive:false,orientation:'',density:'',corrupt:false,metadataBytes:0};}
function inspect(input){const b=input instanceof Uint8Array?input:new Uint8Array(input);if(b.length>MAX_BYTES)throw Error('Fichier trop volumineux (100 Mo maximum).');const format=formatOf(b),r=emptyReport(format);
 const collectExif=(start,end)=>{r.exif++;try{const decoded=decodeExif(b,start,end);r.tags.push(...decoded.tags);r.overview={...r.overview,...decoded.overview};}catch(e){r.corrupt=true;}}
 if(format==='jpeg'){
  const iccParts=[];let p=2;while(p<b.length-3){const markerAt=p;if(b[p++]!==255)break;while(b[p]===255)p++;const mark=b[p++];if(mark===0xd9||mark===0xda)break;if(mark===0x01||mark>=0xd0&&mark<=0xd7)continue;if(p+2>b.length)break;const length=be16(b,p),start=p+2,end=p+length;if(length<2||end>b.length)break;
   if(mark===0xe1){if(ascii(b,start,6)==='Exif\0\0')collectExif(start,end);else if(ascii(b,start,29).includes('http://ns.adobe.com/xap'))r.xmp++;else r.xmp++;r.metadataBytes+=end-markerAt;}
   else if(mark===0xed){r.iptc++;r.metadataBytes+=end-markerAt;}
   else if(mark===0xfe){r.comments++;r.metadataBytes+=end-markerAt;}
   else if(mark===0xe2&&ascii(b,start,12).startsWith('ICC_PROFILE')){r.icc=true;iccParts.push({seq:b[start+12],count:b[start+13],data:b.subarray(start+14,end)});}
   if(mark===0xe0&&ascii(b,start,5)==='JFIF\0'&&end>=start+12){const unit=b[start+7],dx=be16(b,start+8),dy=be16(b,start+10);if(unit&&dx&&dy)r.density=dx+' × '+dy+(unit===1?' dpi':' px/cm');}
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(mark)&&end>=start+5){r.height=be16(b,start+1);r.width=be16(b,start+3);r.bitDepth=b[start];r.channels=b[start+5];r.progressive=mark===0xc2||mark===0xca;r.compression=r.progressive?'JPEG progressif · avec pertes':'JPEG · avec pertes';}
   p=end;
  }
  if(iccParts.length){const total=iccParts[0].count;if(total&&total<=20&&iccParts.length===total&&iccParts.every(t=>t.count===total&&t.seq>0&&t.seq<=total)){iccParts.sort((a,b)=>a.seq-b.seq);const all=join(iccParts.map(p=>p.data));r.iccName=readICCProfile(all,0,all.length);}else r.iccName='Profil ICC multipartiel';r.colorProfile=r.iccName;}
  if(!r.compression)r.compression='JPEG · avec pertes';
 }else if(format==='png'){
  r.width=be32(b,16);r.height=be32(b,20);r.bitDepth=b[24];const ct=b[25];r.channels=({0:1,2:3,3:1,4:2,6:4})[ct]||null;r.alpha=ct===4||ct===6;r.compression='PNG · DEFLATE · sans perte';r.colorType=({0:'Niveaux de gris',2:'RVB',3:'Palette indexée',4:'Gris + alpha',6:'RVB + alpha'})[ct]||'PNG';
  let p=8;while(p+12<=b.length){const len=be32(b,p),type=ascii(b,p+4,4),start=p+8,end=start+len;if(len>b.length||end+4>b.length)break;
   if(type==='eXIf')collectExif(start,end);
   else if(type==='tEXt'||type==='zTXt'||type==='iTXt'){r.text++;if(ascii(b,start,Math.min(90,len)).includes('XML:com.adobe.xmp'))r.xmp++;}
   else if(type==='tIME')r.comments++;
   else if(type==='iCCP'){r.icc=true;const nameEnd=b.indexOf(0,start);if(nameEnd>=start&&nameEnd<end){const name=ascii(b,start,nameEnd-start).trim();r.iccName=name||'Profil ICC';r.colorProfile=name||'Profil ICC embarqué';}else r.colorProfile='Profil ICC embarqué';}
   else if(type==='sRGB'&&!r.icc)r.colorProfile='sRGB (indication PNG)';
   else if(type==='tRNS')r.alpha=true;
   else if(type==='pHYs'&&len>=9){const x=be32(b,start),y=be32(b,start+4);if(b[start+8]===1&&x&&y)r.density=Math.round(x*.0254)+' × '+Math.round(y*.0254)+' dpi';}
   if(['eXIf','tEXt','zTXt','iTXt','tIME'].includes(type))r.metadataBytes+=len+12;
   p=end+4;if(type==='IEND')break;
  }
 }else{
  let p=12;while(p+8<=b.length){const type=ascii(b,p,4),len=le32(b,p+4),start=p+8,end=start+len;if(len>b.length||end>b.length)break;
   if(type==='EXIF'){collectExif(start,end);r.metadataBytes+=len+8+(len%2);}
   else if(type==='XMP '){r.xmp++;r.metadataBytes+=len+8+(len%2);}
   else if(type==='ICCP'){r.icc=true;r.iccName=readICCProfile(b,start,end);r.colorProfile=r.iccName;}
   else if(type==='VP8X'&&len>=10){r.width=1+b[start+4]+(b[start+5]<<8)+(b[start+6]<<16);r.height=1+b[start+7]+(b[start+8]<<8)+(b[start+9]<<16);r.alpha=!!(b[start]&0x10);}
   else if(type==='VP8 '){r.compression='WebP VP8 · avec pertes';r.bitDepth=8;r.channels=r.alpha?4:3;if(len>=10&&!r.width&&b[start+3]===157&&b[start+4]===1&&b[start+5]===42){r.width=(b[start+6]+(b[start+7]<<8))&0x3fff;r.height=(b[start+8]+(b[start+9]<<8))&0x3fff;}}
   else if(type==='VP8L'){r.compression='WebP VP8L · sans perte';r.bitDepth=8;r.channels=r.alpha?4:3;if(len>=5&&b[start]===47){const d=le32(b,start+1);if(!r.width){r.width=1+(d&0x3fff);r.height=1+((d>>>14)&0x3fff);}r.alpha=r.alpha||!!((d>>>28)&1);}}
   else if(type==='ANIM')r.compression=(r.compression||'WebP')+' · animé';
   p=end+(len&1);
  }
 }
 if(format==='webp'){if(!r.compression)r.compression='WebP · compression non précisée';if(!r.bitDepth)r.bitDepth=8;if(!r.channels)r.channels=r.alpha?4:3;}
 r.gps=!!r.overview.gps||r.tags.some(t=>t.group==='GPS');r.count=r.tags.length+r.xmp+r.iptc+r.comments+r.text;
 return r;
}
function strip(input){const b=input instanceof Uint8Array?input:new Uint8Array(input),f=formatOf(b);const chunks=[];let size=0;const put=part=>{chunks.push(part);size+=part.length;};
 if(f==='jpeg'){
  put(b.subarray(0,2));let p=2;while(p<b.length){const at=p;if(b[p]!==255){put(b.subarray(at));break;}
   p++;while(b[p]===255)p++;if(p>=b.length){put(b.subarray(at));break;}const marker=b[p++];
   if(marker===0xda||marker===0xd9){put(b.subarray(at));break;}
   if(marker===0x01||marker>=0xd0&&marker<=0xd7){put(b.subarray(at,p));continue;}
   if(p+2>b.length){put(b.subarray(at));break;}const len=be16(b,p);if(len<2||p+len>b.length){put(b.subarray(at));break;}const end=p+len;
   if(![0xe1,0xed,0xfe].includes(marker))put(b.subarray(at,end));
   p=end;
  }
  return join(chunks,size);
 }
 if(f==='png'){
  put(b.subarray(0,8));let p=8;while(p+12<=b.length){const len=be32(b,p),type=ascii(b,p+4,4),end=p+12+len;if(len>b.length||end>b.length)throw Error('PNG incomplet ou invalide.');if(!['eXIf','tEXt','zTXt','iTXt','tIME'].includes(type))put(b.subarray(p,end));p=end;if(type==='IEND')break;}
  return join(chunks,size);
 }
 if(f==='webp'){
  put(b.subarray(0,12));let p=12;while(p+8<=b.length){const type=ascii(b,p,4),len=le32(b,p+4),end=p+8+len+(len&1);if(len>b.length||end>b.length)throw Error('WebP incomplet ou invalide.');if(type!=='EXIF'&&type!=='XMP '){
     if(type==='VP8X'&&len>=10){const part=b.slice(p,end);part[8]&=~0x0c;put(part);}else put(b.subarray(p,end));
   }p=end;
  }
  const out=join(chunks,size);writeLE32(out,4,size-8);return out;
 }
 throw Error('Format non pris en charge.');
}
// ZIP simple non compressé, sans dépendance réseau. Les images déjà compressées ne gagnent rien à être recompressées.
let crcTable;
function crc32(b){if(!crcTable){crcTable=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c>>>0;}}let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function makeZip(files){if(files.length>40)throw Error('Trop de fichiers pour le ZIP.');const locals=[],centrals=[];let offset=0;
 for(const {name,bytes} of files){const safeName=name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,150)||'image';const fileName=utf8.encode(safeName),crc=crc32(bytes),head=new Uint8Array(30+fileName.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,fileName.length,true);head.set(fileName,30);locals.push(head,bytes);
  const center=new Uint8Array(46+fileName.length),d=new DataView(center.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint16(10,0,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,fileName.length,true);d.setUint32(42,offset,true);center.set(fileName,46);centrals.push(center);offset+=head.length+bytes.length;
 }
 const centralLength=centrals.reduce((sum,c)=>sum+c.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,centralLength,true);dv.setUint32(16,offset,true);return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
const core={formatOf,inspect,strip,makeZip,filenameFormatCheck,readICCProfile};globalThis.RapliExifCore=core;
if(typeof document==='undefined')return;
const el=id=>document.getElementById(id),esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const state={files:[],active:null,running:false};
const sizeText=n=>n>=1048576?(n/1048576).toFixed(2)+' Mo':n>=1024?(n/1024).toFixed(1)+' Ko':n+' octets';
const formatText=f=>({jpeg:'JPEG',png:'PNG',webp:'WebP'})[f]||f;
function message(text,type=''){el('exif-status').textContent=text;el('exif-status').className='status '+type;}
function download(blob,name){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);}
function baseName(name){return name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_ .-]/gu,'_').slice(0,90)||'image';}
function isValid(f){return /\.(jpg|jpeg|png|webp)$/i.test(f.name)||['image/jpeg','image/png','image/webp'].includes(f.type);}
function field(name,val,flag=false){return '<div class="exif-fact'+(flag?' risk':'')+'"><span>'+esc(name)+'</span><strong>'+esc(val??'—')+'</strong></div>';}
function fieldVal(v){if(v===null||v===undefined)return '—';if(Array.isArray(v))return v.map(fieldVal).join(' · ');if(typeof v==='number')return String(+v.toFixed(6));return String(v).slice(0,450);}
function technicalFacts(r){
 const c=r.report,ratio=c.width&&c.height?(()=>{const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(c.width,c.height);return (c.width/g)+' : '+(c.height/g);})():'—';
 const orientation=c.width&&c.height?(c.width===c.height?'Carré':c.width>c.height?'Paysage':'Portrait'):'Non disponible';
 const bits=c.bitDepth?(c.bitDepth+' bits/canal'+(c.channels?' · '+c.channels+' canaux':'')):'Non disponible';
 const pixelType=c.colorType||(c.channels===4?'RVB + alpha':c.channels===3?'RVB':c.channels===1?'Gris':'Non disponible');
 const modified=r.file.lastModified?new Date(r.file.lastModified).toLocaleString('fr-FR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'Non fournie';
 const fields=[['Format réel',formatText(c.format)],['Extension du nom',r.formatCheck.extension?'.'+r.formatCheck.extension:'Aucune'],['Dimensions',c.width&&c.height?c.width+' × '+c.height+' px':'Non disponibles'],['Définition',c.width&&c.height?(c.width*c.height/1e6).toFixed(2).replace('.',',')+' Mpx':'Non disponible'],['Proportions',ratio+' · '+orientation],['Poids',sizeText(r.file.size)],['Compression',c.compression||'Non disponible'],['Profondeur / canaux',bits],['Mode couleur',pixelType],['Transparence',c.alpha?'Oui':'Non détectée'],['Profil couleur',c.colorProfile],['Densité',c.density||'Non indiquée'],['Date du fichier (non EXIF)',modified]];
 return fields;
}
function reportLines(r){const rows=[];rows.push(['Fichier',r.file.name]);if(r.formatCheck.mismatch)rows.push(['Extension trompeuse','.'+r.formatCheck.extension+' — fichier '+formatText(r.report.format)]);for(const x of technicalFacts(r))rows.push(x);for(const t of r.report.tags)rows.push([t.group+' · '+t.name,fieldVal(t.value)]);if(r.report.overview.gps)rows.push(['Coordonnées GPS',r.report.overview.gps.lat.toFixed(6)+', '+r.report.overview.gps.lon.toFixed(6)]);return rows.map(x=>x.join(' : ')).join('\n');}
function renderQueue(){const list=el('exif-list');el('exif-count').textContent=state.files.length+' fichier'+(state.files.length>1?'s':'');el('exif-clear').disabled=state.running||!state.files.length;el('exif-clean-all').disabled=state.running||!state.files.length;el('exif-zip').disabled=state.running||!state.files.some(x=>x.output);
 if(!state.files.length){list.innerHTML='<div class="exif-empty">Importe des images pour afficher leurs métadonnées.</div>';return;}
 list.innerHTML=state.files.map(r=>'<div class="exif-row'+(state.active===r.id?' selected':'')+'" data-exif-id="'+r.id+'"><img alt="" src="'+r.preview+'" loading="lazy"><button class="exif-row-info" type="button" data-exif-show="'+r.id+'"><strong>'+esc(r.file.name)+'</strong><small>'+formatText(r.report.format)+' · '+sizeText(r.file.size)+' · '+r.report.count+' champ(s)'+(r.formatCheck.mismatch?' · ⚠ Extension':'')+(r.report.gps?' · GPS ⚠':'')+'</small></button><span class="exif-row-state">'+(r.output?'✓ Nettoyé':r.report.count?'À examiner':'Aucun EXIF')+'</span><button type="button" class="exif-row-remove" data-exif-remove="'+r.id+'" aria-label="Retirer '+esc(r.file.name)+'" title="Retirer le fichier">×</button></div>').join('');
}
function renderDetails(){const box=el('exif-inspector'),r=state.files.find(x=>x.id===state.active);
 if(!r){box.innerHTML='<div class="exif-empty">Sélectionne une image pour inspecter ses données EXIF, les coordonnées GPS éventuelles et les autres blocs de métadonnées.</div>';el('exif-clean-one').disabled=true;el('exif-copy').disabled=true;return;}
 const v=r.report.overview,t=r.report.tags,comp=r.report;
 el('exif-clean-one').disabled=state.running;el('exif-copy').disabled=false;
 const metaTotal=comp.exif+comp.xmp+comp.iptc+comp.text+comp.comments;
 const mismatch=r.formatCheck.mismatch?'<div class="exif-format-warning"><strong>⚠ Extension incohérente</strong><p>Le fichier porte l’extension <b>.'+esc(r.formatCheck.extension)+'</b>, mais sa signature interne indique <b>'+formatText(comp.format)+'</b>. Le format réel est fiable pour le nettoyage et le téléchargement sera renommé en conséquence.</p></div>':'';
 const tech='<div class="exif-section-bar"><strong>FICHE TECHNIQUE</strong><span>Disponible même sans EXIF</span></div><div class="exif-tech-grid">'+technicalFacts(r).map(([name,val])=>field(name,val)).join('')+'</div>';
 const showExif=!!(t.length||comp.exif||comp.xmp||comp.iptc||comp.comments||comp.text);
 const noExif=!showExif?'<div class="exif-nothing"><strong>✓ Aucune métadonnée EXIF détectée</strong><p>Ce fichier ne contient aucun champ EXIF, XMP, IPTC ni commentaire repéré par cet outil. La fiche technique ci-dessus reste disponible : elle est calculée à partir du fichier image et ne révèle pas l’appareil photo d’origine.</p></div>':'';
 const [gpsLat,gpsLon]=v.gps?[v.gps.lat.toFixed(6),v.gps.lon.toFixed(6)]:[null,null];
 const captureFacts=[['Fabricant',v.make],['Appareil',v.model],['Objectif',v.lens],['Date de prise de vue',v.date],['ISO',v.iso],['Focale',v.focal?fieldVal(v.focal)+' mm':null],['Ouverture',v.aperture?'f/'+fieldVal(v.aperture):null],['Vitesse',v.shutter?fieldVal(v.shutter)+' s':null],['Latitude',gpsLat],['Longitude',gpsLon],['Logiciel',v.software],['Orientation EXIF',comp.exif?v.orientation:null]].filter(x=>x[1]!==null&&x[1]!==undefined&&x[1]!=='');
 const detail=showExif?'<div class="exif-section-bar"><strong>MÉTADONNÉES INTÉGRÉES</strong><span>'+t.length+' champ(s) lus</span></div>'+(captureFacts.length?'<div class="exif-facts">'+captureFacts.map(([name,val])=>field(name,fieldVal(val),name==='Latitude'||name==='Longitude')).join('')+'</div>':'<p class="exif-info">Aucune valeur de prise de vue décodable. D’autres blocs peuvent être présents.</p>')+'<div class="exif-blocks"><span>EXIF <strong>'+comp.exif+'</strong></span><span>XMP <strong>'+comp.xmp+'</strong></span><span>IPTC <strong>'+comp.iptc+'</strong></span><span>Textes / commentaires <strong>'+(comp.text+comp.comments)+'</strong></span></div>'+(comp.corrupt?'<p class="exif-caution">Certains blocs EXIF sont malformés : impossible de lire tous les champs.</p>':'')+'<details class="exif-all-tags"><summary>Voir tous les champs EXIF <strong>'+t.length+'</strong></summary><div class="exif-tag-table">'+(t.length?t.map(t=>'<div><span>'+esc(t.group)+' · '+esc(t.name)+'</span><code>'+esc(fieldVal(t.value))+'</code></div>').join(''):'<div><span>Aucun champ EXIF lisible dans cette image.</span></div>')+'</div></details>':'';
 box.innerHTML='<div class="exif-inspect-header"><img src="'+r.preview+'" alt="Aperçu de '+esc(r.file.name)+'"><div><span class="exif-overline">FICHIER SÉLECTIONNÉ</span><h3>'+esc(r.file.name)+'</h3><p>'+formatText(comp.format)+' · '+sizeText(r.file.size)+(comp.width&&comp.height?' · '+comp.width+' × '+comp.height+' px':'')+'</p><div class="exif-tags"><span>'+t.length+' champs EXIF</span><span>'+metaTotal+' blocs présents</span>'+(comp.icc?'<span>ICC : '+esc(comp.colorProfile)+'</span>':'')+'</div></div></div>'+
 mismatch+
 (comp.gps?'<div class="exif-alert"><strong>⚠ Coordonnées GPS détectées</strong><p>Cette photo peut révéler le lieu où elle a été prise. Les coordonnées seront supprimées par le nettoyage.</p></div>':'')+
 (r.output?'<div class="exif-success">✓ Version nettoyée prête · '+sizeText(r.output.size)+' · EXIF / XMP / IPTC vérifiés après suppression</div>':'')+
 tech+noExif+detail+
 '<div class="exif-info">Le fichier d’origine reste inchangé. Les JPG, PNG et WebP sont nettoyés sans réencoder les pixels, sauf correction volontaire de l’orientation EXIF. Les profils colorimétriques ICC restent conservés. La date du fichier n’est pas une date de prise de vue.</div>';
}

function render(){renderQueue();renderDetails();}
let nextId=0;
async function addFiles(files){let added=0,rejected=[];
 for(const file of files){if(!isValid(file)){rejected.push(file.name+' (format non pris en charge)');continue;}if(file.size>MAX_BYTES){rejected.push(file.name+' (plus de 100 Mo)');continue;}if(state.files.length>=30){rejected.push('30 fichiers maximum');break;}
  try{const bytes=new Uint8Array(await file.arrayBuffer()),report=inspect(bytes),preview=URL.createObjectURL(file);const id=String(++nextId);state.files.push({id,file,report,formatCheck:filenameFormatCheck(file.name,report.format),preview,output:null,outputName:null});state.active=id;added++;}
  catch(error){rejected.push(file.name+' ('+error.message+')');}
 }
 render();message((added?added+' image(s) importée(s). ':'')+(rejected.length?'Ignorées : '+rejected.slice(0,3).join(', '):'Analyse locale terminée.'),added?'success':'error');
}
async function rotateEncode(file){let bmp=null,img=null,url=null;try{
 if(typeof createImageBitmap==='function'){try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}}
 if(!bmp){url=URL.createObjectURL(file);img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});}
 const w=bmp?.width||img.naturalWidth,h=bmp?.height||img.naturalHeight;if(!w||!h||w*h>25000000)throw Error('Photo trop grande pour corriger son orientation localement.');
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(bmp||img,0,0,w,h);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('Encodage impossible')),'image/jpeg',.97));canvas.width=canvas.height=0;return new Uint8Array(await blob.arrayBuffer());
 }finally{bmp?.close?.();if(url)URL.revokeObjectURL(url);}}
async function cleanOne(r){const bytes=new Uint8Array(await r.file.arrayBuffer()),orientation=Number(r.report.overview.orientation||1),reorient=el('exif-preserve-orientation').checked&&r.report.format==='jpeg'&&orientation>1&&orientation<=8;
 let outBytes;if(reorient){outBytes=strip(await rotateEncode(r.file));}else outBytes=strip(bytes);
 const check=inspect(outBytes);if(check.exif||check.xmp||check.iptc||check.text||check.comments)throw Error('Des métadonnées restent présentes dans le fichier nettoyé.');
 const type=({'jpeg':'image/jpeg','png':'image/png','webp':'image/webp'})[check.format];r.output=new Blob([outBytes],{type});r.outputName=baseName(r.file.name)+'-sans-exif.'+(check.format==='jpeg'?'jpg':check.format);r.reencoded=reorient;return r;
}
async function runClean(all){if(state.running)return;const selection=all?state.files:[state.files.find(x=>x.id===state.active)].filter(Boolean);if(!selection.length)return;state.running=true;renderQueue();el('exif-clean-one').disabled=true;el('exif-clean-all').disabled=true;message('Nettoyage local en cours…');let ok=0,errors=[];
 for(let i=0;i<selection.length;i++){const r=selection[i];message('Nettoyage : '+(i+1)+' / '+selection.length+' · '+r.file.name);try{await cleanOne(r);ok++;}catch(error){errors.push(r.file.name+' : '+error.message);}await new Promise(resolve=>setTimeout(resolve,0));}
 state.running=false;render();message((ok?'✓ '+ok+' image(s) nettoyée(s), prêtes au téléchargement. ':'')+(errors.length?'Erreurs : '+errors.slice(0,2).join(' ; '):''),errors.length?'error':'success');
}
const drop=el('exif-drop'),input=el('exif-files');if(!drop||!input)return;
input.addEventListener('change',async e=>{await addFiles([...e.target.files]);e.target.value='';});
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag');});drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('drag');});drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files]);});
el('exif-list').addEventListener('click',e=>{const show=e.target.closest('[data-exif-show]'),remove=e.target.closest('[data-exif-remove]');if(remove){const id=remove.dataset.exifRemove,i=state.files.findIndex(r=>r.id===id);if(i>=0){URL.revokeObjectURL(state.files[i].preview);state.files.splice(i,1);if(state.active===id)state.active=state.files[0]?.id||null;render();}}else if(show){state.active=show.dataset.exifShow;render();}});
el('exif-clear').addEventListener('click',()=>{for(const r of state.files)URL.revokeObjectURL(r.preview);state.files=[];state.active=null;render();message('Liste vidée.');});
el('exif-clean-one').addEventListener('click',()=>runClean(false));el('exif-clean-all').addEventListener('click',()=>runClean(true));
el('exif-copy').addEventListener('click',async()=>{const r=state.files.find(x=>x.id===state.active);if(!r)return;try{await navigator.clipboard.writeText(reportLines(r));message('✓ Rapport EXIF copié.','success');}catch{message('Impossible de copier automatiquement dans ce navigateur.','error');}});
el('exif-list').addEventListener('dblclick',e=>{const row=e.target.closest('[data-exif-id]');if(row){state.active=row.dataset.exifId;render();}});
el('exif-download-one').addEventListener('click',()=>{const r=state.files.find(x=>x.id===state.active);if(r?.output){download(r.output,r.outputName);message('✓ Téléchargement lancé : '+r.outputName,'success');}else message('Nettoie cette image avant de la télécharger.','error');});
el('exif-zip').addEventListener('click',async()=>{const all=state.files.filter(x=>x.output);if(!all.length)return;try{message('Création du ZIP en cours…');const contents=[];for(const r of all)contents.push({name:r.outputName,bytes:new Uint8Array(await r.output.arrayBuffer())});const zipped=makeZip(contents);download(zipped,'rapli-images-sans-exif.zip');message('✓ Archive ZIP prête : '+contents.length+' images nettoyées.','success');}catch(e){message('ZIP impossible : '+e.message,'error');}});
// Synchronise le bouton de téléchargement individuel sans recréer la sélection.
const oldRenderDetails=renderDetails;renderDetails=function(){oldRenderDetails();const r=state.files.find(x=>x.id===state.active);el('exif-download-one').disabled=!r?.output||state.running;};
render();
})();
