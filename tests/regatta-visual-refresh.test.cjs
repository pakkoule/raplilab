const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync('regatta/index.html','utf8');
const js=fs.readFileSync('regatta/app.js','utf8');
const css=fs.readFileSync('regatta/style.css','utf8');
const search=fs.readFileSync('regatta/search.js','utf8');

test('site logo and Courses/Statistics/Palmares tabs share one compact header',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  const header=doc.querySelector('.regatta-topbar');
  assert.ok(header);
  assert.equal(header.querySelector('.regatta-brand-logo').getAttribute('src'),'assets/logo.webp');
  assert.ok(header.querySelector('.workspace-tabs #view-races'));
  assert.ok(header.querySelector('.workspace-tabs #view-stats'));
  assert.ok(header.querySelector('.workspace-tabs #view-honors'));
  assert.equal(doc.querySelectorAll('.regatta-brand-logo').length,1);
 }finally{dom.window.close();}
});
test('search, note recalc, settings, create and profile occupy the same toolbar',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  const bar=doc.querySelector('.regatta-catalogue-controls');
  assert.ok(bar.querySelector('#search'));
  for(const id of ['recalculate-scores','manage-class-colors','new-race','rapliProfileToggle'])
   assert.ok(bar.querySelector('#'+id),id);
  assert.ok(bar.querySelector('#rapli-shared-status-regatta'));
  assert.equal(doc.querySelector('#compact-cards'),null);
  assert.equal(js.includes('regattaCompact'),false);
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) auto auto'));
  assert.ok(css.includes('--vr-button-border'));
  assert.ok(css.includes('#rapliProfileToggle.rapli-profile-toggle'));
 }finally{dom.window.close();}
});
test('unfinished races and records do not render captured ranking or route images',()=>{
 const expression=js.match(/const showShots=([^;]+);/);
 assert.ok(expression);
 const show=new Function('status','return '+expression[1]+';');
 for(const status of ['live','record-live','planned','record'])assert.equal(show(status),false,status);
 for(const status of ['finished','dnf','record-closed'])assert.equal(show(status),true,status);
 assert.ok(js.includes("(showShots?'<div class=\"shots\">"));
 assert.ok(js.includes("hideUnfinishedShots?'':r[k]"));
 assert.ok(js.includes("const showShots="));
 assert.ok(js.includes("const imageKeys=['icon','result','route']"));
});
test('live race broadcast icon pulses neon, while reduced-motion remains accessible',()=>{
 assert.ok(js.includes('class="live-neon"'));
 assert.ok(js.includes("status==='live'||status==='record-live'"));
 assert.ok(css.includes('@keyframes vr-live-pulse'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('.live-neon{animation:none'));
});
test('displayed French timezone chip is hidden but timezone logic is preserved',()=>{
 assert.equal(js.includes("🌐 '+safe(zoneName(r))"),false);
 assert.ok(js.includes('timeEngine.fromWall'));
 assert.ok(js.includes('zoneName(r)'));
 assert.ok(js.includes('dateTimeFR'));
});
test('foil editor includes three colors, border, text color and editable text for boat and VSR',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  assert.ok(doc.querySelector('#class-colors-list'));
  assert.ok(doc.querySelector('#vsr-colors-list'));
  assert.ok(doc.querySelector('#default-class-color'));
  for(const field of ['secondary','accent','border','text','label'])
   assert.ok(js.includes("input('"+field+"'")||js.includes("data-foil-field=\"label\""),field);
  assert.ok(js.includes('changeFoilStyle'));
  assert.ok(js.includes('resetFoilStyle'));
  assert.ok(js.includes("classFoils:normalizeMap"));
  assert.ok(js.includes("vsrFoils:normalizeMap"));
  assert.ok(js.includes("foilVariables(tag,'class')"));
  assert.ok(js.includes("foilVariables(vsrTag,'vsr')"));
  assert.ok(css.includes('var(--class-foil'));
  assert.ok(css.includes('var(--vsr-foil'));
  assert.ok(css.includes('var(--class-border'));
  assert.ok(css.includes('var(--vsr-border'));
 }finally{dom.window.close();}
});
test('old color settings migrate without loss; custom labels and foil properties survive',()=>{
 const start=js.indexOf('function normalizeClassSettings(');
 const end=js.indexOf('function readClassSettings()',start);
 assert.ok(start>0&&end>start);
 const context={
  COLOR_SETTINGS_ID:'regatta-class-colors-v1', DEFAULT_TAG_COLOR:'#008fa1',
  DEFAULT_VSR_COLORS:{hc:'#d4a339',vsr1:'#dfeef5',vsr2:'#dfe8f2',vsr3:'#eaeef1'},
  VSR:{hc:'HORS CATÉGORIE',vsr1:'VSR 1',vsr2:'VSR 2',vsr3:'VSR 3'},
  VSR_ORDER:['hc','vsr1','vsr2','vsr3'],
  colorSafe:v=>/^#[a-f0-9]{6}$/i.test(v||'')?v:'#008fa1',
  classKey:v=>String(v||'').trim().normalize('NFKC').toLocaleUpperCase('fr').slice(0,100),
  clean:(v,n)=>String(v??'').trim().slice(0,n),
  normalizeVsrRankingHistory:v=>Array.isArray(v)?v:[]
 };
 const normalize=vm.runInNewContext('('+js.slice(start,end).trim()+')',context);
 const old=normalize({defaultColor:'#112233',classColors:{imoca:'#445566'},vsrColors:{hc:'#aabbcc'}});
 assert.equal(old.classColors.IMOCA,'#445566');
 assert.equal(old.vsrColors.hc,'#aabbcc');
 assert.equal(Object.keys(old.classFoils).length,0);
 assert.equal(Object.keys(old.vsrFoils).length,0);
 const custom=normalize({
  defaultColor:'#112233',classColors:{IMOCA:'#445566'},vsrColors:{hc:'#aabbcc'},
  classFoils:{imoca:{secondary:'#aadddd',accent:'#f0ceeb',border:'#154e8f',text:'#ffffff',label:'IMOCA FOIL'}},
  vsrFoils:{hc:{label:'HORS CAT. PREMIUM',accent:'#ffddaa'}}
 });
 assert.equal(custom.classFoils.IMOCA.label,'IMOCA FOIL');
 assert.equal(custom.classFoils.IMOCA.border,'#154e8f');
 assert.equal(custom.vsrFoils.hc.label,'HORS CAT. PREMIUM');
 assert.equal(custom.vsrFoils.hc.accent,'#ffddaa');
 assert.equal(custom.classColors.IMOCA,'#445566');
});
test('persistent Regatta collection and search continue unchanged',()=>{
 assert.ok(js.includes("getState:()=>({records:rows,logos:colorSettingsState()})"));
 assert.ok(js.includes("storeClassSettings({...classSettings,[mapKey]:styles})"));
 assert.ok(js.includes("window.RapliSharedCollection?.changed?.()"));
 assert.ok(html.includes('src="search.js"'));
 assert.ok(search.includes('context.boatDisplay'));
 assert.ok(js.includes("boatDisplay:tagAppearance('class'"));
});

test('actual tile markup omits screenshots for all unfinished statuses, but shows finished captures',()=>{
 const start=js.indexOf('function card(r){');
 const stop=js.indexOf('/* Ajustement dynamique',start);
 assert.ok(start>0&&stop>start);
 const context={
  raceStatus:r=>r.mockStatus,
  tagAppearance:(kind)=>({
   primary:'#008fa1',secondary:'#e5fcfb',accent:'#ffe7f0',border:'#287cb5',
   text:'#14395d',label:kind==='class'?'IMOCA FOIL':'VSR FOIL'
  }),
  foilVariables:(a,k)=>'--'+k+'-tag:'+a.primary,
  VSR:{hc:'HORS CATÉGORIE'},VSR_PRIORITY:()=>0,
  statusTitle:{live:'COURSE EN COURS',planned:'À VENIR',finished:'TERMINÉE',
   dnf:'DNF',record:'COURSE RECORD','record-live':'RECORD EN COURS','record-closed':'RECORD CLÔTURÉ'},
  timeEngine:{wallAt:()=>({date:'2001-01-01'})},
  recordEngine:{latestStart:()=>({date:''})},
  scoreView:()=>({available:false,reason:''}),
  rankHtml:()=>'',podiumMedalFor:()=>'',rankPairs:[],
  safe:v=>String(v??''),validImage:v=>String(v??'').startsWith('data:image'),
  imageTag:()=>'<img class="capture">',recordCardContent:()=>'<div class="record">REC</div>',
  equipmentModes:{},ROUTE_TYPES:{},moneyNumber:()=>false,validEquipment:()=>false,
  dateTimeFR:()=>'',raceClockMarkup:()=>''
 };
 const card=new Function('ctx','with(ctx){'+js.slice(start,stop)+';return card;}')(context);
 for(const status of ['live','record-live','planned','record','finished','dnf','record-closed']){
  const race={mockStatus:status,kind:status.startsWith('record')?'record':'race',
   recordClosed:status==='record-closed',name:'Course',boatClass:'IMOCA',vsr:'hc',
   boat:'Sail',result:'data:image/png;base64,ABC',route:'data:image/png;base64,ABC'};
  const markup=card(race);
  const ongoing=['live','record-live','planned','record'].includes(status);
  assert.equal(markup.includes('<div class="shots">'),!ongoing,status);
  assert.equal(markup.includes('class="live-neon"'),
   ['live','record-live'].includes(status),status);
  assert.ok(markup.includes('IMOCA FOIL')&&markup.includes('VSR FOIL'),status);
  assert.equal(markup.includes('🌐'),false,status);
 }
});
