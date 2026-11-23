/* Pure collection helpers. No network or storage access. */
(function(root){'use strict';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const one=c=>!!c.numbered&&Number(c.printRun)===1;
function classification(c){if(!one(c))return '';return ['oneofone','plate'].includes(c.uniqueKind)?c.uniqueKind:'review';}
function identity(c){return JSON.stringify([(c.players?.length?c.players.map(p=>norm(p.name)).sort():[norm(c.player)]),norm(c.brand),norm(c.sport),norm(c.reference).replace(/^#/,''),norm(c.team),norm(c.season),(c.tags||[]).map(norm).sort(),(c.players||[]).map(p=>[norm(p.name),p.auto||'',p.patch||'']).sort(),c.numbered?String(Number(c.printRun)):'',classification(c),c.plateColor||'']);}
function serialMatch(query,c){const tokens=String(query).match(/(?:\b\d+\s*)?\/\s*\d+\b/g)||[];return tokens.every(t=>{const [a,b]=t.replace(/\s/g,'').split('/');return c.numbered&&Number(c.printRun)===Number(b)&&(!a||Number(c.serial)===Number(a));});}
function seasonRange(value){const m=/^(\d{4})(?:\/(\d{4}))?$/.exec(String(value||'').trim());if(!m||(+m[2]&&+m[2]!==+m[1]+1))return null;return [+m[1],+(m[2]||m[1])];}
function historicalLogo(variants,season){const s=seasonRange(season);if(!s)return null;return (variants||[]).find(v=>{if(v.kind==='alternative')return false;const a=seasonRange(v.from),b=seasonRange(v.to||v.from);return a&&b&&s[0]>=a[0]&&s[1]<=b[1];})||null;}
function validatePeriod(variants,candidate){if(candidate?.kind==='alternative')return true;const a=seasonRange(candidate.from),b=seasonRange(candidate.to||candidate.from);if(!a||!b||a[0]>b[0])return false;return !(variants||[]).some(v=>{if(v.id===candidate.id||v.kind==='alternative')return false;const x=seasonRange(v.from),y=seasonRange(v.to||v.from);return x&&y&&a[0]<=y[1]&&b[1]>=x[0];});}
function parseLine(line,known={}){const parts=String(line).trim().split(/\s+[-–—]\s+/).map(s=>s.trim());const text=parts.join(' '),ref=text.match(/#([\w-]+)/),run=text.match(/\/(\d+)\s*$/);const match=(values,value)=>(values||[]).find(x=>norm(x)===norm(value))||value;const brand=(known.brands||[]).filter(b=>norm(parts[1]||'').startsWith(norm(b))).sort((a,b)=>b.length-a.length)[0]||((parts[1]||'').match(/^(Topps|Panini|Upper Deck|Leaf)\b/i)||[])[1]||'';const edition=parts[1]&&!/^#/.test(parts[1])?parts[1]:'';const variation=(parts.slice(3).join(' - ')||'').replace(/\s*\/\d+\s*$/,'').trim();return {player:match(known.players,parts[0]||''),brand,reference:ref?'#'+ref[1]:'',tags:[edition,variation].filter(Boolean).filter(x=>norm(x)!==norm(brand)&&!/^#/.test(x)).map(x=>match(known.tags,x)),numbered:!!run,printRun:run?run[1]:'',serial:'',raw:String(line)};}
function safeUrl(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}

// Listing links are parsed locally: no cross-origin scraping, credentials or
// assumption that a marketplace exposes its listing metadata to the browser.
function listingProvider(host){
 const h=String(host||'').toLowerCase().replace(/^www\./,'');
 if(/^vinted\.[a-z.]+$/.test(h))return 'Vinted';
 if(/^ebay\.[a-z.]+$/.test(h))return 'eBay';
 if(h==='ebay.us')return 'eBay';
 if(h==='cardhobby.com'||h.endsWith('.cardhobby.com'))return 'Cardhobby';
 if(h==='topps.com'||h.endsWith('.topps.com'))return 'Topps';
 if(h==='hobbymonitor.com'||h.endsWith('.hobbymonitor.com'))return 'Hobbymonitor';
 if(h==='sportscardspro.com'||h.endsWith('.sportscardspro.com'))return 'SportsCardsPro';
 if(h==='sportscardinvestor.com'||h.endsWith('.sportscardinvestor.com'))return 'Sports Card Investor';
 return h;
}
const TRACKING_PARAMS=/^(?:utm_.+|fbclid|gclid|dclid|msclkid|_trkparms|_trksid|mkcid|mkevt|mkrid|campid|customid|hash|itmmeta|itmprp|ssPageName|share_source|share_from|referrer|ref_src)$/i;
function listingLink(input){
 try{
  const u=new URL(String(input||'').trim());
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>4096)return null;
  const provider=listingProvider(u.hostname);
  const segments=u.pathname.split('/').filter(Boolean);
  let listingId='',slug='';
  if(provider==='Vinted'){
   const m=u.pathname.match(/\/items\/(\d{5,})(?:-([^/?#]+))?/i);
   if(m){listingId=m[1];slug=m[2]||'';}
  }else if(provider==='eBay'){
   const m=u.pathname.match(/\/itm\/(?:([^/?#]+)\/)?(\d{9,15})(?:\/|$)/i)||
     u.pathname.match(/\/itm\/(\d{9,15})(?:\/|$)/i);
   if(m){
    listingId=m[m.length-1];
    slug=m.length===3?m[1]||'':'';
    const variation=u.searchParams.get('var');
    u.pathname='/itm/'+listingId;u.search='';
    if(variation&&/^\d{5,20}$/.test(variation))u.searchParams.set('var',variation);
   }
  }else{
   const part=segments[segments.length-1]||'';
   if(/[-_]/.test(part)&&!/\b(?:search|collection|catalog|listing|item|product)\b/i.test(part))slug=part;
   if(provider==='Cardhobby'){
    const m=u.pathname.match(/(?:\/|^)(?:item|goods|product|auction|detail)\/(\d{5,})(?:\/|$)/i);
    if(m)listingId=m[1];
   }
  }
  if(provider!=='eBay'||!listingId)
   for(const key of [...u.searchParams.keys()])if(TRACKING_PARAMS.test(key))u.searchParams.delete(key);
  u.hash='';
  const clean=u.toString();
  const itemKey=listingId?(provider.toLowerCase()+':'+listingId+
    (provider==='eBay'&&u.searchParams.has('var')?':'+u.searchParams.get('var'):'')):
    provider.toLowerCase()+':'+clean;
  return {url:clean,provider,listingId,slug,itemKey};
 }catch(_){return null;}
}
function extractListingUrls(input){
 const raw=String(input||'');
 // A shared listing may include a title on the same line as its URL.
 return raw.split(/\r?\n/).flatMap(line=>{
  const urls=[...line.matchAll(/https?:\/\/[^\s<>"'`]+/gi)];
  return urls.map(m=>{
   const text=m[0].replace(/[)\],;.!]+$/,'');
   const remainder=line.replace(m[0],'').replace(/\b(?:voir|view|open|article|annonce|lien)\s*:?\s*$/i,'').trim();
   return {url:text,hint:urls.length===1?remainder:''};
  });
 });
}
function listingTitleFromSlug(slug){
 const cleaned=String(slug||'').replace(/\.(?:html?|php|aspx?)$/i,'')
  .replace(/(?:^|[-_])\d{10,}(?:$|[-_])/g,'-')
  .replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
 if(!cleaned||!/[a-zA-ZÀ-ÿ]/.test(cleaned))return '';
 return cleaned.slice(0,180);
}
function listingCard(input,known={},titleHint=''){
 const link=typeof input==='string'?listingLink(input):input;
 if(!link)return null;
 const hint=String(titleHint||'').replace(/\s+/g,' ').trim().slice(0,350);
 const title=hint||listingTitleFromSlug(link.slug);
 const plain=norm(title).replace(/[^a-z0-9]+/g,' ');
 const findKnown=(list)=>[...(list||[])].filter(v=>typeof v==='string'&&v.trim())
  .sort((a,b)=>b.length-a.length)
  .find(v=>(' '+plain+' ').includes(' '+norm(v).replace(/[^a-z0-9]+/g,' ').trim()+' '))||'';
 const player=findKnown(known.players);
 const brand=findKnown(known.brands)||findKnown(['Panini','Topps','Upper Deck','Leaf','Futera','Fanatics']);
 const tags=[...(known.tags||[])].filter(v=>v&&(' '+plain+' ').includes(' '+norm(v).replace(/[^a-z0-9]+/g,' ').trim()+' ')).slice(0,8);
 let season='',printRun='',reference='';
 const pair=title.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/);
 if(pair){
  const first=Number(pair[1]),end=Number(pair[2].length===2?String(first).slice(0,2)+pair[2]:pair[2]);
  if(end===first+1)season=first+'/'+end;
 }
 const withoutSeason=season?title.replace(pair[0],' '):title;
 const print=withoutSeason.match(/(?:^|[\s([])(?:\d{1,4}\s*)?\/\s*(\d{1,4})(?=$|[\s,).;\]])/);
 if(print&&Number(print[1])>=1)printRun=String(Number(print[1]));
 const ref=title.match(/(?:^|[\s(])#([A-Za-z0-9][-A-Za-z0-9]{0,17})\b/);
 if(ref)reference='#'+ref[1];
 return {name:title,player,brand,reference,season,tags,
  numbered:!!printRun,printRun,source:link.provider,sourceUrl:link.url,
  listingId:link.listingId,listingKey:link.itemKey,price:'',completed:false};
}

const api={norm,one,classification,identity,serialMatch,seasonRange,historicalLogo,validatePeriod,parseLine,safeUrl,listingProvider,listingLink,extractListingUrls,listingTitleFromSlug,listingCard};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RapliExtras=api;
})(typeof window==='undefined'?globalThis:window);
