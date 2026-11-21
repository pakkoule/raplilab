/* Read-only shared identity library for Rapli Jerseys.
 * Team logos and competition-tag logos remain owned by Rapli Sports.
 * Jerseys stores/references their IDs and optional variants; never copies
 * the corresponding records or images into a second collection. */
(function(root){
 'use strict';
 const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const clean=value=>typeof value==='string'?value.trim():'';
 const imageSafe=value=>typeof value==='string' &&
   /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value);
 const category=row=>{
   if(!row||typeof row!=='object')return '';
   if(row.type==='team')return 'team';
   if(row.type==='tag'&&Array.isArray(row.categories)&&row.categories.includes('competition'))return 'competition';
   return '';
 };
 const seasonRange=value=>{
   const match=/^(\d{4})(?:\/(\d{4}))?$/.exec(clean(value));
   if(!match)return null;
   const from=Number(match[1]),to=Number(match[2]||match[1]);
   return to===from||to===from+1?[from,to]:null;
 };
 const historicalLogo=(variants,season)=>{
   const value=seasonRange(season);
   if(!value)return null;
   return (Array.isArray(variants)?variants:[]).find(variant=>{
     if(variant.kind==='alternative')return false;
     const from=seasonRange(variant.from),to=seasonRange(variant.to||variant.from);
     return from&&to&&value[0]>=from[0]&&value[1]<=to[1];
   })||null;
 };
 const sourceRecords=logos=>(Array.isArray(logos)?logos:[])
   .filter(item=>category(item)&&clean(item.id)&&clean(item.name));
 const list=logos=>sourceRecords(logos).map(item=>({
   id:item.id,
   category:category(item),
   name:item.name.trim(),
   variants:(Array.isArray(item.historical)?item.historical:[])
     .filter(v=>clean(v.id))
     .map(v=>({
       id:v.id,kind:v.kind==='alternative'?'alternative':'historical',
       name:clean(v.name).slice(0,80),from:clean(v.from).slice(0,12),to:clean(v.to).slice(0,12)
     }))
 })).sort((a,b)=>a.category.localeCompare(b.category)||
   a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
 const options=(entry)=>[
   {value:'auto',label:'Automatique (selon la saison)'},
   {value:'main',label:'Logo principal'},
   ...(entry?.variants||[]).map(v=>({
     value:'variant:'+v.id,
     label:v.kind==='alternative'?'Alternatif · '+(v.name||'Sans nom'):
       'Historique · '+v.from+(v.to&&v.to!==v.from?' — '+v.to:'')
   }))
 ];
 const resolve=(logos,ref={})=>{
   const id=clean(ref.id),requested=clean(ref.category),season=clean(ref.season);
   const entry=sourceRecords(logos).find(row=>row.id===id&&category(row)===requested);
   if(!entry)return {id,category:requested,name:'',image:'',source:'missing',variant:'',season};
   const wanted=clean(ref.variant)||'auto';
   const variants=Array.isArray(entry.historical)?entry.historical:[];
   let choice=null,source='main';
   if(wanted.startsWith('variant:')){
     const variantId=wanted.slice('variant:'.length);
     choice=variants.find(v=>v.id===variantId&&imageSafe(v.image))||null;
     if(choice)source='manual';
   }else if(wanted==='auto'){
     choice=historicalLogo(variants,season);
     if(choice&&imageSafe(choice.image))source='historical';
     else choice=null;
   }
   const image=choice&&imageSafe(choice.image)?choice.image:
     imageSafe(entry.image)?entry.image:'';
   return {
     id:entry.id,category:category(entry),name:entry.name,season,
     image,source:image?source:'missing',variant:choice?.id||''
   };
 };
 const api=Object.freeze({norm,category,seasonRange,historicalLogo,list,options,resolve,imageSafe});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.RapliJerseysLogos=api;
})(typeof window!=='undefined'?window:undefined);
