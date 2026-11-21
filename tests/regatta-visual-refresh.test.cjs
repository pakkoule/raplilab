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

test('header VSR ranking uses the latest saved entry, progression and empty state',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  const button=doc.getElementById('vsr-header-ranking');
  assert.ok(button);
  assert.equal(button.getAttribute('aria-controls'),'stats-panel');
  assert.ok(button.closest('.regatta-topbar'));
  const from=js.indexOf('function renderVsrHeaderRanking(){');
  const to=js.indexOf('function renderVsrRankingHistory(){',from);
  assert.ok(from>0&&to>from);
  const context={
   $:id=>doc.getElementById(id),
   classSettings:{vsrRankingHistory:[]},
   rankDateDisplay:value=>value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4)+' · '+value.slice(11)
  };
  const update=new Function('context','with(context){'+js.slice(from,to)+';return renderVsrHeaderRanking;}')(context);
  update();
  assert.equal(doc.getElementById('vsr-header-ranking-value').textContent,'—');
  assert.equal(doc.getElementById('vsr-header-ranking-trend').hidden,true);
  assert.ok(button.getAttribute('aria-label').includes('aucun relevé'));
  context.classSettings.vsrRankingHistory=[{date:'2026-11-19T13:00',rank:4820}];
  update();
  assert.equal(doc.getElementById('vsr-header-ranking-value').textContent,'#4\u202f820');
  assert.equal(doc.getElementById('vsr-header-ranking-trend').textContent,'');
  assert.equal(doc.getElementById('vsr-header-ranking-trend').hidden,true);
  assert.equal(doc.getElementById('vsr-header-ranking-trend').dataset.direction,'flat');
  assert.ok(!button.getAttribute('aria-label').includes('premier relevé'));
  context.classSettings.vsrRankingHistory.push({date:'2026-11-20T13:00',rank:4700});
  update();
  const trend=doc.getElementById('vsr-header-ranking-trend');
  assert.equal(trend.dataset.direction,'up');
  assert.equal(trend.textContent,'▲ 120');
  assert.ok(button.getAttribute('aria-label').includes('120 places gagnées'));
  assert.ok(button.getAttribute('aria-label').includes('20/11/2026'));
  context.classSettings.vsrRankingHistory.push({date:'2026-11-21T13:00',rank:4780});
  update();
  assert.equal(trend.dataset.direction,'down');
  assert.equal(trend.textContent,'▼ 80');
  context.classSettings.vsrRankingHistory.push({date:'2026-11-21T14:00',rank:4780});
  update();
  assert.equal(trend.dataset.direction,'flat');
  assert.equal(trend.textContent,'=');
 }finally{dom.window.close();}
});
test('the compact foil VSR ranking shortcut navigates to the existing statistics chart',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll('#vsr-header-ranking').length,1);
  assert.ok(doc.getElementById('vsr-ranking-title'));
  assert.ok(doc.getElementById('vsr-ranking-chart'));
  assert.equal(doc.querySelector('#vsr-header-ranking').tagName,'BUTTON');
  assert.equal(doc.querySelector('#vsr-header-ranking-value').textContent,'—');
  assert.ok(css.includes('--vr-button-border'));
  assert.ok(css.includes('.regatta-topbar #vsr-header-ranking.vsr-header-ranking'));
  assert.ok(css.includes('grid-template-columns:auto minmax(0,1fr) auto'));
  assert.ok(css.includes('grid-column:2;'));
  assert.ok(css.includes('justify-self:center;'));
  assert.ok(css.includes('@media(max-width:365px)'));
  assert.ok(js.includes("$('vsr-header-ranking').addEventListener('click'"));
  assert.ok(js.includes("selectWorkspace('stats')"));
  assert.ok(js.includes("heading?.scrollIntoView?.("));
  assert.ok(js.includes('renderVsrHeaderRanking();'));
 }finally{dom.window.close();}
});

test('record race retains selectable VSR level through edit/save and keeps the category badge',()=>{
 const doc=new JSDOM(html).window.document;
 const vsr=doc.getElementById('race-vsr');
 assert.ok(vsr,'the race editor must have a VSR selector');
 assert.deepEqual([...vsr.options].map(option=>option.value),['','hc','vsr1','vsr2','vsr3']);
 assert.ok(/function updateKindFields\(\)[\s\S]*?getElementById|function updateKindFields\(\)/.test(js));
 const kindStart=js.indexOf('function updateKindFields(){');
 const kindEnd=js.indexOf('function openEditor(',kindStart);
 const kindBody=js.slice(kindStart,kindEnd);
 assert.ok(kindBody.includes("$('race-vsr').closest('label').hidden=false"),
   'VSR selector should remain visible when the kind is record');
 const saveStart=js.indexOf('async function saveEditor(');
 const saveEnd=js.indexOf('async function closeRecord(',saveStart);
 const saveBody=js.slice(saveStart,saveEnd);
 assert.ok(saveBody.includes("r.vsr=VSR[r.vsr]?r.vsr:''"),
   'selected VSR category should be validated');
 const cleanup=saveBody.match(/for\(const key of \[([^\]]+)\]\)r\[key\]='';/);
 assert.ok(cleanup,'record cleanup block expected');
 assert.equal(cleanup[1].includes("'vsr'"),false,
   'record cleanup must not erase the selected VSR category');
 assert.ok(js.includes("mode=VSR[r.vsr]||''"),
   'record tiles should show the selected VSR badge');
 const normalizeStart=js.indexOf('function normal(');
 const normalizeEnd=js.indexOf('let rows=[]',normalizeStart);
 assert.ok(js.slice(normalizeStart,normalizeEnd).includes("r.vsr=VSR[r.vsr]?r.vsr:''"),
   'record data should preserve VSR values after reload');
});

test('toolbar offers one manual sync control and a separate score recalculation control',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  const toolbar=doc.querySelector('.regatta-catalogue-controls .regatta-inline-actions');
  assert.ok(toolbar);
  const sync=toolbar.querySelector('#regatta-sync');
  const recalc=toolbar.querySelector('#recalculate-scores');
  assert.ok(sync&&recalc);
  assert.ok(sync.querySelector('svg'));
  assert.ok(recalc.querySelector('svg'));
  assert.notEqual(sync.getAttribute('aria-label'),recalc.getAttribute('aria-label'));
  assert.ok(js.includes("$('regatta-sync').addEventListener('click'"));
  assert.ok(js.includes("void cloud.syncNow()"));
  assert.ok(js.includes("$('recalculate-scores').addEventListener('click',openScoreRecalc)"));
 }finally{dom.window.close();}
});
test('Cloud sync notices are overlaid, transient, and not followed by a duplicate button',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  const overlay=doc.getElementById('regatta-cloud-overlay');
  assert.ok(overlay);
  assert.ok(overlay.querySelector('#rapli-shared-status-regatta'));
  assert.equal(overlay.closest('.regatta-catalogue-controls'),null);
  assert.equal(overlay.getAttribute('aria-hidden'),'true');
  assert.ok(css.includes('.regatta-cloud-status[data-visible="true"]'));
  assert.ok(css.includes('backdrop-filter:blur(17px)'));
  const bridge=fs.readFileSync('shared/shared-collection.js','utf8');
  assert.ok(bridge.includes('statusHideTimer = setTimeout'));
  assert.ok(bridge.includes("level === 'error' ? 6500 : level === 'pending' ? 4800 : 3600"));
  assert.ok(bridge.includes('async function syncNow()'));
  assert.ok(bridge.includes('window.RapliSharedCollection={changed,canEdit,refresh:()=>refresh(true),syncNow'));
  assert.equal(bridge.includes("statusElement.after(button)"),false);
 }finally{dom.window.close();}
});
test('departures show a directional arrow to arrivals without affecting records',()=>{
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  assert.ok(!doc.body.textContent.includes('MES COURSES / RACE ARCHIVE'));
  const start=js.indexOf('function card(r){');
  const end=js.indexOf('/* Ajustement dynamique',start);
  assert.ok(start>=0&&end>start);
  const helpers={
   raceStatus:row=>row.mockStatus,
   tagAppearance:(kind)=>({
    primary:'#008fa1',secondary:'#e5fcfb',accent:'#ffe7f0',
    border:'#287cb5',text:'#14395d',label:kind==='class'?'IMOCA FOIL':'VSR FOIL'
   }),
   foilVariables:(a,k)=>'--'+k+'-tag:'+a.primary,
   VSR:{hc:'HORS CATÉGORIE'},VSR_PRIORITY:()=>0,
   statusTitle:{live:'COURSE EN COURS',planned:'À VENIR',finished:'TERMINÉE',
    dnf:'DNF',record:'COURSE RECORD','record-live':'RECORD EN COURS',
    'record-closed':'RECORD CLÔTURÉ'},
   timeEngine:{wallAt:()=>({date:'2000-01-01'})},
   recordEngine:{latestStart:()=>({date:''})},
   scoreView:()=>({available:false,reason:''}),
   rankHtml:()=>'',podiumMedalFor:()=>'',rankPairs:[],
   safe:value=>String(value??''),validImage:value=>String(value??'').startsWith('data:image'),
   imageTag:()=>'',recordCardContent:()=>'',equipmentModes:{},ROUTE_TYPES:{},
   moneyNumber:()=>false,validEquipment:()=>false,dateTimeFR:(d,t)=>d+' '+t,
   raceClockMarkup:()=>''
  };
  const card=new Function('ctx','with(ctx){'+js.slice(start,end)+';return card;}')(helpers);
  const common={mockStatus:'finished',kind:'race',name:'Course',boatClass:'IMOCA',
   vsr:'hc',boat:'Sail',start:'2026-11-01',startTime:'13:02',
   end:'2026-11-11',endTime:'04:34'};
  const completed=card(common);
  assert.ok(completed.includes('class="journey-arrow"'));
  assert.ok(completed.indexOf('DÉPART 2026-11-01')<completed.indexOf('class="journey-arrow"'));
  assert.ok(completed.indexOf('class="journey-arrow"')<completed.indexOf('ARRIVÉE 2026-11-11'));
  assert.ok(!card({...common,end:'',endTime:''}).includes('class="journey-arrow"'));
  assert.ok(!card({...common,mockStatus:'dnf'}).includes('class="journey-arrow"'));
  assert.ok(!card({...common,kind:'record',mockStatus:'record-closed'}).includes('class="journey-arrow"'));
 }finally{dom.window.close();}
});
test('premium gradients preserve meaning of original ranking and chip colors',()=>{
 const tokens=[
  '.card .rank-grid .rank-plate.rank-main',
  '.card .rank-grid .rank-plate.rank-national',
  '.card .rank-grid .rank-plate.rank-department',
  '.card .rank-grid .rank-plate.rank-city',
  '.card .rank-grid .rank-plate.rank-team',
  '.card .stat-chip.departure-chip','.card .stat-chip.arrival-chip',
  '.card .stat-chip.duration-chip','.card .stat-chip.equipment',
  '.card .stat-chip.reward-points','.card .stat-chip.reward-credits'
 ];
 for(const token of tokens)assert.ok(css.includes(token),token);
 assert.ok(css.includes('background:linear-gradient(115deg,#093b56'));
 assert.ok(css.includes('linear-gradient(113deg,#9bcfb6'));
 assert.ok(css.includes('linear-gradient(112deg,#fff5ce'));
 assert.ok(css.includes('linear-gradient(112deg,#e9f8e8'));
});
