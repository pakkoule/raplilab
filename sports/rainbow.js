/* Rapli Sports · Rainbow : checklist manuelle par carte de base.
 * Les variantes attendues sont définies par le collectionneur. Seules les
 * cartes OWN réelles, explicitement reliées à une variante, comptent.
 */
(function(root){
 'use strict';
 const MAX_VARIANTS=80;
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const trim=(x,max=150)=>String(x??'').trim().slice(0,max);
 function variantLines(raw){
  const found=new Set(),out=[];
  for(const line of String(raw||'').split(/\r?\n/)){
   const label=trim(line,90),key=norm(label);
   if(!key||found.has(key))continue;
   found.add(key);out.push(label);
   if(out.length>=MAX_VARIANTS)break;
  }
  return out;
 }
 const MAX_REFERENCES=30;
 function referenceLines(raw){
  const values=Array.isArray(raw)?raw:String(raw||'').split(/\r?\n/);
  const seen=new Set(),out=[];
  for(const value of values){
   const label=trim(value,180),key=norm(label);
   if(!key||seen.has(key))continue;
   seen.add(key);out.push(label);
   if(out.length>=MAX_REFERENCES)break;
  }
  return out;
 }
 function cleanGroup(input){
  const raw=input&&typeof input==='object'?input:{};
  const seen=new Set(),variants=[];
  for(const item of Array.isArray(raw.variants)?raw.variants:[]){
   const label=trim(typeof item==='string'?item:item?.label,90),key=norm(label);
   if(!key||seen.has(key))continue;
   seen.add(key);
   variants.push({label,cardId:trim(item?.cardId,180),isBase:item?.isBase===true});
   if(variants.length>=MAX_VARIANTS)break;
  }
  // Keep one explicit cover; old Rainbows retain their named Base variant.
  const explicit=(Array.isArray(raw.variants)?raw.variants:[]).some(item=>item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'isBase'));
  const selected=variants.findIndex(v=>v.isBase);
  const baseIndex=explicit?selected:variants.findIndex(v=>['base','base card','carte de base'].includes(norm(v.label)));
  variants.forEach((v,index)=>{v.isBase=index===baseIndex;});
  // Old saved Rainbows have one baseReference; keep it as the first allowed
  // reference and retain all new references on subsequent edits.
  const references=referenceLines([
   ...referenceLines(raw.baseReference),
   ...referenceLines(raw.baseReferences)
  ]);
  return {
   id:trim(raw.id,180),type:'rainbow',name:trim(raw.name,160),
   brand:trim(raw.brand,90),athlete:trim(raw.athlete,120),
   baseReference:references[0]||'',baseReferences:references,variants,
   createdAt:Number(raw.createdAt)||Date.now(),updatedAt:Number(raw.updatedAt)||Date.now()
  };
 }
 function progress(group,collection){
  const data=cleanGroup(group);
  const byId=new Map((Array.isArray(collection)?collection:[]).map(card=>[card.id,card]));
  const used=new Set();
  let owned=0,wishlist=0,missing=0;
  const entries=data.variants.map(variant=>{
   const card=byId.get(variant.cardId);
   let status='missing';
   if(card&&!used.has(card.id)){
    used.add(card.id);
    if(card.status==='own'&&!card.demo)status='own';
    else if(card.status==='wishlist')status='wishlist';
   }
   if(status==='own')owned++;
   else if(status==='wishlist')wishlist++;
   else missing++;
   return {...variant,status,card:card&&status!=='missing'?card:null};
  });
  return {...data,entries,owned,wishlist,missing,total:entries.length,
   percent:entries.length?Math.round(owned/entries.length*100):0};
 }
 root.RapliSportsRainbow=Object.freeze({MAX_VARIANTS,MAX_REFERENCES,norm,variantLines,referenceLines,cleanGroup,progress});
})(window);
