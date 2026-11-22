'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const summary=require('../regatta/gfs-routing-summary.js');

const CYCLE='2026-11-22T00:00:00.000Z';
const frames=(hours,cycle=CYCLE)=>new Map(hours.map(hour=>[hour,{
  forecastHour:hour,cycleUTC:cycle
}]));
const windows=(hours,minutes)=>hours.map((startHour,i)=>({
  startHour,
  valid:minutes[i]!==null,
  elapsedMinutes:minutes[i],
  crossingUTC:minutes[i]===null?null:
    new Date(Date.parse(CYCLE)+(startHour*60+minutes[i])*60000).toISOString()
}));
const engine={
  compareDepartureWindows:()=>({windows:windows([6,7,8,9],[98.7,99.1,99.6,100.2])}),
  compareLaterDepartureWindows:()=>({windows:windows([12,13,14,15],[102.2,103.4,104.7,106.1])}),
  compareEveningDepartureWindows:()=>({windows:windows([18,19,20,21],[113,120.5,130.3,null])}),
  compareNextDayDepartureWindows:()=>({windows:windows([24,25,26,27],[null,null,null,null])})
};
test('le widget ne produit jamais des ETA équateur/Bonne-Espérance sans routage océanique',()=>{
  const result=summary.summarize(frames([6,12,18,24,30,36]),engine);
  assert.deepEqual(result.expectedHours,[6,12,18,24,30,36]);
  assert.deepEqual(result.loadedHours,[6,12,18,24,30,36]);
  assert.equal(result.sameCycle,true);
  assert.equal(result.windowsEvaluated,16);
  assert.equal(result.windowsValid,11);
  assert.equal(result.best.startHour,6);
  assert.equal(result.best.elapsedMinutes,98.7);
  assert.equal(result.equatorETA,null);
  assert.equal(result.capeETA,null);
  assert.equal(result.fullPack,false);
  assert.equal(result.oceanRoutingAvailable,false);
  assert.equal(result.targetLatitude,47);
  assert.equal(result.comparableHorizonHours,3);
});
test('progression partielle : seules les échéances voisines du même cycle sont comparées',()=>{
  const first=summary.summarize(frames([6]),engine);
  assert.equal(first.best,null);
  assert.equal(first.windowsEvaluated,0);
  const second=summary.summarize(frames([6,12]),engine);
  assert.equal(second.windowsEvaluated,4);
  assert.equal(second.windowsValid,4);
  assert.equal(second.best.elapsedMinutes,98.7);
  const missing=summary.summarize(frames([6,18,30]),engine);
  assert.equal(missing.windowsEvaluated,0);
  assert.equal(missing.best,null);
});
test('cycles NOAA différents interdits pour le bilan local',()=>{
  const m=frames([6,12,18]);
  m.get(18).cycleUTC='2026-11-22T06:00:00.000Z';
  const out=summary.summarize(m,engine);
  assert.equal(out.sameCycle,false);
  assert.equal(out.windowsEvaluated,0);
  assert.equal(out.best,null);
  assert.equal(out.cycleUTC,null);
  assert.ok(out.issues.some(i=>i.includes('cycles')));
});
test('une paire sans franchissement ne crée pas de faux temps',()=>{
  const refused={...engine,compareDepartureWindows:()=>{
    throw Error('Aucun départ n’atteint la latitude témoin avec les polaires provisoires.');
  }};
  const out=summary.summarize(frames([6,12]),refused);
  assert.equal(out.windowsEvaluated,4);
  assert.equal(out.windowsValid,0);
  assert.equal(out.best,null);
});
test('des informations incomplètes ne créent pas de fenêtres fictives',()=>{
  const bad={...engine,compareDepartureWindows:()=>({windows:[{
    valid:true,startHour:6,elapsedMinutes:98.7
  }]})};
  const out=summary.summarize(frames([6,12]),bad);
  assert.equal(out.windowsEvaluated,0);
  assert.equal(out.windowsValid,0);
  assert.ok(out.issues.length>0);
});
test('interface initiale : widget lisible, tests repliés, chargement opt-in et script déclaré',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'../regatta/index.html'),'utf8');
  const js=fs.readFileSync(path.resolve(__dirname,'../regatta/gfs-lab.js'),'utf8');
  assert.match(html,/id="regatta-routing-dashboard"/);
  assert.match(html,/data-gfs-dashboard-equator>Non calculable/);
  assert.match(html,/data-gfs-dashboard-cape>Non calculable/);
  assert.match(html,/<details class="gfs-debug-details"/);
  assert.match(html,/<script defer src="gfs-routing-summary.js"><\/script>/);
  assert.ok(html.indexOf('gfs-routing-summary.js')<html.indexOf('gfs-lab.js'));
  assert.match(js,/dashboardLoad\?\.addEventListener\('click'/);
  assert.match(js,/pauseBetweenRequests\(10000\)/);
  assert.match(js,/activeRequestController\?\.abort\(\)/);
  assert.match(js,/renderDashboard\(\)/);
});
