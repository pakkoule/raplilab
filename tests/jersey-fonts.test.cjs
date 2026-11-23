const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const fonts=require('../shared/jersey-fonts.js');
const name='Flocage France 2006';
const header={woff2:[119,79,70,50],woff:[119,79,70,70],ttf:[0,1,0,0],otf:[79,84,84,79]};
const mock=(ext,bytes=header[ext])=>{
 const source=new Uint8Array([...bytes,...new Array(12).fill(0)]);
 return {name:'shirt.'+ext,size:source.byteLength,arrayBuffer:async()=>source.buffer};
};
test('custom flocage accepts WOFF2/WOFF/TTF/OTF signatures and typed data URIs',async()=>{
 for(const ext of Object.keys(header)){
  const result=await fonts.importFile(mock(ext));
  assert.equal(result.format,ext);
  assert.ok(result.data.startsWith('data:font/'+ext+';base64,'));
  assert.equal(fonts.safeData(result.data),true);
 }
});
test('font importer rejects unrelated, renamed and excessively large files',async()=>{
 await assert.rejects(fonts.importFile(mock('woff',header.otf)),/ne contient pas une police/);
 await assert.rejects(fonts.importFile(mock('pdf',[37,80,68,70])),/Formats pris en charge/);
 await assert.rejects(fonts.importFile({name:'big.woff2',size:fonts.MAX_BYTES+1}),/moins de 5 Mo/);
 assert.equal(fonts.safeData('data:text/html;base64,Zm9udA=='),false);
 assert.equal(fonts.safeData('rapli-private://user/sports/not-uploaded.woff2'),false);
});
test('font record is a stable ID and exports metadata without the binary',()=>{
 const data='data:font/woff2;base64,d09GMg==';
 const rows=[{id:'jersey-font:a',type:'jersey-font',name,format:'woff2',
   fontData:data,size:1234,updatedAt:55},{id:'team:x',type:'team',name:'Team',image:'abc'}];
 const list=fonts.metadata(rows);
 assert.equal(list.length,1);
 assert.equal(list[0].id,'jersey-font:a');
 assert.equal(list[0].updatedAt,55);
 assert.equal(list[0].fontData,undefined);
 assert.equal(fonts.find(rows,'jersey-font:a').fontData,data);
});
test('Sports font category and Jerseys preview are present in the actual pages',()=>{
 const sports=fs.readFileSync('sports/index.html','utf8');
 const jerseys=fs.readFileSync('jerseys/index.html','utf8');
 const cloud=fs.readFileSync('shared/shared-collection.js','utf8');
 const portal=fs.readFileSync('index.html','utf8');
 const sportsDom=new JSDOM(sports),jerseysDom=new JSDOM(jerseys);
 try{
  const d=sportsDom.window.document,j=jerseysDom.window.document;
  assert.ok(d.querySelector('.logo-tab[data-logo-type="jersey-font"]'));
  assert.ok(d.querySelector('#logoDialog #jerseyFontPanel'));
  assert.ok(d.querySelector('#jerseyFontForm #jerseyFontFile'));
  assert.ok(d.querySelector('script[src="jersey-fonts.js"]'));
  for(const id of ['jerseyLetteringName','jerseyLetteringNumber','jerseyLetteringFont',
   'jerseyLetteringNumberFont','jerseyLetteringColor','jerseyLetteringNamePreview','jerseyLetteringNumberPreview'])
   assert.ok(j.getElementById(id),id);
  assert.ok(j.querySelector('script[src="font-preview.js"]'));
  assert.ok(cloud.includes('font/woff2'));
  assert.ok(cloud.includes('normaliseFontURI'));
  assert.ok(portal.includes("==='jersey-fonts'?'jersey-font'"));
  const migration=fs.readFileSync('supabase/migrations/20261121150000_allow_jersey_font_media.sql','utf8');
  assert.ok(migration.includes('font/otf'));
 }finally{sportsDom.window.close();jerseysDom.window.close();}
});
test('library saves and deletes custom font records via the existing editor bridge',async()=>{
 const html=fs.readFileSync('sports/index.html','utf8');
 const dom=new JSDOM(html,{url:'https://rapli.test/sports/',runScripts:'outside-only'});
 const w=dom.window;const d=w.document;
 let stored=[],writes=0;
 w.RapliExtrasBridge={
  logos:()=>stored,canEdit:()=>true,
  saveLogo:async row=>{stored=stored.filter(x=>x.id!==row.id).concat([row]);writes++;},
  removeLogo:async id=>{stored=stored.filter(x=>x.id!==id);writes++;}
 };
 w.RapliSharedCollection={canEdit:()=>true};
 w.FontFace=class{constructor(family){this.family=family;}async load(){return this;}};
 Object.defineProperty(d,'fonts',{value:{add(){}}});
 w.confirm=()=>true;
 try{
  w.eval(fs.readFileSync('shared/jersey-fonts.js','utf8'));
  w.eval(fs.readFileSync('sports/jersey-fonts.js','utf8'));
  w.RapliJerseyFontsUI.open();
  assert.equal(d.getElementById('jerseyFontPanel').hidden,false);
  const input=d.getElementById('jerseyFontFile');
  Object.defineProperty(input,'files',{configurable:true,value:[mock('woff2')]});
  input.dispatchEvent(new w.Event('change'));
  await new Promise(r=>setTimeout(r,25));
  d.getElementById('jerseyFontLabel').value=name;
  d.getElementById('jerseyFontForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(r=>setTimeout(r,25));
  assert.equal(writes,1);
  assert.equal(stored[0].type,'jersey-font');
  assert.equal(stored[0].name,name);
  assert.ok(stored[0].fontData.startsWith('data:font/woff2;base64,'));
  const remove=[...d.querySelectorAll('.jersey-font-entry-actions button')]
    .find(b=>b.textContent==='SUPPRIMER');
  assert.ok(remove);
  remove.click();
  await new Promise(r=>setTimeout(r,25));
  assert.equal(stored.length,0);
  assert.equal(writes,2);
 }finally{dom.window.close();}
});
