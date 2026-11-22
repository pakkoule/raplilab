const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync('regatta/index.html','utf8');
const js=fs.readFileSync('regatta/app.js','utf8');
const css=fs.readFileSync('regatta/style.css','utf8');
const search=fs.readFileSync('regatta/search.js','utf8');

function raceTileHarness(){
 const start=js.indexOf('function recordHasFutureStart(r){');
 const end=js.indexOf('/* Ajustement dynamique',start);
 assert.ok(start>0&&end>start,'race tile helpers not found');
 const ctx={
  raceStatus:r=>r.mockStatus,
  recordEngine:{
   latestStart:attempts=>attempts?.[0]||{date:'',time:''},
   summary:()=>({bestSeconds:93600}),
   format:seconds=>Math.floor(seconds/3600)+' h'
  },
  localDateTime:(date,time)=>new Date(date+'T'+time+':00+01:00').getTime(),
  timeEngine:{wallAt:()=>({date:'2026-11-21'})},
  raceClockInfo:r=>['live','record-live','planned'].includes(r.mockStatus)?
   {mode:r.mockStatus==='planned'?'countdown':'elapsed',
    start:r.mockStatus==='planned'?Date.now()+3600000:Date.now()-120000}:null,
  formatRaceClock:sec=>Math.floor(sec)+' sec',
  tagAppearance:(kind)=>({
   primary:'#008fa1',secondary:'#e5fcfb',accent:'#ffe7f0',
   border:'#287cb5',text:'#14395d',
   label:kind==='class'?'IMOCA FOIL':'VSR FOIL'
  }),
  foilVariables:(value,kind)=>'--'+kind+'-tag:'+value.primary,
  VSR:{hc:'HORS CATÉGORIE'},VSR_PRIORITY:()=>0,
  statusTitle:{live:'COURSE EN COURS',planned:'À VENIR',finished:'TERMINÉE',
   dnf:'DNF',record:'COURSE RECORD','record-live':'RECORD EN COURS',
   'record-closed':'RECORD CLÔTURÉ'},
  scoreView:r=>r.kind==='record'||r.mockStatus==='dnf'?{available:false,reason:'Not applicable'}:
   {available:Boolean(r.mockScore),value:r.mockScore||0,reason:''},
  rankHtml:(icon,label,value,total,cls)=>value?
   '<div class="rank-plate '+cls+'"><strong>'+value+'</strong></div>':'',
  podiumMedalFor:()=>'',rankPairs:[['rank','rankTotal']],
  safe:value=>String(value??''),validImage:value=>String(value??'').startsWith('data:image'),
  imageTag:(src,alt)=>'<img src="'+src+'" alt="'+alt+'">',
  recordCardContent:()=>'<div class="record-card">RECORD ATTEMPTS</div>',
  equipmentModes:{pdd:'PDD','half-fp':'1/2 FP','full-pack':'FULL PACK',fp:'FULL PACK'},
  ROUTE_TYPES:{transat:'Transatlantique'},
  moneyNumber:value=>value!==''&&value!==undefined&&value!==null,
  validEquipment:value=>['pdd','half-fp','full-pack','fp'].includes(value),
  dateTimeFR:(day,time)=>day+(time?' · '+time:''),
 };
 const methods=new Function('ctx','with(ctx){'+js.slice(start,end)+
  ';return {card,raceCardSchedule,raceCardMenu,recordHasFutureStart,canExportRaceCalendar};}')(ctx);
 return {...methods,ctx};
}
const testRace={
 name:'Transat Rapli',boat:'Rapli LPDB',boatClass:'IMOCA',vsr:'hc',
 start:'2026-11-01',startTime:'13:02',end:'2026-11-11',endTime:'04:34',
 duration:'10 j 15 h',rank:'123',rankTotal:'10000',
 rankNational:'19',rankDepartment:'8',rankCity:'3',rankTeam:'21',
 gainPoints:250,gainCredits:150,equipment:'fp',routeType:'transat',
 icon:'data:image/png;base64,AAAA',result:'data:image/png;base64,BBBB',
 route:'data:image/png;base64,CCCC'
};

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
  assert.ok(doc.querySelector('#regatta-cloud-overlay #rapli-shared-status-regatta'));
  assert.equal(bar.querySelector('#rapli-shared-status-regatta'),null);
  assert.equal(doc.querySelector('#compact-cards'),null);
  assert.equal(js.includes('regattaCompact'),false);
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) auto auto'));
  assert.ok(css.includes('--vr-button-border'));
  assert.ok(css.includes('#rapliProfileToggle.rapli-profile-toggle'));
 }finally{dom.window.close();}
});
test('unfinished races hide result/route menu actions but keep saved images intact',()=>{
 const {raceCardMenu}=raceTileHarness();
 for(const status of ['live','record-live','planned','record','finished','dnf','record-closed']){
  const menu=raceCardMenu(testRace,status);
  const canView=!['live','record-live','planned','record'].includes(status);
  assert.equal(menu.includes('data-action="view-result"'),canView,status);
  assert.equal(menu.includes('data-action="view-route"'),canView,status);
  assert.ok(menu.includes('data-action="edit"'));
  assert.ok(menu.includes('data-action="png"'));
 }
 assert.ok(js.includes("hideUnfinishedShots?'':r[k]"));
 assert.ok(js.includes("const imageKeys=['icon','result','route']"));
 assert.ok(js.includes("window.RapliPhotoZoom?.openSource?.(src,label)"));
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

test('rendered tiles use menu-only image actions, preserving live status and foil labels',()=>{
 const {card}=raceTileHarness();
 for(const status of ['live','record-live','planned','record','finished','dnf','record-closed']){
  const record=status.startsWith('record');
  const race={...testRace,mockStatus:status,kind:record?'record':'race',
   recordClosed:status==='record-closed',live:status==='record-live',
   attempts:[{date:'2026-11-22',time:'08:00'}]};
  const markup=card(race);
  const canView=!['live','record-live','planned','record'].includes(status);
  assert.equal(markup.includes('data-action="view-result"'),canView,status);
  assert.equal(markup.includes('data-action="view-route"'),canView,status);
  assert.equal(markup.includes('class="live-neon"'),
   ['live','record-live'].includes(status),status);
  assert.ok(markup.includes('IMOCA FOIL')&&markup.includes('VSR FOIL'),status);
  assert.equal(markup.includes('🌐'),false,status);
  assert.ok(!markup.includes('<div class="shots">'));
  assert.equal(markup.includes('race-card-rewards'),!record&&status!=='live'&&status!=='planned',status);
  assert.equal(markup.includes('data-action="calendar"'),
   status==='planned'||status==='record',status);
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
test('left column displays departure then arrival then finished duration or active timer',()=>{
 const {raceCardSchedule}=raceTileHarness();
 const completed=raceCardSchedule({...testRace,mockStatus:'finished'},'finished');
 assert.ok(completed.includes('race-card-schedule'));
 assert.ok(completed.includes('race-card-date-item race-card-departure'));
 assert.ok(completed.includes('race-card-date-item race-card-arrival'));
 assert.ok(completed.includes('DÉPART'));
 assert.ok(completed.includes('ARRIVÉE'));
 assert.ok(completed.includes('10 j 15 h'));
 assert.ok(completed.indexOf('2026-11-01')<completed.indexOf('2026-11-11'));
 assert.ok(completed.indexOf('2026-11-11')<completed.indexOf('10 j 15 h'));
 const current=raceCardSchedule({...testRace,mockStatus:'live'},'live');
 assert.ok(current.includes('EN COURS'));
 assert.ok(current.includes('data-race-clock="elapsed"'));
 assert.equal(current.includes('10 j 15 h'),false);
 const upcoming=raceCardSchedule({...testRace,mockStatus:'planned'},'planned');
 assert.ok(upcoming.includes('À VENIR'));
 assert.ok(upcoming.includes('data-race-clock="countdown"'));
 const closed=raceCardSchedule({...testRace,kind:'record',mockStatus:'record-closed',
  recordClosed:true,attempts:[{date:'2026-11-08',time:'10:00'}]},'record-closed');
 assert.ok(closed.includes('RECORD CLÔTURÉ'));
 assert.ok(closed.includes('MEILLEUR TEMPS'));
 assert.equal(closed.includes('data-race-clock='),false);
 assert.ok(!closed.includes('race-card-rewards'));
 assert.ok(!js.includes('class="journey-arrow"'));
});


test('responsive duration never wraps the seconds on narrow race cards',()=>{
 const clockSelector='.cards .card.card--columns .race-card-clock .race-card-time-value';
 const clockRule=css.split(clockSelector+'{')[1]?.split('}')[0];
 assert.ok(clockRule,'race clock rule exists');
 assert.match(css,/\.cards \.card\.card--columns \.race-card-clock\{\s*container-type:inline-size;/);
 assert.match(clockRule,/font-size:clamp\(8px,6\.8cqi,18px\)/);
 assert.match(clockRule,/white-space:nowrap;overflow-wrap:normal/);
 assert.equal(css.includes(clockSelector+'{font-size:14px}'),false,
  'fixed-size mobile rule must not override the fluid clock size');
});

test('reward chips share one row and title/date styling stays responsive',()=>{
 const titleRule=css.split('.cards .card.card--columns .card-title-row{')[1]?.split('}')[0];
 assert.match(titleRule,/display:block/,'title spans the whole left column after moving the menu');
 const rewardRule=css.split('.cards .card.card--columns .race-card-rewards{')[1]?.split('}')[0];
 assert.match(rewardRule,/display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 const smallPhoneRule=css.split('@media(max-width:580px){').pop();
 assert.match(smallPhoneRule,/race-card-rewards \.stat-chip\{font-size:8px;padding:7px 4px;min-height:40px\}/);
 assert.doesNotMatch(smallPhoneRule,/race-card-rewards \.stat-chip\{flex-basis:100%/);
 for(const className of ['race-card-departure','race-card-arrival']){
  assert.ok(css.includes('.cards .card.card--columns .'+className+'{'),
   className+' has a distinct soft foil gradient');
 }
 const {card}=raceTileHarness();
 const tile=new JSDOM(card({...testRace,mockStatus:'finished'})).window.document;
 assert.equal(tile.querySelectorAll('.race-card-rewards .stat-chip').length,2);
});

test('equipment uses designation only and options stay at the tile upper-right',()=>{
 const {card}=raceTileHarness();
 for(const [equipment,label] of [['pdd','PDD'],['half-fp','1/2 FP'],['full-pack','FULL PACK']]){
  const doc=new JSDOM(card({...testRace,equipment,mockStatus:'finished'})).window.document;
  const tags=doc.querySelector('.race-card-right .race-card-meta-tags');
  const badge=tags.querySelector('.race-card-badges .equipment');
  assert.equal(badge.textContent,label,'equipment chip must show only the designation');
  assert.equal(tags.lastElementChild.className,'race-actions-menu',
   'the action menu follows the badges on the same top row');
  assert.equal(doc.querySelectorAll('.race-actions-menu').length,1);
  assert.ok(tags.querySelector('.race-card-badges .class-tag'));
  assert.ok(tags.querySelector('.race-card-badges .vsr-badge'));
 }
 const badgeCss=css.split('.cards .card.card--columns .race-card-meta-tags{')[1]?.split('}')[0];
 assert.match(badgeCss,/flex-wrap:nowrap/);
 assert.ok(css.includes('.cards .card.card--columns .race-card-badges{'));
 const optionsCss=css.split('.cards .card.card--columns .race-actions-menu{')[1]?.split('}')[0];
 assert.match(optionsCss,/margin:0 0 0 auto/);
 const popoverCss=css.split('.cards .card.card--columns .race-actions-popover{')[1]?.split('}')[0];
 assert.match(popoverCss,/right:0;left:auto/,'popover opens inward from the right edge');
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


test('two-column race, record and stage cards preserve details, menu and media zoom',()=>{
 const {card}=raceTileHarness();
 for(const [status,kind,closed] of [
  ['live','race',false],['planned','race',false],['finished','race',false],
  ['dnf','race',false],['record-live','record',false],['record-closed','record',true],
  ['finished','event',false]
 ]){
  const rendered=card({...testRace,kind,mockStatus:status,recordClosed:closed,
   live:status==='record-live',mockScore:kind==='record'?0:87,
   attempts:[{date:'2026-11-22',time:'08:00'}]});
  const document=new JSDOM(rendered).window.document;
  const tile=document.querySelector('article.card--columns');
  assert.ok(tile,status);
  const layout=tile.querySelector('.race-card-layout');
  assert.ok(layout.querySelector('.race-card-left .card-top .race-icon.card-photo img'));
  assert.ok(layout.querySelector('.race-card-left .card-title-row h2'));
  assert.ok(layout.querySelector('.race-card-left .race-card-schedule'));
  assert.ok(layout.querySelector('.race-card-right .race-card-meta-tags .class-tag'));
  assert.ok(layout.querySelector('.race-card-right .race-card-meta-tags .vsr-badge'));
  assert.ok(layout.querySelector('.race-card-right .race-card-meta-tags>.race-actions-menu>summary'));
  assert.equal(layout.querySelector('.race-card-left .race-actions-menu'),null);
  assert.ok(layout.querySelector('.race-card-right .race-card-meta-tags>.race-card-badges'));
  assert.ok(tile.querySelector('.race-card-right .rank-plate.rank-main')||status==='dnf'||
    status==='live'||(kind==='record'&&!closed));
  assert.equal(Boolean(tile.querySelector('.race-card-right .score-orb')),
   kind!=='record'&&status!=='dnf'&&status!=='live',status);
  assert.equal(Boolean(tile.querySelector('.race-card-right .race-card-rewards')),
   kind!=='record'&&status!=='live'&&status!=='planned',status);
  assert.ok(tile.querySelector('.race-actions-popover [data-action="edit"]'));
  assert.ok(tile.querySelector('.race-actions-popover [data-action="png"]'));
  assert.equal(tile.querySelectorAll('.card-content').length,1);
  if(kind==='event')assert.ok(rendered.includes('COURSE À ÉTAPES'));
 }
 assert.ok(css.includes('.cards .card.card--columns .race-card-layout{'));
 assert.ok(css.includes('grid-template-columns:minmax(0,.85fr) minmax(0,1.18fr)'));
 assert.ok(css.includes('.cards .card.card--columns .race-card-meta-tags{'));
 assert.ok(css.includes('.cards .card.card--columns .race-actions-popover{'));
 assert.ok(css.includes('@media(max-width:360px)'));
 const viewer=fs.readFileSync('shared/photo-zoom.js','utf8');
 assert.ok(viewer.includes('.card-photo img'));
 assert.ok(viewer.includes('openSource(src,alt='));
});



test('future course, stage and record attempts are exportable to iOS Calendar from the menu',()=>{
 const {raceCardMenu,canExportRaceCalendar,ctx}=raceTileHarness();
 const calendarStart=js.indexOf('function calendarText(r){');
 const calendarEnd=js.indexOf('function exportCalendar(r){',calendarStart);
 assert.ok(calendarStart>0&&calendarEnd>calendarStart);
 const env={
  canExportRaceCalendar,
  recordEngine:ctx.recordEngine,
  timeEngine:{
   fromWall:(date,time)=>new Date(date+'T'+time+':00+01:00').getTime(),
   utcIcs:value=>new Date(value).toISOString().replace(/[-:]/g,'')
    .replace(/\.\d{3}Z/,'Z')
  },
  parseRaceDuration:()=>({status:'empty'}),
  calendarEscape:value=>String(value).replace(/\n/g,'\\n'),
  foldCalendarLine:value=>value
 };
 const calendarText=new Function('env','with(env){'+js.slice(calendarStart,calendarEnd)+
  ';return calendarText;}')(env);
 const entries=[
  {...testRace,kind:'race',mockStatus:'planned',start:'2026-11-23',startTime:'12:10'},
  {...testRace,kind:'event',mockStatus:'planned',start:'2026-11-23',startTime:'12:10'},
  {...testRace,kind:'race',eventId:'stage-03',mockStatus:'planned',
   start:'2026-11-23',startTime:'12:10'},
  {...testRace,kind:'record',mockStatus:'record',live:false,recordClosed:false,
   attempts:[{date:'2026-11-22',time:'10:05'}]}
 ];
 for(const race of entries){
  assert.ok(canExportRaceCalendar(race));
  assert.ok(raceCardMenu(race,race.mockStatus).includes('data-action="calendar"'));
  const text=calendarText(race);
  assert.ok(text.includes('BEGIN:VCALENDAR'));
  assert.ok(text.includes('DTSTART:'));
  assert.ok(text.includes('END:VCALENDAR'));
 }
 const record={...entries.at(-1),live:true,mockStatus:'record-live'};
 assert.equal(canExportRaceCalendar(record),false);
 assert.ok(!raceCardMenu(record,'record-live').includes('data-action="calendar"'));
 assert.throws(()=>calendarText(record),/à venir/);
});

test('upcoming and in-progress races do not show unearned rewards',()=>{
 const {card}=raceTileHarness();
 for(const status of ['planned','live']){
  const doc=new JSDOM(card({...testRace,mockStatus:status,kind:'race'})).window.document;
  assert.equal(doc.querySelector('.race-card-rewards'),null,status);
  assert.equal(doc.querySelector('.reward-points'),null,status);
  assert.equal(doc.querySelector('.reward-credits'),null,status);
 }
 const finished=new JSDOM(card({...testRace,mockStatus:'finished',kind:'race'})).window.document;
 assert.equal(finished.querySelectorAll('.race-card-rewards .stat-chip').length,2);
});
