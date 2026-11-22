const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

const js=fs.readFileSync('regatta/app.js','utf8');
const css=fs.readFileSync('regatta/style.css','utf8');
const from=js.indexOf('/* GFS windows are anchored');
const to=js.indexOf('function raceCardSchedule(r,status){',from);
assert.ok(from>=0&&to>from,'GFS functions are present before the card helper');
const {gfsWeatherState,gfsCardMarkup,updateGfsWidgets,gfsBriefingForDeparture}=
 new Function(js.slice(from,to)+';return {gfsWeatherState,gfsCardMarkup,updateGfsWidgets,gfsBriefingForDeparture,gfsBriefingMarkup,gfsBriefingForRace,updateGfsBriefings};')();

const state=date=>gfsWeatherState(Date.parse(date));

test('GFS cycle switches exactly at 03:40, 09:40, 15:40 and 21:40 UTC',()=>{
 const before=state('2026-11-22T09:39:59Z');
 assert.equal(before.countdown,'00:00:01');
 assert.equal(before.progress,100);
 assert.equal(before.nextLocal,'10:40');
 const at=state('2026-11-22T09:40:00Z');
 assert.equal(at.progress,0);
 assert.equal(at.countdown,'06:00:00');
 assert.equal(at.nextLocal,'16:40');
 assert.equal(at.stage,'loading');
 assert.equal(state('2026-11-22T15:40:00Z').nextLocal,'22:40');
 assert.equal(state('2026-11-22T21:40:00Z').nextLocal,'04:40');
});
test('GFS weather widget follows French summer/winter time and DST boundaries',()=>{
 assert.equal(state('2026-01-05T03:39:59Z').nextLocal,'04:40');
 assert.equal(state('2026-07-05T03:39:59Z').nextLocal,'05:40');
 assert.equal(state('2026-03-29T03:39:59Z').nextLocal,'05:40');
 assert.equal(state('2026-10-25T03:39:59Z').nextLocal,'04:40');
});
test('GFS integration estimate advises when routing review becomes relevant',()=>{
 const at=state('2026-11-22T09:40:00Z');
 assert.equal(at.progress,0);
 assert.equal(at.stage,'loading');
 const review=state('2026-11-22T10:10:00Z');
 assert.equal(review.stage,'consult');
 assert.equal(review.progress,37);
 assert.equal(review.status,'CONSULTATION PERTINENTE');
 const ready=state('2026-11-22T11:00:00Z');
 assert.equal(ready.progress,100);
 assert.equal(ready.stage,'ready');
 assert.equal(ready.status,'MÉTÉO À CONSULTER');
});
test('active courses and records replace the right-column ranking area with a GFS widget',()=>{
 const cardCode=js.slice(js.indexOf('function card(r){'),js.indexOf('/* Ajustement dynamique'));
 assert.match(cardCode,/const isLive=status==='live'\|\|status==='record-live'/);
 assert.match(cardCode,/\(isLive\?gfsCardMarkup\(\):\(status==='planned'/);
 assert.match(cardCode,/\?plannedRightColumnMarkup\(r\):rankContent\)/);
 assert.doesNotMatch(cardCode,/rankContent\+\s*\(isLive\?gfsCardMarkup/);
 assert.match(css,/\.race-card-right \.race-gfs-widget\{[\s\S]*?width:100%/);
 assert.doesNotMatch(css,/\.race-gfs-widget\{\s*grid-column:1 \/ -1/);
 assert.match(css,/@media\(max-width:580px\)\{[\s\S]*?\.race-gfs-widget/);
 const markup=gfsCardMarkup();
 assert.match(markup,/data-gfs-widget/);
 assert.match(markup,/estimation/);
 assert.match(markup,/role="progressbar"/);
 assert.match(markup,/data-gfs-countdown/);
});
test('GFS timer updates progress and countdown in place without remounting images',()=>{
 const dom=new JSDOM('<section id="cards"><article>'+gfsCardMarkup()+
  '<img id="race-image" src="data:image/png;base64,AAAA"></article></section>');
 const original=global.document;
 try{
  global.document=dom.window.document;
  const widget=dom.window.document.querySelector('[data-gfs-widget]');
  const img=dom.window.document.querySelector('#race-image');
  updateGfsWidgets(Date.parse('2026-11-22T10:10:00Z'));
  assert.equal(widget.dataset.gfsStage,'consult');
  assert.equal(widget.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),'37');
  assert.equal(widget.querySelector('[data-gfs-percent]').textContent,'37 %');
  assert.equal(widget.querySelector('[data-gfs-next-label]').textContent,'PROCHAINE MAJ · 16:40');
  assert.equal(widget.querySelector('[data-gfs-countdown]').textContent,'05:30:00');
  assert.equal(img,dom.window.document.querySelector('#race-image'),'image DOM node must be preserved');
  updateGfsWidgets(Date.parse('2026-11-22T11:00:00Z'));
  assert.equal(widget.dataset.gfsStage,'ready');
  assert.equal(widget.querySelector('[data-gfs-percent]').textContent,'100 %');
 }finally{
  if(original===undefined)delete global.document;
  else global.document=original;
  dom.window.close();
 }
});

test('upcoming course briefing uses only GFS cycles usable before departure',()=>{
 const winter=gfsBriefingForDeparture(
  Date.parse('2026-11-22T16:00:00Z'),Date.parse('2026-11-22T07:00:00Z'));
 assert.equal(winter.usableLocal,'10:40');
 assert.equal(winter.consultLocal,'12:00');
 assert.equal(winter.followingLocal,'16:40');
 assert.equal(winter.loadsAtDeparture,true);
 assert.equal(winter.phase,'pending');
 const review=gfsBriefingForDeparture(
  Date.parse('2026-11-22T16:00:00Z'),Date.parse('2026-11-22T12:00:00Z'));
 assert.equal(review.phase,'review');
 const summer=gfsBriefingForDeparture(
  Date.parse('2026-07-22T15:00:00Z'),Date.parse('2026-07-22T07:00:00Z'));
 assert.equal(summer.usableLocal,'11:40');
 assert.equal(summer.consultLocal,'13:00');
 assert.equal(summer.followingLocal,'17:40');
 assert.equal(summer.loadsAtDeparture,false);
 assert.equal(gfsBriefingForDeparture(Date.now()-10000),null);
});
test('pre-departure GFS timetable stays correct across spring and autumn clock changes',()=>{
 const spring=gfsBriefingForDeparture(
  Date.parse('2026-03-29T09:00:00Z'),Date.parse('2026-03-29T05:00:00Z'));
 assert.equal(spring.usableLocal,'05:40');
 assert.equal(spring.followingLocal,'11:40');
 const autumn=gfsBriefingForDeparture(
  Date.parse('2026-10-25T10:00:00Z'),Date.parse('2026-10-25T05:00:00Z'));
 assert.equal(autumn.usableLocal,'04:40');
 assert.equal(autumn.followingLocal,'10:40');
});
test('briefing updates a status label without replacing race photo or card',()=>{
 const original=global.document;
 const dom=new JSDOM('<section id="cards"><article><img id="poster">'+
  '<aside data-gfs-briefing data-gfs-ready="3000" data-gfs-departure="20000" data-gfs-briefing-phase="pending">'+
  '<span data-gfs-briefing-status>À PRÉPARER</span></aside></article></section>');
 try{
  global.document=dom.window.document;
  const image=dom.window.document.querySelector('#poster');
  const briefing=dom.window.document.querySelector('[data-gfs-briefing]');
  updateGfsBriefings(3000);
  assert.equal(briefing.dataset.gfsBriefingPhase,'review');
  assert.equal(briefing.querySelector('[data-gfs-briefing-status]').textContent,'À CONSULTER');
  assert.equal(dom.window.document.querySelector('#poster'),image);
  updateGfsBriefings(20000);
  assert.equal(briefing.querySelector('[data-gfs-briefing-status]').textContent,'DÉPART À VÉRIFIER');
 }finally{
  if(original===undefined)delete global.document;
  else global.document=original;
  dom.window.close();
 }
});
