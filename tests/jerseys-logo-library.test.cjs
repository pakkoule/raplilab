const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const logos=require('../shared/jerseys-logo-library.js');

const img=v=>'data:image/png;base64,'+Buffer.from(v).toString('base64');
const records=[
 {id:'team:example',type:'team',name:'Club Exemple',image:img('main'),
  historical:[
   {id:'team:old',kind:'historical',from:'1994',to:'1999',image:img('old')},
   {id:'team:alt',kind:'alternative',name:'Écusson spécial',image:img('alt')}]},
 {id:'tag:league',type:'tag',name:'Ligue Exemple',image:img('league'),categories:['competition'],
  historical:[{id:'league:old',kind:'historical',from:'1990',to:'2000',image:img('old-league')}]},
 {id:'tag:refractor',type:'tag',name:'Silver Refractor',categories:['parallel'],image:img('not-a-competition')},
 {id:'brand:example',type:'brand',name:'Marque Exemple',image:img('not-team')}
];

test('Jerseys reuses only Sports team and competition-category tag IDs',()=>{
 const list=logos.list(records);
 assert.deepEqual(list.map(item=>item.id),['tag:league','team:example']);
 assert.deepEqual(list.map(item=>item.category),['competition','team']);
 assert.equal(list[0].image,undefined); // Never copy all artwork in catalogue metadata.
 assert.equal(list[1].variants[1].name,'Écusson spécial');
 assert.equal(list[1].variants[1].image,undefined);
});
test('season-aware team and competition logos reuse originals without duplicating them',()=>{
 const team=logos.resolve(records,{id:'team:example',category:'team',season:'1996/1997'});
 const league=logos.resolve(records,{id:'tag:league',category:'competition',season:'1998'});
 assert.equal(team.image,img('old'));
 assert.equal(team.source,'historical');
 assert.equal(league.image,img('old-league'));
 assert.equal(league.source,'historical');
 assert.equal(records[0].historical.length,2);
});
test('manual alternative and main logo selection are independent of season',()=>{
 const alt=logos.resolve(records,{id:'team:example',category:'team',season:'2025',variant:'variant:team:alt'});
 assert.equal(alt.image,img('alt'));
 assert.equal(alt.source,'manual');
 const main=logos.resolve(records,{id:'team:example',category:'team',season:'1996',variant:'main'});
 assert.equal(main.image,img('main'));
 assert.equal(main.source,'main');
 const missingVariant=logos.resolve(records,{id:'team:example',category:'team',season:'2025',variant:'variant:missing'});
 assert.equal(missingVariant.image,img('main'));
});
test('deleted or reclassified Sports logos gracefully disappear from Jerseys',()=>{
 const invalid=logos.resolve(records,{id:'tag:refractor',category:'competition',season:'2025'});
 assert.equal(invalid.source,'missing');assert.equal(invalid.image,'');
 const deleted=logos.resolve(records.slice(1),{id:'team:example',category:'team',season:'1998'});
 assert.equal(deleted.source,'missing');assert.equal(deleted.image,'');
 const wrongCategory=logos.resolve(records,{id:'tag:league',category:'team'});
 assert.equal(wrongCategory.source,'missing');
});
test('Jerseys UI references shared Sports logos and never edits source collections',()=>{
 const html=fs.readFileSync('jerseys/index.html','utf8');
 const sports=fs.readFileSync('sports/index.html','utf8');
 const portal=fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(html);
 try{
  for(const id of ['jerseyTeam','jerseyCompetition','jerseySeason','jerseyTeamVariant',
   'jerseyCompetitionVariant','jerseyTeamLogo','jerseyCompetitionLogo'])
   assert.ok(dom.window.document.getElementById(id),id);
  assert.ok(html.includes('../shared/jerseys-logo-library.js'));
  assert.ok(html.includes('app.js'));
  assert.ok(sports.includes('jerseys-logo-service.js'));
  assert.ok(sports.includes('RapliJerseysLogoService?.notify?.()'));
  assert.ok(portal.includes("name==='jerseys'&&!frames.sports.getAttribute('src')"));
  assert.equal(dom.window.document.querySelector('button[type="submit"]'),null);
 }finally{dom.window.close();}
});
