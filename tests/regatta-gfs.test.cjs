const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

const js=fs.readFileSync('regatta/app.js','utf8');
const css=fs.readFileSync('regatta/style.css','utf8');
const from=js.indexOf('/* GFS windows are anchored');
const to=js.indexOf('function raceCardSchedule(r,status){',from);
assert.ok(from>=0&&to>from,'GFS functions are present before the card helper');
const {gfsWeatherState,gfsCardMarkup,updateGfsWidgets}=
 new Function(js.slice(from,to)+';return {gfsWeatherState,gfsCardMarkup,updateGfsWidgets};')();

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
test('each active course or record displays its own responsive GFS block',()=>{
 const cardCode=js.slice(js.indexOf('function card(r){'),js.indexOf('/* Ajustement dynamique'));
 assert.match(cardCode,/const isLive=status==='live'\|\|status==='record-live'/);
 assert.match(cardCode,/\(isLive\?gfsCardMarkup\(\):''\)/);
 assert.match(css,/\.race-gfs-widget\{[\s\S]*?grid-column:1 \/ -1/);
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
