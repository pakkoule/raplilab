/* Rapli Sports — owned collection analytics. Pure data-only module. */
(function(root){
 'use strict';
 const key=x=>String(x??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 const clean=x=>String(x??'').trim();
 const playersOf=card=>{
  const list=Array.isArray(card?.players)?card.players:[];
  const names=list.map(p=>typeof p==='string'?{name:p}:p||{}).filter(p=>clean(p.name));
  return names.length?names:[{name:card?.player||'',auto:'',patch:''}];
 };
 const unique=items=>[...new Map(items.map(x=>[key(x),clean(x)]).filter(([k])=>!!k)).values()];
 const ranked=(owned,select)=>{
  const counts=new Map();
  for(const card of owned){
   const oneCard=unique(select(card));
   for(const label of oneCard){
    const k=key(label),entry=counts.get(k)||{label,count:0};
    entry.count++;counts.set(k,entry);
   }
  }
  return [...counts.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'fr',{sensitivity:'base'}));
 };
 const int=x=>/^\d+$/.test(String(x??'').trim())?Number(x):null;
 function calculate(items){
  // Demonstration cards are not real personal possessions.
  const owned=(Array.isArray(items)?items:[]).filter(c=>c&&c.status==='own'&&!c.demo);
  const total=owned.length;
  const brands=ranked(owned,c=>[c.brand]),teams=ranked(owned,c=>[c.team]),
   sports=ranked(owned,c=>[c.sport]),players=ranked(owned,c=>playersOf(c).map(p=>p.name)),
   tags=ranked(owned,c=>Array.isArray(c.tags)?c.tags:[]);
  const numbered=owned.filter(c=>c.numbered===true&&int(c.printRun)>0);
  const autograph=owned.filter(c=>playersOf(c).some(p=>!!p.auto));
  const patch=owned.filter(c=>playersOf(c).some(p=>!!p.patch));
  const autoTypes=ranked(owned,c=>playersOf(c).filter(p=>p.auto).map(p=>p.auto==='on-card'?'Auto On Card':p.auto==='stickers'?'Auto Stickers':'Autre Auto'));
  const patchTypes=ranked(owned,c=>playersOf(c).filter(p=>p.patch).map(p=>p.patch==='game-worn'?'Patch Game Worn':p.patch==='not-affiliated'?'Patch Not Affiliated':'Autre Patch'));
  const serialTiers=ranked(owned,c=>{
   if(!c.numbered)return ['Non numérotées'];
   const n=int(c.printRun);
   if(n===1)return ['1/1'];
   if(n!==null&&n>=2&&n<=10)return ['/2 à /10'];
   if(n!==null&&n>=11&&n<=99)return ['/11 à /99'];
   if(n!==null&&n>=100)return ['/100 et plus'];
   return ['Numérotation non précisée'];
  });
  const kpis=[
   {label:'Cartes OWN',value:total,sub:'Hors démos et wishlist'},
   {label:'Athlètes distincts',value:players.length},
   {label:'Équipes',value:teams.length},
   {label:'Marques',value:brands.length},
   {label:'Sports',value:sports.length},
   {label:'Rookie Cards',value:owned.filter(c=>c.rookie===true).length},
   {label:'Numérotées',value:numbered.length},
   {label:'Autographiées',value:autograph.length},
   {label:'Avec patch',value:patch.length},
   {label:'Multi-athlètes',value:owned.filter(c=>playersOf(c).filter(p=>clean(p.name)).length>1).length},
   {label:'Variations distinctes',value:tags.length},
   {label:'Avec photo',value:owned.filter(c=>typeof c.photo==='string'&&c.photo.startsWith('data:image/')).length}
  ];
  return {total,kpis,breakdowns:[
   {title:'Par sport',data:sports},
   {title:'Athlètes les plus collectionnés',data:players},
   {title:'Par équipe',data:teams},
   {title:'Par marque',data:brands},
   {title:'Variations et tags',data:tags},
   {title:'Rareté / numérotation',data:serialTiers},
   {title:"Types d'autographes",data:autoTypes},
   {title:'Types de patchs',data:patchTypes}
  ]};
 }
 root.RapliSportsStats={calculate};
})(typeof window!=='undefined'?window:globalThis);
