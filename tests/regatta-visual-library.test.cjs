const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const sports=fs.readFileSync('sports/index.html','utf8');
const regatta=fs.readFileSync('regatta/index.html','utf8');

test('Own, Wishlist, Regatta and Jerseys share the same four-item navigation',()=>{
 const sportsDom=new JSDOM(sports);
 const regattaDom=new JSDOM(regatta);
 try{
  const top=[...sportsDom.window.document.querySelectorAll('.section-nav .tabs [role="tab"]')];
  assert.equal(top.length,4);
  assert.deepEqual(top.map(el=>el.textContent.replace(/[^A-Z]/g,'').trim()),['OWN','WISHLIST','REGATTA','JERSEYS']);
  assert.equal(top[2].getAttribute('href'),'../#regatta');
  assert.equal(top[3].getAttribute('href'),'../#jerseys');
  const raceTabs=[...regattaDom.window.document.querySelectorAll('.regatta-collection-tabs [role="tab"]')];
  assert.equal(raceTabs.length,4);
  assert.equal(raceTabs[0].getAttribute('href'),'../#own');
  assert.equal(raceTabs[1].getAttribute('href'),'../#wishlist');
  assert.equal(raceTabs[2].getAttribute('aria-selected'),'true');
  assert.equal(raceTabs[3].getAttribute('href'),'../#jerseys');
 }finally{sportsDom.window.close();regattaDom.window.close();}
});

test('Regatta colors and VSR customization sit inside the Sports visual library',()=>{
 const dom=new JSDOM(sports);
 try{
  const doc=dom.window.document;
  const dialog=doc.getElementById('logoDialog');
  assert.ok(dialog.querySelector('.logo-tab[data-logo-type="regatta"]'));
  for(const id of ['regattaPalettePanel','regattaPaletteStatus','regattaPaletteGlobal',
                   'regattaPaletteClasses','regattaPaletteVsr','regattaPaletteCompact'])
    assert.ok(dialog.querySelector('#'+id),id);
  assert.ok(doc.querySelector('script[src="regatta-palette.js"]'));
  assert.ok(doc.querySelector('link[href="regatta-palette.css"]'));
  assert.ok(regatta.includes('id="view-colors"')); // Legacy data/settings have not been removed.
 }finally{dom.window.close();}
});

function setupPalette(editable){
 const html=`<!doctype html><div id="regattaPalettePanel" hidden>
 <div id="regattaPaletteStatus"></div>
 <button id="regattaPaletteRefresh"></button>
 <input id="regattaPaletteGlobal" type="color">
 <input id="regattaPaletteCompact" type="checkbox">
 <div id="regattaPaletteClasses"></div><div id="regattaPaletteVsr"></div>
 </div><iframe id="frame-regatta" src="about:blank"></iframe>`;
 const dom=new JSDOM(html,{url:'https://rapli.test/sports/',runScripts:'outside-only'});
 const w=dom.window,frame=w.document.getElementById('frame-regatta'),sent=[];
 frame.contentWindow.postMessage=message=>sent.push(message);
 w.eval(fs.readFileSync('sports/regatta-palette.js','utf8'));
 w.RapliRegattaPalette.open();
 const snapshot={ready:true,editable,defaultColor:'#008fa1',compact:false,
  classes:[{key:'IMOCA',label:'IMOCA',color:'#d4a339',count:5,custom:true}],
  vsr:[{key:'hc',color:'#d4a339',count:2}]};
 const reply=(state=snapshot,id=sent.at(-1).id,source=frame.contentWindow)=>{
  w.dispatchEvent(new w.MessageEvent('message',{
   origin:w.location.origin,source,
   data:{type:'RAPLI_REGATTA_PALETTE_RESPONSE',id,state,error:''}
  }));
 };
 return {w,dom,frame,sent,snapshot,reply,
  close(){w.RapliRegattaPalette.close();dom.window.close();}};
}

test('palette reads current colors from Regatta; editor writes go through its bridge',()=>{
 const s=setupPalette(true);
 try{
  assert.equal(s.sent.at(-1).action,'read');
  s.reply();
  assert.equal(s.w.document.querySelectorAll('#regattaPaletteClasses input[type=color]').length,1);
  assert.equal(s.w.document.querySelectorAll('#regattaPaletteVsr input[type=color]').length,1);
  const color=s.w.document.getElementById('regattaPaletteGlobal');
  color.value='#112233';s.w.confirm=()=>true;
  color.dispatchEvent(new s.w.Event('change',{bubbles:true}));
  assert.equal(s.sent.at(-1).action,'update');
  assert.equal(s.sent.at(-1).kind,'default');
  assert.equal(s.sent.at(-1).value,'#112233');
 }finally{s.close();}
});

test('visitors may see Regatta palette but cannot edit its colors',()=>{
 const s=setupPalette(false);
 try{
  s.reply();
  assert.equal(s.w.document.getElementById('regattaPaletteGlobal').disabled,true);
  assert.equal(s.w.document.querySelector('#regattaPaletteClasses input').disabled,true);
  assert.equal(s.w.document.querySelector('#regattaPaletteVsr input').disabled,true);
  const writes=s.sent.length;
  s.w.document.getElementById('regattaPaletteGlobal').dispatchEvent(new s.w.Event('change'));
  assert.equal(s.sent.length,writes);
  s.reply({...s.snapshot,editable:true},s.sent.at(-1).id,s.w);
  assert.equal(s.w.document.getElementById('regattaPaletteGlobal').disabled,true);
 }finally{s.close();}
});

test('Jerseys uses identical navigation and no collection writes',()=>{
 const jerseys=fs.readFileSync('jerseys/index.html','utf8');
 const portal=fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(jerseys);
 try{
  const tabs=[...dom.window.document.querySelectorAll('.jerseys-collection-tabs [role="tab"]')];
  assert.equal(tabs.length,4);
  assert.deepEqual(tabs.map(tab=>tab.textContent.trim()),['OWN','WISHLIST','REGATTA','JERSEYS']);
  assert.equal(tabs[3].getAttribute('aria-selected'),'true');
  assert.ok(jerseys.includes('../shared/collection-navigation.css'));
  assert.ok(portal.includes('id="frame-jerseys"'));
  assert.ok(portal.includes("const projects=['sports','regatta','jerseys']"));
  assert.equal(dom.window.document.querySelector('form'),null);
 }finally{dom.window.close();}
});

test('Portal routes Jerseys without touching the two existing module frames',()=>{
 const portal=fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(portal,{runScripts:'outside-only',url:'https://rapli.test/#jerseys'});
 try{
  const inline=[...portal.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
   .filter(m=>!m[1].includes('src='));
  assert.equal(inline.length,1);
  dom.window.eval(inline[0][2]);
  const doc=dom.window.document;
  assert.equal(doc.getElementById('panel-jerseys').hidden,false);
  assert.equal(doc.getElementById('panel-sports').hidden,true);
  assert.equal(doc.getElementById('panel-regatta').hidden,true);
  assert.ok(doc.getElementById('frame-jerseys').getAttribute('src').includes('jerseys/index.html'));
  assert.equal(doc.title,'Rapli Lab');
 }finally{dom.window.close();}
});
