const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const E=require('../regatta/team-engine.js');
const id=(type,x)=>'lpdb-'+type+'-'+x;
const m=(x,status='active',from='',until='')=>({id:id('member',x),type:'team-member',name:x,status,from,until});
const r=(x,dateEnd,vsr='vsr2',status='finished',results=[],stageGroup='')=>({
 id:id('race',x),type:'team-race',name:x,dateEnd,vsr,status,results,stageGroup
});
const rr=(x,position,status='finished')=>({skipperId:id('member',x),position,status});
test('official barème preserves original 13-member VSR2 and reaches HC 1000 at 50',()=>{
 assert.equal(E.primary('vsr2',13,1),200);
 assert.equal(E.primary('vsr2',13,2),190);
 assert.equal(E.primary('vsr2',13,13),80);
 assert.equal(E.primary('hc',50,1),1000);
 assert.equal(E.primary('hc',50,50),138);
 assert.ok(E.primary('hc',50,1)>E.primary('hc',45,1));
 assert.ok(E.primary('hc',45,1)>E.primary('hc',40,1));
 assert.ok(E.primary('hc',50,1)>E.primary('vsr1',50,1));
});
test('historical bonus ends at one point for 50th, with 3 declining tiers',()=>{
 for(const [rank,points] of [[1,200],[2,190],[14,70],[15,65],[22,30],[23,28],[24,27],[25,26],[49,2],[50,1]])assert.equal(E.historical(rank),points);
 assert.equal(E.historical(51),0);
});
test('finished race counts DNF, but gives it zero in both score modes',()=>{
 const roster=[m('Alpha'),m('Beta'),m('Gamma')];
 const race=r('test','2026-11-25','hc','finished',[rr('Alpha',1),rr('Beta',2),rr('Gamma',null,'dnf')]);
 const team=new Map(roster.map(x=>[x.id,x]));
 assert.equal(E.verifyRace(race,team),'');
 const scores=E.scoredRace(race,team);
 assert.equal(scores.length,3);
 assert.equal(scores[2].main,0);
 assert.equal(scores[2].historic,0);
 const ranking=E.standings([...roster,race],{type:'month',value:'2026-11'},'main');
 assert.equal(ranking.skippers.length,3);
 assert.equal(ranking.skippers.find(x=>x.name==='Gamma').participations,1);
 assert.equal(ranking.skippers.find(x=>x.name==='Gamma').points,0);
});
test('unfinished and incomplete races never alter period standings',()=>{
 const roster=[m('Alpha'),m('Beta')];
 const incomplete=r('unfinished','2026-11-26','hc','finished',[rr('Alpha',1),rr('Beta',null,'pending')]);
 const live=r('live','2026-11-24','hc','live',[rr('Alpha',1),rr('Beta',2)]);
 assert.equal(E.standings([...roster,incomplete,live],{type:'year',value:'2026'}).skippers.length,0);
 assert.ok(E.verifyRace(incomplete,new Map(roster.map(x=>[x.id,x]))));
});
test('reject duplicate positions and unknown skippers',()=>{
 const roster=[m('Alpha'),m('Beta')],known=new Map(roster.map(x=>[x.id,x]));
 const race=r('invalid','2026-11-25','vsr2','finished',[rr('Alpha',1),rr('Beta',1)]);
 assert.match(E.verifyRace(race,known),/même position/);
 assert.deepEqual(E.scoredRace(race,known),[]);
});
test('periods use race finish date and include all races, never preliminary points',()=>{
 const roster=[m('Alpha'),m('Beta')];
 const a=r('march','2027-03-31','vsr2','finished',[rr('Alpha',1),rr('Beta',2)]);
 const b=r('april','2027-04-01','vsr2','finished',[rr('Alpha',2),rr('Beta',1)]);
 const records=[...roster,a,b];
 assert.equal(E.standings(records,{type:'month',value:'2027-03'}).races.length,1);
 assert.equal(E.standings(records,{type:'quarter',value:'2027-Q2'}).races.length,1);
 assert.equal(E.standings(records,{type:'year',value:'2027'}).races.length,2);
 assert.equal(E.standings(records,{type:'custom',from:'2027-03-30',to:'2027-04-01'}).races.length,2);
});
test('former members remain visible in period with participation and absent members excluded',()=>{
 const roster=[m('Alpha','former'),m('Beta'),m('Ghost','former')];
 const race=r('score','2026-11-25','vsr3','finished',[rr('Alpha',1),rr('Beta',2)]);
 const model=E.standings([...roster,race],{type:'year',value:'2026'});
 assert.equal(model.skippers.length,2);
 assert.equal(model.skippers.find(x=>x.name==='Alpha').status,'former');
 assert.ok(!model.skippers.some(x=>x.name==='Ghost'));
});
test('scoring adapts whenever participant set changes',()=>{
 const roster=['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'].map(x=>m(x));
 const a=r('score','2026-11-25','hc','finished',roster.slice(0,14).map((x,i)=>rr(x.name,i+1)));
 const b={...a,results:[...a.results,rr('O',null,'dnf')]};
 assert.ok(E.scoredRace(b,new Map(roster.map(x=>[x.id,x])))[0].main>E.scoredRace(a,new Map(roster.map(x=>[x.id,x])))[0].main);
});
test('every step is independent, combined stage leaderboard awards no new points',()=>{
 const roster=[m('Alpha'),m('Beta')];
 const one=r('leg1','2027-04-10','vsr2','finished',[rr('Alpha',1),rr('Beta',2)],'Tour');
 const two=r('leg2','2027-04-30','vsr2','finished',[rr('Alpha',2),rr('Beta',1)],'Tour');
 const other=r('separate','2027-04-12','hc','finished',[rr('Alpha',1),rr('Beta',2)]);
 const bonus=E.stageBonus([...roster,one,two,other],'Tour');
 const period=E.standings([...roster,one,two,other],{type:'month',value:'2027-04'});
 assert.equal(bonus.races.length,2);assert.equal(period.races.length,3);
});
test('current roster limit is separate from historic ranking length',()=>{
 const roster=Array.from({length:58},(_,i)=>m('P'+i,i<50?'active':'former'));
 assert.equal(roster.filter(x=>x.status==='active').length,50);
 assert.equal(E.normalize(roster).length,58);
});
test('skipper can leave and rejoin while attendance ignores gap races',()=>{
 const skipper=m('Alpha','active','2027-01-01','');
 skipper.memberships=[{from:'2027-01-01',until:'2027-01-31'},{from:'2027-03-01',until:''}];
 const opponent=m('Beta');
 const jan=r('jan','2027-01-08','vsr2','finished',[rr('Alpha',1),rr('Beta',2)]);
 const feb=r('feb','2027-02-08','vsr2','finished',[rr('Beta',1)]);
 const mar=r('mar','2027-03-08','vsr2','finished',[rr('Alpha',2),rr('Beta',1)]);
 const board=E.standings([skipper,opponent,jan,feb,mar],{type:'year',value:'2027'});
 const alpha=board.skippers.find(x=>x.name==='Alpha');
 assert.equal(alpha.participations,2);
 assert.equal(alpha.attendance,100);
 assert.equal(alpha.finished,2);
 assert.equal(E.normalize([skipper])[0].memberships.length,2);
});

test('linked personal race supplies shared details without overwriting team results',()=>{
 const team=r('Linked','2026-11-25','vsr2','finished',[rr('Alpha',1),rr('Beta',2)]);
 const personal={id:'personal-56',kind:'race',name:'Route du Rhum',boatClass:'IMOCA',vsr:'hc',
  start:'2026-11-10',startTime:'11:30',end:'2026-11-29',endTime:'10:05',
  routeType:'transatlantique',equipment:'pdd',timezone:'Europe/Paris'};
 const linked=E.fromPersonal(personal,team);
 assert.equal(linked.personalRaceId,'personal-56');
 assert.equal(linked.status,'finished');
 assert.deepEqual(linked.results,team.results);
 assert.equal(linked.boatClass,'IMOCA');
 assert.equal(linked.dateEnd,'2026-11-25');
 assert.equal(linked.equipment,'','equipment is not shared by the team');
 const updated=E.resolveLinkedRace(linked,{...personal,name:'Route du Rhum 2027',end:'2026-12-03',vsr:'vsr1'});
 assert.equal(updated.name,'Route du Rhum 2027');
 assert.equal(updated.dateEnd,'2026-11-25','individual arrival must not change team period');
 assert.equal(updated.vsr,'vsr1');
 assert.equal(updated.status,'finished');
 assert.deepEqual(updated.results,team.results);
 assert.equal(E.resolveLinkedRace(linked,null).name,'Route du Rhum');
 assert.deepEqual(E.normalize([linked])[0],linked);
});
test('personal/team linking is available in both editors and respects read-only access',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 const teamApp=fs.readFileSync('regatta/team-app.js','utf8');
 const d=new JSDOM(html).window.document;
 for(const id of ['team-race-personal','team-linked-help','team-race-class','team-race-start','team-race-date'])assert.ok(d.getElementById(id));
 assert.match(html,/data-action="team-link"/);
 assert.match(teamApp,/link-existing/);
 assert.match(teamApp,/new-personal/);
 assert.match(teamApp,/open-personal/);
 assert.match(app,/linkTeamAfterPersonalSave/);
 assert.match(app,/startPersonalFromTeam/);
 assert.match(app,/renderTeam\(\)/);
});

test('editor, selectors, and PNG elements are present without removing personal archive',()=>{
 const doc=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 for(const id of ['team-panel','team-races-panel','team-skippers-panel','team-stats-panel','team-race-form','team-member-form','team-profile-dialog','view-races','races-panel'])assert.ok(doc.getElementById(id),id);
 for(const script of ['team-engine.js','team-app.js'])assert.ok([...doc.querySelectorAll('script')].some(el=>el.getAttribute('src')===script),script);
 const code=fs.readFileSync('regatta/team-app.js','utf8');
 const png=fs.readFileSync('regatta/team-export.js','utf8');
 assert.ok(code.includes("exportStandings"));
 assert.ok(code.includes("RapliTeamExport.exportPng"));
 assert.ok(png.includes("toBlob"));
 const app=fs.readFileSync('regatta/app.js','utf8');
 assert.ok(app.includes('teamRecords'));
 assert.ok(app.includes('window.RapliTeamUI?.init?.'));
});


test('one LPDB main tab contains the four team subsections',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const main=d.querySelector('.workspace-tabs');
 assert.ok(main);
 assert.equal(main.querySelectorAll('[id^="view-team"]').length,1);
 assert.equal(main.querySelector('#view-team').textContent.trim(),'LPDB');
 assert.equal(main.querySelector('#view-team').getAttribute('aria-controls'),'lpdb-panel');
 const shell=d.getElementById('lpdb-panel');
 assert.ok(shell);
 const ids=['team','team-races','team-skippers','team-stats'];
 const tablist=shell.querySelector('.lpdb-tabs');
 assert.equal(tablist.querySelectorAll('.lpdb-tab').length,4);
 assert.deepEqual([...tablist.querySelectorAll('button')].map(b=>b.id),ids.map(x=>'lpdb-view-'+x));
 for(const id of ids){
  const tab=d.getElementById('lpdb-view-'+id),panel=d.getElementById(id+'-panel');
  assert.equal(tab.getAttribute('aria-controls'),panel.id);
  assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
  assert.equal(panel.closest('#lpdb-panel'),shell);
 }
 for(const id of ['races','stats','honors'])assert.ok(d.getElementById('view-'+id),'personal workspace remains independent');
});
test('LPDB secondary navigation changes panels without losing main workspace',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const src=fs.readFileSync('regatta/app.js','utf8');
 const start=src.indexOf("const lpdbViews=['team'");
 const end=src.indexOf('const scoreDialog=',start);
 assert.ok(start>0&&end>start,'workspace selectors found');
 const ctx={
  $:id=>d.getElementById(id),renderTeam:()=>{},
  renderStatistics:()=>{},renderHonors:()=>{},renderClassColors:()=>{}
 };
 const methods=new Function('ctx','with(ctx){'+src.slice(start,end)+';return {selectWorkspace};}')(ctx);
 methods.selectWorkspace('team-races');
 assert.equal(d.getElementById('lpdb-panel').hidden,false);
 assert.equal(d.getElementById('view-team').getAttribute('aria-selected'),'true');
 assert.equal(d.getElementById('team-panel').hidden,true);
 assert.equal(d.getElementById('team-races-panel').hidden,false);
 assert.equal(d.getElementById('lpdb-view-team-races').getAttribute('aria-selected'),'true');
 methods.selectWorkspace('races');
 assert.equal(d.getElementById('lpdb-panel').hidden,true);
 assert.equal(d.getElementById('races-panel').hidden,false);
 methods.selectWorkspace('team');
 assert.equal(d.getElementById('team-races-panel').hidden,true,'returning to LPDB resets to Championnat');
 assert.equal(d.getElementById('team-panel').hidden,false,'Championnat must be visible');
 assert.equal(d.getElementById('lpdb-view-team').getAttribute('aria-selected'),'true');
 methods.selectWorkspace('team-stats');
 assert.equal(d.getElementById('team-stats-panel').hidden,false);
 assert.equal(d.getElementById('team-races-panel').hidden,true);
 assert.equal(d.getElementById('lpdb-view-team-stats').getAttribute('aria-selected'),'true');
});


test('batch skipper import parses one nonempty line per member and skips duplicate names',()=>{
 const existing=[m('RX8'),m('Mat_LH','former')];
 const result=E.prepareMemberBatch('  Tomza  \r\nRX8\n\nTomza\n  Débi \nMat_LH\n',existing);
 assert.deepEqual(result.accepted,['Tomza','Débi']);
 assert.deepEqual(result.duplicates.map(x=>x.name),['RX8','Tomza','Mat_LH']);
 assert.equal(result.invalid.length,0);
 assert.equal(result.available,49);
 assert.equal(result.overflow,0);
});
test('batch skipper import detects accent / case / whitespace duplicates consistently',()=>{
 const result=E.prepareMemberBatch('Lucasiz29\nLUCASIZ29\n  Mat   LH  \nmat lh\n',[]);
 assert.deepEqual(result.accepted,['Lucasiz29','Mat   LH']);
 assert.deepEqual(result.duplicates.map(x=>x.line),[2,4]);
 const fromExisting=E.prepareMemberBatch('mat lh\n',[m('Mat   LH')]);
 assert.equal(fromExisting.accepted.length,0);
 assert.equal(fromExisting.duplicates.length,1);
});
test('batch skipper import preserves original line numbers and flags invalid names',()=>{
 const result=E.prepareMemberBatch('\nAlpha\n'+('x'.repeat(57))+'\nName\tExtra\nBravo\n',[]);
 assert.deepEqual(result.accepted,['Alpha','Bravo']);
 assert.deepEqual(result.invalid.map(x=>x.line),[3,4]);
 assert.equal(result.invalid.length,2);
});
test('batch skipper import refuses overflow beyond 50 active skippers but keeps historic names',()=>{
 const roster=Array.from({length:49},(_,i)=>m('active-'+i));
 roster.push(m('old-member','former'));
 const pending=E.prepareMemberBatch('New A\nNew B\nold-member',roster);
 assert.equal(pending.available,1);
 assert.deepEqual(pending.accepted,['New A','New B']);
 assert.equal(pending.overflow,1);
 assert.equal(pending.duplicates.length,1);
 const withFormer=E.prepareMemberBatch('new member',Array.from({length:58},(_,i)=>m('skip-'+i,i<48?'active':'former')));
 assert.equal(withFormer.available,2);
 assert.equal(withFormer.overflow,0);
});
test('bulk skipper editor and atomic sync are wired into the LPDB team UI',()=>{
 const doc=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const ui=fs.readFileSync('regatta/team-app.js','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 assert.ok(doc.querySelector('#team-bulk-dialog #team-bulk-input'));
 assert.ok(doc.querySelector('#team-bulk-form #team-bulk-submit'));
 assert.match(ui,/bulk-members/);
 assert.match(ui,/prepareMemberBatch/);
 assert.match(ui,/api\.saveBatch\(rows\)/);
 assert.match(app,/function saveTeamMembersBatch/);
 assert.match(app,/saveBatch:saveTeamMembersBatch/);
 assert.match(app,/db\.transaction\('races','readwrite'\)/);
});


test('Virtual Regatta pasted classification yields 8 chronos from winner reference',()=>{
 const time=require('../regatta/team-time.js');
 const source=[
  'Rapli LPDB','09j 15h 32m 50s','indien de provence - LP...','+ 03h 54m 01s',
  '|*] Memphré - LPDB','+ 10h 03m 09s','• Jozarys','+ 14h 34m 43s','5',
  'Danymaill _LPDB','+ 14h 50m 33s','• RX8- LPDB','+ 16h 12m 32s',
  'Ruben LPDB','+ 16h 27m 51s','8','tintinultra76-LPDB','+ 16h 53m 14s'
 ].join('\n');
 const parsed=time.parseClassification(source);
 assert.deepEqual(parsed.errors,[]);
 assert.equal(parsed.entries.length,8);
 assert.equal(parsed.entries[0].name,'Rapli LPDB');
 assert.equal(parsed.entries[2].name,'Memphré - LPDB');
 assert.equal(parsed.entries[4].name,'Danymaill _LPDB');
 assert.equal(parsed.entries[7].position,8);
 assert.equal(parsed.entries[0].gapSeconds,0);
 assert.equal(time.formatTime(parsed.entries[0].elapsedSeconds),'09j 15h 32m 50s');
 assert.equal(time.formatTime(parsed.entries[1].gapSeconds),'03h 54m 01s');
 assert.equal(time.formatTime(parsed.entries[7].elapsedSeconds),'10j 08h 26m 04s');
});
test('Virtual Regatta name reconciliation strips team suffix and preserves unknown names for review',()=>{
 const time=require('../regatta/team-time.js');
 const parsed=time.parseClassification('Rapli LPDB\n09j 15h 32m 50s\nRX8- LPDB\n+ 03h 54m 01s\ninconnu - LP...\n+ 04h');
 const matched=time.matchSkippers(parsed.entries,[m('Rapli'),m('RX8')]);
 assert.equal(matched[0].skipperId,id('member','Rapli'));
 assert.equal(matched[1].skipperId,id('member','RX8'));
 assert.equal(matched[2].skipperId,'');
 assert.equal(time.normalizePseudo('Danymaill _LPDB'),time.normalizePseudo('Danymaill'));
});
test('race time parsing rejects invalid durations and chronos in reversed order',()=>{
 const time=require('../regatta/team-time.js');
 assert.equal(time.parseTime('09j 15h 32m 50s'),9*86400+15*3600+32*60+50);
 assert.equal(time.parseTime('03h 54m 01s'),3*3600+54*60+1);
 assert.equal(time.parseTime('08m 60s'),null);
 assert.equal(time.parseTime('1j 25h'),null);
 assert.equal(time.parseTime('+ 01h 12m'),null);
 assert.equal(time.parseClassification('Rapli LPDB\n09j 15h 32m 50s\nRX8\n+ 30m\nJozarys\n+ 20m').errors.length,1);
 assert.ok(time.parseClassification('Rapli\n+ 01h').errors.length);
});
test('timed race results survive normalization, score both systems and aggregate clocks',()=>{
 const roster=[m('Alpha'),m('Beta'),m('Gamma')];
 const leader=9*86400+15*3600+32*60+50,gap=3*3600+54*60+1;
 const finished=r('timed','2026-12-04','hc','finished',[
  {...rr('Alpha',1),elapsedSeconds:leader,gapSeconds:0},
  {...rr('Beta',2),elapsedSeconds:leader+gap,gapSeconds:gap},
  rr('Gamma',null,'dnf')
 ]);
 const known=new Map(roster.map(x=>[x.id,x]));
 assert.equal(E.verifyRace(finished,known),'');
 const normalized=E.race(finished);
 assert.equal(normalized.results[0].elapsedSeconds,leader);
 assert.equal(normalized.results[1].gapSeconds,gap);
 assert.equal(normalized.results[2].elapsedSeconds,undefined);
 const scores=E.scoredRace(normalized,known);
 assert.equal(scores[0].gapSeconds,0);
 assert.equal(scores[1].elapsedSeconds,leader+gap);
 assert.equal(scores[2].historic,0);
 const ranking=E.standings([...roster,normalized],{type:'year',value:'2026'});
 const alpha=ranking.skippers.find(s=>s.name==='Alpha'),beta=ranking.skippers.find(s=>s.name==='Beta');
 assert.equal(alpha.timedRaces,1);
 assert.equal(alpha.avgGapSeconds,0);
 assert.equal(beta.avgTimeSeconds,leader+gap);
 assert.equal(beta.avgGapSeconds,gap);
 const broken={...normalized,results:normalized.results.map((x,i)=>i===1?{...x,gapSeconds:45}:x)};
 assert.match(E.verifyRace(broken,known),/incohérents/);
});
test('VR quick import UI includes mapping, time editing, classification view and synced bundle saving',()=>{
 const time=require('../regatta/team-time.js');
 assert.ok(time.parseClassification);
 const html=fs.readFileSync('regatta/index.html','utf8'),ui=fs.readFileSync('regatta/team-app.js','utf8'),app=fs.readFileSync('regatta/app.js','utf8');
 const doc=new JSDOM(html).window.document;
 for(const id of ['team-ranking-paste','team-ranking-import-body','team-ranking-apply','team-ranking-analysis','team-race-classification-dialog'])assert.ok(doc.getElementById(id));
 assert.ok([...doc.querySelectorAll('script')].some(s=>s.getAttribute('src')==='team-time.js'));
 for(const key of ['analyzeRanking','applyRanking','showRaceRanking','data-team-elapsed','data-team-gap','clockLabel','saveRaceBundle'])assert.ok(ui.includes(key),key);
 assert.match(app,/saveTeamRaceBundle/);
 assert.match(app,/saveRaceBundle:saveTeamRaceBundle/);
});


test('VR pasted classification can be previewed, reconciled and saved as one team race',async()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const {window:w}=dom,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=[m('Rapli'),m('RX8')],saved=[];
 w.RapliTeamUI.init({
  get:()=>roster,personal:()=>[],canEdit:()=>true,notify:()=>{},
  saveRaceBundle:async(race,incoming)=>{saved.push({race,incoming});},
  save:async()=>{},remove:async()=>{}
 });
 doc.querySelector('[data-team-action="new-race"]').click();
 const dialog=doc.getElementById('team-race-dialog');
 assert.equal(dialog.open,true);
 doc.getElementById('team-race-name').value='Classement expérimental';
 doc.getElementById('team-race-date').value='2026-12-03';
 doc.getElementById('team-race-status').value='finished';
 doc.getElementById('team-race-status').dispatchEvent(new w.Event('change',{bubbles:true}));
 doc.querySelector('[data-team-action="toggle-ranking-import"]').click();
 doc.getElementById('team-ranking-paste').value='Rapli LPDB\n09j 15h 32m 50s\nRX8-LPDB\n+ 03h 54m 01s\nDanymaill _LPDB\n+ 10h 03m 09s';
 doc.querySelector('[data-team-action="analyze-ranking"]').click();
 assert.equal(doc.querySelectorAll('.team-import-table tbody tr').length,3);
 assert.equal(doc.getElementById('team-ranking-apply').disabled,false);
 doc.querySelector('[data-team-action="apply-ranking"]').click();
 assert.equal(doc.querySelectorAll('#team-result-rows .team-result-row').length,3);
 assert.match(doc.getElementById('team-result-rows').textContent,/Danymaill/);
 doc.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 for(let i=0;i<12&&!saved.length;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.length,1);
 assert.equal(saved[0].incoming.length,1);
 assert.equal(saved[0].incoming[0].name,'Danymaill');
 assert.equal(saved[0].race.results.length,3);
 assert.equal(saved[0].race.results[0].elapsedSeconds,9*86400+15*3600+32*60+50);
 assert.equal(saved[0].race.results[1].gapSeconds,3*3600+54*60+1);
 assert.equal(saved[0].race.status,'finished');
 dom.window.close();
});


test('LPDB Championship opens directly after visiting Skippers and a personal workspace',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const src=fs.readFileSync('regatta/app.js','utf8'),start=src.indexOf("const lpdbViews=['team'"),end=src.indexOf('const scoreDialog=',start);
 const ctx={$:id=>d.getElementById(id),renderTeam:()=>{},renderStatistics:()=>{},renderHonors:()=>{},renderClassColors:()=>{}};
 const {selectWorkspace}=new Function('ctx','with(ctx){'+src.slice(start,end)+';return {selectWorkspace};}')(ctx);
 selectWorkspace('team-skippers');
 assert.equal(d.getElementById('team-skippers-panel').hidden,false);
 selectWorkspace('races');
 selectWorkspace('team');
 assert.equal(d.getElementById('lpdb-panel').hidden,false);
 assert.equal(d.getElementById('team-panel').hidden,false);
 assert.equal(d.getElementById('team-skippers-panel').hidden,true);
 selectWorkspace('team-races');
 selectWorkspace('team');
 assert.equal(d.getElementById('team-panel').hidden,false);
 assert.equal(d.getElementById('team-races-panel').hidden,true);
});
test('team race cards use personal-style columns without shared arrival or equipment',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8'),ui=fs.readFileSync('regatta/team-app.js','utf8');
 const css=fs.readFileSync('regatta/team.css','utf8');
 const doc=new JSDOM(html).window.document;
 assert.match(doc.getElementById('team-race-date').closest('label').textContent,/CLÔTURE DU CLASSEMENT/);
 assert.equal(doc.querySelector('#team-race-end-time'),null);
 assert.equal(doc.querySelector('#team-race-equipment'),null);
 for(const term of ['team-race-photo','team-race-left','team-race-right','team-race-status','team-race-topline','team-race-menu','team-race-points'])assert.ok(ui.includes(term),term);
 assert.match(css,/\.team-race-card \.team-race-layout/);
 assert.ok(!ui.includes("r.equipment].filter(Boolean)"));
});
test('rendered LPDB cards omit team finish dates even when personal finish exists',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const members=[m('Alpha'),m('Beta')];
 const linked=E.fromPersonal({id:'personal-42',kind:'race',name:'Atlantic Sprint',boatClass:'IMOCA',
   vsr:'vsr2',start:'2027-04-03',end:'2027-04-18',endTime:'23:15',equipment:'pdd'},r('trial','2027-04-20','vsr2','finished',[rr('Alpha',1),rr('Beta',2)]));
 w.RapliTeamUI.init({get:()=>[...members,linked],personal:()=>[{id:'personal-42',kind:'race',name:'Atlantic Sprint',
  boatClass:'IMOCA',vsr:'vsr2',start:'2027-04-03',end:'2027-04-18',endTime:'23:15',equipment:'pdd'}],
  canEdit:()=>false,notify:()=>{},save:async()=>{},remove:async()=>{}});
 const card=d.querySelector('#team-races-panel .team-race-card');
 assert.ok(card);
 assert.ok(card.querySelector('.team-race-left'));
 assert.ok(card.querySelector('.team-race-right'));
 assert.ok(card.querySelector('.team-race-menu>summary'));
 assert.match(card.textContent,/Atlantic Sprint/);
 assert.match(card.textContent,/DÉPART DE LA COURSE/);
 assert.ok(!card.textContent.includes('2027-04-18'),'personal finish must not show');
 assert.ok(!card.textContent.includes('2027-04-20'),'team closure must not appear as arrival');
 assert.ok(!card.textContent.includes('PDD'),'personal equipment must not show');
 assert.equal(card.querySelectorAll('.team-race-figures>div').length,3);
 dom.window.close();
});


test('overall VR rank is an optional independent integer and survives team race normalization',()=>{
 const roster=[m('Alpha'),m('Beta')],known=new Map(roster.map(x=>[x.id,x]));
 const base=r('overall','2027-02-15','vsr1','finished',[
  {...rr('Alpha',1),generalRank:42},{...rr('Beta',2),generalRank:1203}
 ]);
 const withOverall=E.race(base);
 assert.deepEqual(withOverall.results.map(x=>x.generalRank),[42,1203]);
 assert.equal(E.verifyRace(withOverall,known),'');
 const scored=E.scoredRace(withOverall,known);
 assert.deepEqual(scored.map(x=>x.generalRank),[42,1203]);
 const noOverall=E.race({...base,results:[rr('Alpha',1),rr('Beta',2)]});
 assert.deepEqual(E.scoredRace(noOverall,known).map(x=>x.main),scored.map(x=>x.main));
 assert.deepEqual(E.scoredRace(noOverall,known).map(x=>x.historic),scored.map(x=>x.historic));
 assert.deepEqual(noOverall.results.map(x=>x.generalRank),[undefined,undefined]);
 const board=E.standings([...roster,withOverall],{type:'year',value:'2027'});
 assert.equal(board.skippers.find(x=>x.name==='Alpha').bestGeneralRank,42);
 assert.equal(board.skippers.find(x=>x.name==='Beta').generalRankedRaces,1);
 const invalid={...withOverall,results:withOverall.results.map((x,i)=>i?x:{...x,generalRank:-1})};
 assert.match(E.verifyRace(invalid,known),/général VR invalide/);
});
test('LPDB foil is silver and overall VR ranking appears in editor, profile and exports',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const ui=fs.readFileSync('regatta/team-app.js','utf8');
 const styles=fs.readFileSync('regatta/team.css','utf8');
 const doc=new JSDOM(html).window.document;
 assert.match(doc.querySelector('.team-result-head').textContent,/CLASSEMENT GÉNÉRAL VR/);
 assert.match(ui,/data-team-general-rank/);
 assert.match(ui,/GÉNÉRAL VR/);
 assert.match(fs.readFileSync('regatta/team-export.js','utf8'),/GÉN\. VR/);
 assert.match(ui,/generalRank:s\.generalRank/);
 assert.match(styles,/--lpdb-foil:/);
 assert.match(styles,/team-result-row input\[data-team-general-rank\]/);
 assert.match(styles,/\.lpdb-shell \.team-panel\{color:#30353a/);
});
test('user can edit overall VR rankings in a pasted classification without changing LPDB points',async()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const {window:w}=dom,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=[m('Rapli'),m('RX8')],saved=[];
 w.RapliTeamUI.init({get:()=>roster,personal:()=>[],canEdit:()=>true,notify:()=>{},
  saveRaceBundle:async(race,incoming)=>{saved.push({race,incoming});},save:async()=>{},remove:async()=>{}});
 doc.querySelector('[data-team-action="new-race"]').click();
 doc.getElementById('team-race-name').value='Course VR';
 doc.getElementById('team-race-date').value='2027-03-20';
 doc.getElementById('team-race-status').value='finished';
 doc.getElementById('team-race-status').dispatchEvent(new w.Event('change',{bubbles:true}));
 doc.querySelector('[data-team-action="toggle-ranking-import"]').click();
 doc.getElementById('team-ranking-paste').value='Rapli LPDB\n09j 15h 32m 50s\nRX8\n+ 01h 00m 00s';
 doc.querySelector('[data-team-action="analyze-ranking"]').click();
 doc.querySelector('[data-team-action="apply-ranking"]').click();
 const ranks=[...doc.querySelectorAll('#team-result-rows input[data-team-general-rank]')];
 assert.equal(ranks.length,2);
 ranks[0].value='22';ranks[0].dispatchEvent(new w.Event('input',{bubbles:true}));
 ranks[1].value='1342';ranks[1].dispatchEvent(new w.Event('input',{bubbles:true}));
 doc.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 for(let i=0;i<12&&!saved.length;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.length,1);
 assert.deepEqual(saved[0].race.results.map(x=>x.generalRank),[22,1342]);
 assert.deepEqual(saved[0].race.results.map(x=>x.position),[1,2]);
 dom.window.close();
});


test('LPDB race scores reuse personal scoring without equipment, on /100',()=>{
 const root={};
 new Function('window',fs.readFileSync('regatta/score.js','utf8'))(root);
 new Function('window',fs.readFileSync('regatta/team-rating.js','utf8'))(root);
 const [a,b]=[m('Alpha'),m('Beta')],known=new Map([[a.id,a],[b.id,b]]);
 const race=r('rated','2027-05-22','hc','finished',[
  {...rr('Alpha',1),generalRank:290},{...rr('Beta',2),generalRank:456}
 ]);
 race.start='2027-05-01';race.boatClass='IMOCA';race.fleetTotal=20000;
 const saved=E.race({...race,equipment:'pdd'});
 const other=E.race({...race,equipment:'full-pack'});
 const one=root.RapliTeamRating.calculate(saved,[saved],known,E,root.RapliRegattaScore);
 const two=root.RapliTeamRating.calculate(other,[other],known,E,root.RapliRegattaScore);
 assert.equal(one.rated,2);
 assert.equal(one.average,78.5);
 assert.deepEqual([...one.scores.values()].map(s=>s.value),[79,78]);
 assert.deepEqual([...one.scores.values()].map(s=>s.value),[...two.scores.values()].map(s=>s.value));
 assert.equal(one.scores.get(a.id).parts.equipment,undefined);
 assert.deepEqual(root.RapliTeamRating.WEIGHTS,{relative:43.75,progress:25,vsr:12.5,attendance:18.75});
});
test('LPDB race rating remains unavailable with missing VR rank or global fleet',()=>{
 const root={};new Function('window',fs.readFileSync('regatta/score.js','utf8'))(root);
 new Function('window',fs.readFileSync('regatta/team-rating.js','utf8'))(root);
 const [a,b,c]=[m('Alpha'),m('Beta'),m('Gamma')],known=new Map([a,b,c].map(x=>[x.id,x]));
 const race=r('partial','2027-05-22','vsr2','finished',[
  {...rr('Alpha',1),generalRank:100},rr('Beta',2),rr('Gamma',null,'dnf')
 ]);
 race.start='2027-05-01';race.boatClass='IMOCA';race.fleetTotal=1000;
 const saved=E.race(race);
 const results=root.RapliTeamRating.calculate(saved,[saved],known,E,root.RapliRegattaScore);
 assert.equal(results.eligible,2);
 assert.equal(results.rated,1);
 assert.equal(results.scores.get(a.id).available,true);
 assert.equal(results.scores.get(b.id).available,false);
 assert.equal(results.scores.has(c.id),false);
 assert.equal(results.average,results.scores.get(a.id).value);
 const noFleet=E.race({...race,fleetTotal:null});
 const empty=root.RapliTeamRating.calculate(noFleet,[noFleet],known,E,root.RapliRegattaScore);
 assert.equal(empty.average,null);
 assert.equal(empty.rated,0);
 assert.equal(empty.scores.get(a.id).available,false);
 const planning=E.race({...race,status:'live'});
 assert.equal(root.RapliTeamRating.calculate(planning,[planning],known,E,root.RapliRegattaScore).rated,0);
});
test('LPDB tile removes personal-link label and adds mean rating while classification scrolls',()=>{
 const ui=fs.readFileSync('regatta/team-app.js','utf8');
 const css=fs.readFileSync('regatta/team.css','utf8');
 const html=fs.readFileSync('regatta/index.html','utf8');
 const d=new JSDOM(html).window.document;
 assert.ok(d.getElementById('team-race-fleet'));
 assert.ok([...d.querySelectorAll('script')].some(x=>x.getAttribute('src')==='team-rating.js'));
 assert.equal(ui.includes('↔ Fiche « Mes courses » associée'),false);
 assert.match(ui,/NOTE MOYENNE DE LA COURSE/);
 assert.match(ui,/<th>NOTE \/100<\/th>/);
 assert.match(ui,/rating\.calculate/);
 assert.match(css,/#team-race-classification-dialog\[open\]/);
 assert.match(css,/#team-classification-body\{flex:1 1 auto;min-height:0/);
 assert.match(css,/overflow-y:auto;overflow-x:hidden/);
 assert.match(css,/\.team-race-average/);
});
test('LPDB classification dialog renders an independent note for each skipper',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const [a,b]=[m('Alpha'),m('Beta')];
 const race=E.race({...r('rating','2027-05-22','hc','finished',[
  {...rr('Alpha',1),generalRank:290},{...rr('Beta',2),generalRank:456}
 ]),start:'2027-05-01',boatClass:'IMOCA',fleetTotal:20000});
 w.RapliTeamUI.init({get:()=>[a,b,race],personal:()=>[],canEdit:()=>false,notify:()=>{},
  save:async()=>{},remove:async()=>{}});
 const tile=d.querySelector('.team-race-card');
 assert.ok(tile);
 assert.match(tile.textContent,/NOTE MOYENNE DE LA COURSE/);
 assert.match(tile.textContent,/78,5\/100/);
 d.querySelector('[data-team-action="show-ranking-'+race.id+'"]').click();
 const dialog=d.getElementById('team-race-classification-dialog');
 assert.equal(dialog.open,true);
 const noteHeader=[...dialog.querySelectorAll('th')].find(x=>x.textContent.includes('NOTE'));
 assert.ok(noteHeader);
 const cells=dialog.querySelectorAll('tbody tr');
 assert.equal(cells.length,2);
 assert.match(cells[0].textContent,/79\/100/);
 assert.match(cells[1].textContent,/78\/100/);
 dom.window.close();
});


test('premium export makes exactly one image with dynamic height for 50 skippers',()=>{
 const out=require('../regatta/team-export.js');
 const ctx={font:'',measureText:text=>({width:[...String(text)].length*13})};
 const rows=Array.from({length:50},(_,i)=>({
  rank:i+1,name:'Skipper LPDB numéro '+(i+1)+' avec un pseudo très long conservé intégralement',
  generalRank:100+i,elapsedSeconds:900000+i*100,gapSeconds:i*100,
  points:1000-i,note:{available:true,value:90-i}
 }));
 const full=out.plan(rows,{ctx,race:true,style:'table',limit:0});
 assert.equal(full.items.length,50);
 assert.ok(full.height>4000,'one long adaptive PNG covers all 50 skippers');
 assert.equal(full.width,1500);
 const count25=out.plan(rows.slice(0,25),{ctx,race:true,style:'table'});
 assert.ok(full.height>count25.height);
 assert.equal(full.items[0].nameLines.join(' ').replace(/\s+/g,' '),rows[0].name);
 const top10=out.plan(rows,{ctx,race:true,style:'social',limit:10});
 const podium=out.plan(rows,{ctx,race:true,style:'social',limit:3});
 assert.equal(top10.items.length,10);
 assert.equal(podium.items.length,3);
 assert.equal(podium.podium,true);
 assert.equal(top10.top10,true);
 assert.ok(full.height<16000,'single PNG stays within ordinary canvas limits');
});
test('premium export handles one long unspaced pseudo without ellipsis or slicing',()=>{
 const out=require('../regatta/team-export.js'),ctx={measureText:text=>({width:[...String(text)].length*21})};
 const pseudo='pseudonymeLPDBextrêmementLongSansEspaceAvecDesCaractèresÀConserverEntièrement';
 const wrapped=out.wrapText(ctx,pseudo,190);
 assert.ok(wrapped.length>1);
 assert.equal(wrapped.join(''),pseudo);
 assert.equal(out.duration(9*86400+15*3600+32*60+50),'09j 15:32:50');
 assert.equal(out.imageSource('data:image/png;base64,AA=='),'data:image/png;base64,AA==');
 assert.equal(out.imageSource('https://untrusted.invalid/photo.jpg'),null);
});
test('race export passes all 26 skippers, individual notes, original artwork and boat/VSR without pagination',async()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document,calls=[];
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.RapliTeamExport={exportPng:async args=>{
  calls.push(args);return {count:args.rows.length,width:1500,height:3000,fileCount:1};
 }};
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=Array.from({length:26},(_,i)=>m('Pseudo complet du skipper LPDB '+(i+1)));
 const start=9*86400+15*3600+32*60+50;
 const results=roster.map((person,i)=>({
  skipperId:person.id,status:'finished',position:i+1,
  generalRank:100+i,elapsedSeconds:start+i*90,gapSeconds:i*90
 }));
 const race=E.race({
  ...r('route-du-rhum','2026-11-22','hc','finished',results),
  name:'Route du Rhum',boatClass:'IMOCA',start:'2026-11-10',fleetTotal:20000,
  personalRaceId:'personal-illustration'
 });
 const image='data:image/png;base64,AA==';
 w.RapliTeamUI.init({
  get:()=>[...roster,race],
  personal:()=>[{id:'personal-illustration',kind:'race',name:'Route du Rhum',
   icon:image,boatClass:'IMOCA',vsr:'hc',start:'2026-11-10'}],
  canEdit:()=>false,notify:()=>{},save:async()=>{},remove:async()=>{}
 });
 const btn=d.querySelector('[data-team-action="export-race-'+race.id+'"]');
 assert.ok(btn,'race table PNG is reachable via the tile menu');
 btn.click();
 for(let i=0;i<15&&!calls.length;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls.length,1);
 const call=calls[0];
 assert.equal(call.rows.length,26);
 assert.equal(call.limit,0,'export all rows without pagination');
 assert.equal(call.race.illustration,image);
 assert.equal(call.race.boatClass,'IMOCA');
 assert.equal(call.race.vsr,'hc');
 assert.equal(call.race.average!=null,true);
 assert.equal(call.rows[0].name,roster[0].name);
 assert.equal(call.rows[25].name,roster[25].name);
 assert.equal(call.rows[0].note?.available,true);
 assert.equal(call.rows[25].note?.available,true);
 assert.equal(call.rows[25].generalRank,125);
 assert.match(call.filename,/lpdb-course-.*route-du-rhum-main/);
 dom.window.close();
});
