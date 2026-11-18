const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cardInfo,cleanName,jpegPdf}=require('../sports/card-tools.js');
test('card summary retains all players, tags, numbering and grading',()=>{
 const info=cardInfo({status:'wishlist',dream:true,numbered:true,printRun:75,tags:['Édition','Parallel'],graded:true,gradeOrg:'PSA',gradeScore:10},{players:()=>[{name:'A',nationality:'FR',auto:'stickers'},{name:'B',nationality:'FR',patch:'game-worn'}],country:()=> 'France',autoLabels:{stickers:'Stickers'}});
 assert.equal(info.title,'A / B');const fields=Object.fromEntries(info.rows);
 assert.equal(fields.Pays,'France');assert.equal(fields.Numérotation,' / 75');assert.equal(fields.Grading,'PSA 10');assert.equal(fields['Patch · B'],'Game Worn');assert.equal(fields.Tags,'Édition · Parallel');
 assert.equal(cleanName('../Équipe / France'),'Equipe-France');
});
test('multipage PDF has byte-exact xref offsets and separate image streams',async()=>{
 const blob=jpegPdf(Array.from({length:4},()=>({width:1240,height:1754,bytes:new Uint8Array([255,216,255,217])})));
 const bytes=Buffer.from(await blob.arrayBuffer()),text=bytes.toString('latin1');
 assert.equal(blob.type,'application/pdf');assert.match(text,/\/Count 4/);assert.equal((text.match(/\/Subtype \/Image/g)||[]).length,4);
 const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
 const entries=text.slice(xref).split('\n').slice(3,17);
 entries.forEach((entry,i)=>assert.equal(text.slice(Number(entry.slice(0,10)),Number(entry.slice(0,10))+`${i+1} 0 obj`.length),`${i+1} 0 obj`));
});
test('season accepts one year or consecutive full years and rejects malformed ranges',()=>{
 const {normalizeSeason}=require('../sports/card-tools.js');
 for(const value of ['2025','2025/2026',''])assert.equal(normalizeSeason(value),value);
 for(const value of ['25','2025/26','2025/2027','2026/2025','<2025>'])assert.equal(normalizeSeason(value),null);
});
test('reference copy includes all athletes and classified edition/parallel only',()=>{
 const {referenceText}=require('../sports/card-tools.js');
 const card={reference:'#41',tags:['NBA','Prism Refractor','Topps Chrome','Insert']};
 const categories=tag=>({'Topps Chrome':['collection'],'Prism Refractor':['parallel'],NBA:['competition'],Insert:['insert']})[tag];
 assert.equal(referenceText(card,['Tyrese Maxey'],categories),'Tyrese Maxey #41 Topps Chrome Prism Refractor');
 assert.equal(referenceText({reference:'#1',tags:[]},['A','B'],categories),'A / B #1');
});
