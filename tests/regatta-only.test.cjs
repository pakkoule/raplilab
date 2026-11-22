const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('Regatta is the only active workspace and the only root destination',()=>{
 const root=fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(root,{url:'https://rapli.test/'});
 try{
  const d=dom.window.document;
  assert.equal(d.title,'Rapli Regatta');
  assert.equal(d.querySelectorAll('iframe').length,1);
  assert.equal(d.querySelector('iframe').getAttribute('src'),'/regatta/index.html');
  assert.equal(d.querySelectorAll('[data-product],#panel-sports,#panel-jerseys').length,0);
  assert.ok(d.querySelector('link[rel="icon"]').href.includes('/regatta/assets/logo.webp'));
 }finally{dom.window.close();}
});
test('Regatta uses its own logo and class colour editor without Sports navigation',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 const dom=new JSDOM(html);
 try{
  const d=dom.window.document;
  assert.equal(d.title,'Rapli Regatta');
  assert.equal(d.querySelector('.regatta-brand-logo').getAttribute('src'),'assets/logo.webp');
  assert.equal(d.querySelectorAll('.regatta-collection-tabs, .regatta-sports-back, #rapliProfileRegatta').length,0);
  assert.equal(d.querySelector('.workspace-tabs'),null,'team-only workspace has no personal tabs');
  assert.equal(d.querySelector('#view-races'),null);
  assert.equal(d.querySelector('#view-stats'),null);
  assert.equal(d.querySelector('#view-honors'),null);
  assert.ok(d.querySelector('#lpdb-panel:not([hidden])'));
  assert.equal(d.querySelectorAll('.lpdb-tabs .lpdb-tab').length,4);
  assert.ok(d.querySelector('#colors-panel'));
  assert.ok(d.querySelector('#rapliProfileLogin'));
  assert.ok(d.querySelector('#rapli-shared-status-regatta'));
  assert.ok(app.includes("()=>selectWorkspace('colors')"));
  assert.equal(app.includes('RAPLI_REGATTA_PALETTE_REQUEST'),false);
 }finally{dom.window.close();}
});
test('Regatta cloud and data compatibility are retained',()=>{
 const sync=fs.readFileSync('shared/shared-collection.js','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 assert.ok(sync.includes("bridge.module !== 'regatta'"));
 assert.ok(sync.includes("const TABLE = 'rapli_module_collections'"));
 assert.ok(sync.includes("const BUCKET = 'rapli-archives-private'"));
 assert.ok(app.includes("const COLOR_SETTINGS_KEY")||app.includes("const COLOR_STORAGE_KEY"));
 assert.ok(app.includes("window.RapliModuleBridge"));
});
test('manifest and root headers only advertise Regatta',()=>{
 const manifest=JSON.parse(fs.readFileSync('site.webmanifest','utf8'));
 assert.equal(manifest.name,'Rapli Regatta');
 assert.equal(manifest.icons[0].src,'/regatta/assets/logo.webp');
 const root=fs.readFileSync('index.html','utf8');
 assert.equal(root.includes('Rapli Archives'),false);
 assert.equal(root.includes('JERSEYS'),false);
});
