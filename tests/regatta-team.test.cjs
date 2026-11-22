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
test('team courses may reuse existing historical records without exposing personal editors',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 const teamApp=fs.readFileSync('regatta/team-app.js','utf8');
 const d=new JSDOM(html).window.document;
 for(const id of ['team-race-personal','team-linked-help','team-race-class','team-race-start','team-race-date'])assert.ok(d.getElementById(id));
 assert.match(teamApp,/link-existing/);
 assert.match(teamApp,/unlink-personal/);
 assert.ok(!html.includes('data-team-action="new-personal"'));
 assert.ok(!html.includes('data-team-action="open-personal"'));
 assert.ok(!teamApp.includes("menuItem('new-personal-"));
 assert.ok(!teamApp.includes("menuItem('open-personal-"));
 assert.match(app,/linkTeamAfterPersonalSave/,'historical records are still loaded for compatibility');
 assert.match(app,/renderTeam\(\)/);
});

test('editor, selectors, and PNG elements are present without removing personal archive',()=>{
 const doc=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 for(const id of ['team-panel','team-races-panel','team-skippers-panel','team-stats-panel','team-race-form','team-member-form','team-profile-dialog','races-panel'])assert.ok(doc.getElementById(id),id);
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


test('Rapli Regatta becomes an LPDB-only workspace with four team subsections',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 assert.equal(d.querySelector('.workspace-tabs'),null,'no personal workspace navigation remains');
 const shell=d.getElementById('lpdb-panel');
 assert.ok(shell);
 assert.equal(shell.hidden,false,'LPDB is the landing workspace');
 const ids=['team','team-races','team-skippers','team-stats'];
 const tablist=d.querySelector('.regatta-topbar>.lpdb-tabs');
 assert.equal(tablist.querySelectorAll('.lpdb-tab').length,4);
 assert.deepEqual([...tablist.querySelectorAll('button')].map(b=>b.id),ids.map(x=>'lpdb-view-'+x));
 for(const id of ids){
  const tab=d.getElementById('lpdb-view-'+id),panel=d.getElementById(id+'-panel');
  assert.equal(tab.getAttribute('aria-controls'),panel.id);
  assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
  assert.equal(panel.closest('#lpdb-panel'),shell);
 }
 for(const id of ['races','stats','honors']){
  assert.equal(d.getElementById('view-'+id),null,'no visible personal tab for '+id);
  const historic=d.getElementById(id+'-panel');
  assert.ok(historic&&historic.hidden&&historic.hasAttribute('inert'),'legacy '+id+' preserved but inaccessible');
 }
 assert.ok(d.getElementById('colors-panel').hidden,'foil settings can be reached from team courses');
 assert.equal(d.getElementById('vsr-header-ranking').hidden,true,'personal VSR widget is hidden');
});
test('LPDB navigation keeps archives hidden while foil settings remain reachable',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const src=fs.readFileSync('regatta/app.js','utf8');
 const start=src.indexOf("const lpdbViews=['team'");
 const end=src.indexOf('const scoreDialog=',start);
 assert.ok(start>0&&end>start,'LPDB workspace selectors found');
 let colorRenders=0;
 const ctx={$:id=>d.getElementById(id),renderTeam:()=>{},renderClassColors:()=>colorRenders++};
 const {selectWorkspace}=new Function('ctx','with(ctx){'+src.slice(start,end)+';return {selectWorkspace};}')(ctx);
 selectWorkspace('team-races');
 assert.equal(d.getElementById('lpdb-panel').hidden,false);
 assert.equal(d.getElementById('team-panel').hidden,true);
 assert.equal(d.getElementById('team-races-panel').hidden,false);
 assert.equal(d.getElementById('lpdb-view-team-races').getAttribute('aria-selected'),'true');
 for(const forbidden of ['races','stats','honors']){
  selectWorkspace(forbidden);
  assert.equal(d.getElementById('lpdb-panel').hidden,false);
  assert.equal(d.getElementById(forbidden+'-panel').hidden,true);
 }
 selectWorkspace('colors');
 assert.equal(d.getElementById('lpdb-panel').hidden,true);
 assert.equal(d.getElementById('colors-panel').hidden,false);
 assert.equal(colorRenders,1);
 selectWorkspace('team-races');
 assert.equal(d.getElementById('colors-panel').hidden,true);
 assert.equal(d.getElementById('team-races-panel').hidden,false);
 selectWorkspace('team');
 assert.equal(d.getElementById('team-panel').hidden,false);
 assert.equal(d.getElementById('team-races-panel').hidden,true);
 selectWorkspace('team-stats');
 assert.equal(d.getElementById('team-stats-panel').hidden,false);
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


test('LPDB Championship opens directly after Skippers or team foil settings',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const src=fs.readFileSync('regatta/app.js','utf8'),start=src.indexOf("const lpdbViews=['team'"),end=src.indexOf('const scoreDialog=',start);
 const ctx={$:id=>d.getElementById(id),renderTeam:()=>{},renderClassColors:()=>{}};
 const {selectWorkspace}=new Function('ctx','with(ctx){'+src.slice(start,end)+';return {selectWorkspace};}')(ctx);
 selectWorkspace('team-skippers');
 assert.equal(d.getElementById('team-skippers-panel').hidden,false);
 selectWorkspace('colors');
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
 assert.match(ui,/generalRank:score\.generalRank/);
 assert.match(fs.readFileSync('regatta/team-export.js','utf8'),/generalRank/);
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


test('LPDB upcoming and live cards reuse the personal timer, GFS and foil boat components',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,doc=w.document,calls=[];
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.RapliRegattaSharedCards={
  raceClockMarkup:r=>{calls.push('clock:'+r.status);return '<div class="race-live-clock"><strong data-race-clock="'+(r.status==='live'?'elapsed':'countdown')+'" data-start="1800000000000">01:02:03</strong></div>';},
  gfsBriefingMarkup:r=>{calls.push('briefing:'+r.name);return '<aside class="race-gfs-briefing" data-gfs-briefing><strong>BRIEFING MÉTÉO</strong></aside>';},
  gfsCardMarkup:()=>{calls.push('gfs-widget');return '<aside class="race-gfs-widget" data-gfs-widget><strong>MÉTÉO GFS</strong></aside>';},
  liveIconMarkup:()=>'<span class="live-neon" aria-label="En direct"><svg viewBox="0 0 28 28"></svg></span>',
  classTagMarkup:boat=>'<span class="class-tag" style="--class-tag:#d5dade"><svg viewBox="0 0 24 24"></svg>'+boat+'</span>',
  vsrTagMarkup:vsr=>'<span class="vsr-badge" style="--vsr-tag:#dadfe1">'+vsr+'</span>'
 };
 const upcoming=E.race({...r('future-card','2027-08-31','vsr2','planned',[]),
  name:'Départ demain',boatClass:'IMOCA',start:'2027-08-01',startTime:'09:30',timezone:'Europe/Paris'});
 const live=E.race({...r('live-card','2027-08-31','hc','live',[]),
  name:'Océan en cours',boatClass:'ULTIM',start:'2027-07-28',startTime:'16:00',timezone:'Europe/Paris'});
 const finished=E.race({...r('done-card','2027-08-31','vsr1','finished',[rr('Alpha',1),rr('Beta',2)]),
  boatClass:'Class40',start:'2027-07-01',startTime:'09:00'});
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 w.RapliTeamUI.init({get:()=>[m('Alpha'),m('Beta'),upcoming,live,finished],personal:()=>[],
  canEdit:()=>false,notify:()=>{},save:async()=>{},remove:async()=>{}});
 const card=id=>doc.querySelector('[data-team-race="'+id+'"]');
 const plannedCard=card(upcoming.id),liveCard=card(live.id),finishedCard=card(finished.id);
 assert.ok(plannedCard&&liveCard&&finishedCard);
 assert.ok(plannedCard.querySelector('[data-race-clock="countdown"]'));
 assert.ok(plannedCard.querySelector('[data-gfs-briefing]'));
 assert.equal(plannedCard.querySelector('[data-gfs-widget]'),null);
 assert.ok(plannedCard.querySelector('.class-tag[style*="--class-tag"]'));
 assert.ok(plannedCard.querySelector('.vsr-badge[style*="--vsr-tag"]'));
 assert.equal(plannedCard.querySelector('.team-race-points'),null,'no empty points before the race');
 assert.equal(plannedCard.querySelector('.team-race-average'),null);
 assert.equal(plannedCard.querySelector('.team-race-figures'),null);
 assert.ok(plannedCard.querySelector('.team-race-registered'));
 assert.ok(liveCard.querySelector('[data-race-clock="elapsed"]'));
 assert.ok(liveCard.querySelector('.live-neon svg'));
 assert.ok(liveCard.querySelector('[data-gfs-widget]'));
 assert.equal(liveCard.querySelector('[data-gfs-briefing]'),null);
 assert.equal(liveCard.querySelector('.team-race-points'),null,'no zero-point cards on live course');
 assert.ok(finishedCard.querySelector('.team-race-points'));
 assert.ok(finishedCard.querySelector('.team-race-average'));
 assert.equal(finishedCard.querySelector('[data-race-clock]'),null);
 assert.equal(finishedCard.querySelector('[data-gfs-widget]'),null);
 assert.equal(finishedCard.querySelector('[data-gfs-briefing]'),null);
 assert.deepEqual(calls.filter(c=>c.startsWith('clock:')).sort(),['clock:live','clock:planned']);
 assert.deepEqual(calls.filter(c=>c.startsWith('briefing:')),['briefing:Départ demain']);
 assert.equal(calls.filter(c=>c==='gfs-widget').length,1);
 dom.window.close();
});
test('personal GFS clock ticker and configured foil boat settings also serve LPDB cards',()=>{
 const source=fs.readFileSync('regatta/app.js','utf8');
 const style=fs.readFileSync('regatta/team.css','utf8');
 assert.match(source,/window\.RapliRegattaSharedCards=\{/);
 assert.match(source,/gfsBriefingMarkup:r=>gfsBriefingMarkup/);
 assert.match(source,/gfsCardMarkup:\(\)=>gfsCardMarkup\(\)/);
 assert.match(source,/raceClockMarkup:r=>raceClockMarkup/);
 assert.match(source,/classTagMarkup:boatClass=>/);
 assert.match(source,/tagAppearance\('class',boatClass/);
 assert.match(source,/vsrTagMarkup:vsr=>/);
 assert.match(source,/liveIconMarkup:\(\)=>/);
 assert.match(source,/document\.querySelectorAll\('#cards \[data-gfs-widget\], #team-races-panel \[data-gfs-widget\]'\)/);
 assert.match(source,/document\.querySelectorAll\('#cards \[data-gfs-briefing\], #team-races-panel \[data-gfs-briefing\]'\)/);
 assert.match(source,/document\.querySelectorAll\('\[data-race-clock\]'\)/);
 assert.match(source,/setInterval\(updateRaceClocks,1000\)/);
 assert.match(style,/\.lpdb-shell \.team-race-tags \.class-tag/);
 assert.match(style,/\.lpdb-shell \.team-race-weather \.race-gfs-briefing/);
 assert.match(style,/\.lpdb-shell \.team-race-timer \.race-live-clock/);
});


test('LPDB can link Trophée Jules Verne record using latest attempt without sharing arrivals or statuses',()=>{
 const record={id:'personal-jules-verne',kind:'record',name:'Trophée Jules Verne',
  boatClass:'ULTIM',vsr:'hc',start:'2026-11-01',startTime:'08:00',
  end:'2026-12-20',endTime:'16:30',timezone:'Europe/Paris',equipment:'full-pack',
  attempts:[
   {id:'attempt-1',startDate:'2026-11-02',startTime:'10:45',seconds:700000,aborted:false},
   {id:'attempt-2',startDate:'2026-11-16',startTime:'13:20',seconds:null,aborted:false}
  ]};
 const base=r('jv','2026-12-29','vsr1','live',[rr('Alpha',null,'pending')]);
 const linked=E.fromPersonal(record,base);
 assert.equal(linked.personalRaceId,record.id);
 assert.equal(linked.name,'Trophée Jules Verne');
 assert.equal(linked.boatClass,'ULTIM');
 assert.equal(linked.vsr,'vsr1','LPDB VSR remains independent for a Record');
 assert.equal(linked.start,'2026-11-16','use most recent record departure');
 assert.equal(linked.startTime,'13:20');
 assert.equal(linked.dateEnd,'2026-12-29','team closure must not come from personal record');
 assert.equal(linked.status,'live','personal record status must not override LPDB');
 assert.equal(linked.results.length,1);
 assert.equal(linked.equipment,'','equipment remains personal');
 const updated=E.resolveLinkedRace(linked,{...record,name:'Jules Verne actualisé',
  attempts:[...record.attempts,{id:'attempt-3',startDate:'2027-01-03',startTime:'09:00'}]});
 assert.equal(updated.name,'Jules Verne actualisé');
 assert.equal(updated.start,'2027-01-03');
 assert.equal(updated.startTime,'09:00');
 assert.equal(updated.dateEnd,'2026-12-29');
 assert.equal(updated.status,'live');
 assert.equal(updated.vsr,'vsr1');
 assert.equal(updated.results.length,1);
 assert.equal(updated.equipment,'');
 assert.equal(E.resolveLinkedRace(linked,null).name,'Trophée Jules Verne');
});
test('Jules Verne record is selectable from LPDB creation on iPhone-sized DOM',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const personal={id:'personal-jv',kind:'record',name:'Trophée Jules Verne',boatClass:'ULTIM',
  vsr:'hc',start:'2026-11-02',startTime:'09:00',end:'',equipment:'',
  attempts:[{id:'a',startDate:'2026-11-19',startTime:'17:45'}],icon:'data:image/png;base64,AA=='};
 w.RapliTeamUI.init({get:()=>[],personal:()=>[personal],canEdit:()=>true,notify:()=>{},
  save:async()=>{},saveRaceBundle:async()=>{},remove:async()=>{}});
 doc.querySelector('[data-team-action="new-race"]').click();
 const dialog=doc.getElementById('team-race-dialog');
 assert.equal(dialog.open,true);
 const select=doc.getElementById('team-race-personal');
 assert.equal(select.options.length,2,'personal Record is no longer filtered out');
 assert.match(select.options[1].textContent,/RECORD · Trophée Jules Verne/);
 select.value=personal.id;
 doc.querySelector('[data-team-action="link-existing"]').click();
 assert.equal(select.value,personal.id);
 assert.equal(doc.getElementById('team-race-name').value,'Trophée Jules Verne');
 assert.equal(doc.getElementById('team-race-start').value,'2026-11-19');
 assert.equal(doc.getElementById('team-race-start-time').value,'17:45');
 assert.equal(doc.getElementById('team-race-vsr').value,'vsr2','team default category is not forced by record');
 assert.equal(doc.getElementById('team-race-vsr').disabled,false,'VSR category stays editable for a linked Record');
 assert.equal(doc.getElementById('team-race-date').disabled,false,'LPDB closure must remain editable');
 assert.equal(doc.getElementById('team-race-name').disabled,true,'record owns its name');
 assert.equal(doc.getElementById('team-race-date').value,'');
 assert.match(doc.getElementById('team-linked-help').textContent,/Ancien record réutilisé/);
 doc.getElementById('team-race-vsr').value='hc';
 doc.getElementById('team-race-date').value='2026-12-05';
 assert.equal(doc.getElementById('team-race-date').value,'2026-12-05');
 dom.window.close();
});
test('the personal Record menu also provides LPDB association and record opening',()=>{
 const src=fs.readFileSync('regatta/app.js','utf8');
 const ui=fs.readFileSync('regatta/team-app.js','utf8');
 assert.match(src,/r\.kind==='race'\|\|r\.kind==='record'\)\?action\('team-link'/);
 assert.match(src,/r=>r\.id===id&&\(r\.kind==='race'\|\|r\.kind==='record'\)/);
 assert.match(ui,/const personalById=id=>personal\(\)\.find\(x=>x\.id===id&&\(x\.kind==='race'\|\|x\.kind==='record'\)\)/);
});


test('LPDB Recalculer les notes button refreshes ratings without modifying stored race or points',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,doc=w.document,messages=[],mutations=[];
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const members=[m('Alpha'),m('Beta')],race=E.race({...r('recalc','2027-04-12','hc','finished',[
  {...rr('Alpha',1),generalRank:200},{...rr('Beta',2),generalRank:600}
 ]),name:'Course des notes',boatClass:'IMOCA',fleetTotal:10000,start:'2027-04-01'});
 const records=[...members,race];
 w.RapliTeamUI.init({get:()=>records,personal:()=>[],canEdit:()=>false,
  notify:text=>messages.push(text),save:async data=>mutations.push(data),remove:async data=>mutations.push(data)});
 const button=doc.querySelector('#lpdb-global-controls [data-team-action="recalculate-notes"]');
 assert.ok(button,'recalculate button restored in header toolbar');
 const oldPoints=E.scoredRace(race,new Map(members.map(x=>[x.id,x]))).map(s=>s.main);
 const oldAverage=doc.querySelector('.team-race-average strong')?.textContent;
 assert.ok(oldAverage&&oldAverage.includes('/100'));
 button.click();
 assert.match(messages.at(-1),/Notes recalculées : 2 skippers notés sur 1 course/);
 assert.equal(doc.querySelector('.team-race-average strong')?.textContent,oldAverage);
 assert.equal(mutations.length,0,'the manual recalculation is purely read-only');
 const newRace=E.race({...race,results:race.results.map((row,i)=>({...row,generalRank:i===0?100:400}))});
 records.splice(2,1,newRace);
 const previous=doc.querySelector('.team-race-average strong')?.textContent;
 doc.querySelector('#lpdb-global-controls [data-team-action="recalculate-notes"]').click();
 const after=doc.querySelector('.team-race-average strong')?.textContent;
 assert.ok(after&&after.includes('/100'));
 assert.notEqual(after,previous,'recalculation reflects latest race data, not a cached score');
 assert.deepEqual(E.scoredRace(newRace,new Map(members.map(x=>[x.id,x]))).map(s=>s.main),oldPoints);
 assert.equal(mutations.length,0,'recalculation does not save data or change LPDB championship');
 dom.window.close();
});
test('LPDB Recalculer les notes reports missing notes and has an empty-state message',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,doc=w.document,messages=[];
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const members=[m('Alpha'),m('Beta')];
 const race=E.race({...r('partial-notes','2027-04-12','vsr2','finished',[
  {...rr('Alpha',1),generalRank:150},rr('Beta',2)
 ]),name:'Course incomplète en VR',boatClass:'IMOCA',fleetTotal:1000,start:'2027-04-01'});
 const data=[...members,race];
 w.RapliTeamUI.init({get:()=>data,personal:()=>[],canEdit:()=>false,notify:text=>messages.push(text),save:async()=>{},remove:async()=>{}});
 doc.querySelector('#lpdb-global-controls [data-team-action="recalculate-notes"]').click();
 assert.match(messages.at(-1),/Notes recalculées : 1 skipper noté sur 1 course/);
 assert.match(messages.at(-1),/1 note indisponible/);
 data.splice(2);
 doc.querySelector('#lpdb-global-controls [data-team-action="recalculate-notes"]').click();
 assert.equal(messages.at(-1),'Aucune course terminée à noter pour le moment.');
 dom.window.close();
});


test('LPDB tabs live in the real header with a wide search, profile and contextual icon actions',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const d=new JSDOM(html).window.document;
 const header=d.querySelector('.regatta-topbar');
 const tabs=header?.querySelector('.lpdb-tabs');
 assert.ok(tabs,'all four team tabs should be inside the header');
 assert.deepEqual([...tabs.querySelectorAll('button')].map(b=>b.id),[
  'lpdb-view-team','lpdb-view-team-races','lpdb-view-team-skippers','lpdb-view-team-stats'
 ]);
 assert.equal(d.querySelector('#lpdb-panel>.lpdb-tabs'),null,'team tabs must not be duplicated inside the body');
 const controls=d.getElementById('lpdb-global-controls');
 assert.ok(controls&&controls.nextElementSibling?.id==='regatta-cloud-overlay','search bar precedes LPDB content');
 assert.ok(controls.querySelector('.regatta-search-field #lpdb-global-search'));
 assert.ok(controls.querySelector('#lpdb-search-clear'));
 assert.ok(controls.querySelector('#regatta-team-sync'));
 assert.ok(controls.querySelector('#rapliProfileToggle'));
 assert.ok(!d.getElementById('rapliProfile').closest('#races-panel'),'profile is outside hidden personal archives');
 for(const cmd of ['recalculate','recalculate-notes','new-race','new-member','bulk-members','team-colors'])
  assert.ok(controls.querySelector('[data-team-action="'+cmd+'"]'),cmd+' action is in the header');
 const css=fs.readFileSync('regatta/team.css','utf8');
 assert.match(css,/\.regatta-topbar>\.lpdb-tabs/);
 assert.match(css,/\.lpdb-global-controls \.regatta-search-field/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.lpdb-global-controls \[data-lpdb-action-for\]\[hidden\]/);
 assert.ok(!d.getElementById('view-races')&&!d.getElementById('view-stats')&&!d.getElementById('view-honors'));
});
test('header tab navigation updates search hints and action buttons for each LPDB area',()=>{
 const d=new JSDOM(fs.readFileSync('regatta/index.html','utf8')).window.document;
 const src=fs.readFileSync('regatta/app.js','utf8');
 const start=src.indexOf("const lpdbViews=['team'"),end=src.indexOf('const scoreDialog=',start);
 let renderCount=0,colors=0;
 const ctx={$:id=>d.getElementById(id),renderTeam:()=>renderCount++,renderClassColors:()=>colors++};
 const {selectWorkspace}=new Function('ctx','with(ctx){'+src.slice(start,end)+';return {selectWorkspace};}')(ctx);
 const header=d.getElementById('lpdb-global-controls'),input=d.getElementById('lpdb-global-search');
 for(const [view,expected] of [
  ['team',['recalculate']],
  ['team-races',['recalculate-notes','new-race','team-colors']],
  ['team-skippers',['new-member','bulk-members']],
  ['team-stats',[]]
 ]){
  selectWorkspace(view);
  assert.equal(header.dataset.view,view);
  assert.ok(input.placeholder.length>10);
  const visible=[...header.querySelectorAll('[data-lpdb-action-for]')]
   .filter(b=>!b.hidden).map(b=>b.dataset.teamAction);
  assert.deepEqual(visible,expected,'contextual actions for '+view);
  assert.equal(d.getElementById(view+'-panel').hidden,false);
 }
 selectWorkspace('colors');
 assert.equal(header.hidden,true);
 assert.equal(d.getElementById('colors-panel').hidden,false);
 selectWorkspace('team-races');
 assert.equal(header.hidden,false);
 assert.equal(d.getElementById('colors-panel').hidden,true);
 assert.ok(renderCount>=5);
 assert.equal(colors,1);
});
test('global header search filters LPDB courses and skippers without replacing input focus',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{
  runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=[m('Rapli'),m('Tintinultra'),m('Mémphré')];
 const courseOne=E.race({...r('g-search-a','2027-04-25','vsr2','planned',[
  {skipperId:roster[0].id,status:'pending',position:null}
 ]),name:'Trophée Jules Verne',boatClass:'ULTIM',start:'2027-04-01'});
 const courseTwo=E.race({...r('g-search-b','2027-05-25','hc','planned',[
  {skipperId:roster[1].id,status:'pending',position:null}
 ]),name:'Course du Morbihan',boatClass:'IMOCA',start:'2027-05-01'});
 w.RapliTeamUI.init({get:()=>[...roster,courseOne,courseTwo],personal:()=>[],canEdit:()=>false,
  notify:()=>{},save:async()=>{},remove:async()=>{}});
 const input=d.getElementById('lpdb-global-search');
 const type=value=>{input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 d.getElementById('lpdb-global-controls').dataset.view='team-races';
 type('jules');
 assert.equal(d.querySelectorAll('#team-races-panel .team-race-card').length,1);
 assert.match(d.querySelector('#team-races-panel').textContent,/Trophée Jules Verne/);
 type('tintinultra');
 assert.equal(d.querySelectorAll('#team-races-panel .team-race-card').length,1,'course is searchable by skipper');
 assert.match(d.querySelector('#team-races-panel').textContent,/Morbihan/);
 type('imoca');
 assert.equal(d.querySelectorAll('#team-races-panel .team-race-card').length,1,'search also matches boat class');
 type('inconnu');
 assert.match(d.getElementById('team-races-panel').textContent,/Aucune course ne correspond/);
 assert.equal(d.getElementById('lpdb-global-search'),input,'the search input is not destroyed on render');
 d.getElementById('lpdb-global-controls').dataset.view='team-skippers';
 type('mEmPhRe');
 assert.equal(d.querySelectorAll('#team-skippers-panel .team-member-card').length,1,'accent-insensitive skipper search');
 assert.match(d.querySelector('#team-skippers-panel .team-member-card').textContent,/Mémphré/);
 d.getElementById('lpdb-search-clear').click();
 assert.equal(input.value,'');
 assert.equal(d.querySelectorAll('#team-skippers-panel .team-member-card').length,3);
 dom.window.close();
});


test('The Imoca Race automatically becomes live at 17:00 Paris time without saving the course',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.eval(fs.readFileSync('regatta/timezone.js','utf8'));
 w.RapliTeamEngine=E;
 w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 const start=w.RapliRegattaTime.fromWall('2026-11-22','17:00','Europe/Paris');
 assert.equal(new Date(start).toISOString(),'2026-11-22T16:00:00.000Z');
 let now=start-1000,saves=0;
 w.Date.now=()=>now;
 w.RapliRegattaSharedCards={
  raceClockMarkup:r=>{
   const mode=r.status==='live'?'elapsed':'countdown';
   return '<div class="race-live-clock"><span>'+(mode==='elapsed'?'EN COURSE DEPUIS':'DÉPART DANS')+'</span>'+
    '<strong data-race-clock="'+mode+'" data-start="'+start+'">00:00:01</strong></div>';
  },
  gfsBriefingMarkup:()=>'<div data-gfs-briefing>BRIEFING GFS</div>',
  gfsCardMarkup:()=>'<div data-gfs-widget>MÉTÉO GFS</div>',
  liveIconMarkup:()=>'<span class="live-neon" aria-label="En direct"></span>',
  classTagMarkup:()=>'<span class="class-tag">IMOCA</span>',
  vsrTagMarkup:()=>'<span class="vsr-badge">HC</span>'
 };
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const course=E.race({...r('the-imoca-race','2026-12-01','hc','planned',[]),
  name:'The Imoca Race',start:'2026-11-22',startTime:'17:00',
  boatClass:'IMOCA',timezone:'Europe/Paris'});
 w.RapliTeamUI.init({get:()=>[course],personal:()=>[],canEdit:()=>false,
  notify:()=>{},save:async()=>saves++,remove:async()=>saves++});
 d.getElementById('team-races-panel').hidden=false;
 const card=()=>d.querySelector('[data-team-race="'+course.id+'"]');
 assert.equal(card().dataset.teamState,'planned');
 assert.ok(card().querySelector('[data-race-clock="countdown"]'));
 assert.ok(card().querySelector('[data-gfs-briefing]'));
 assert.equal(card().querySelector('[data-gfs-widget]'),null);
 now=start;
 assert.equal(w.RapliTeamUI.refreshLiveStatuses(now),true);
 assert.equal(card().dataset.teamState,'live');
 assert.match(card().textContent,/EN COURS/);
 assert.ok(card().querySelector('[data-race-clock="elapsed"]'));
 assert.ok(card().querySelector('[data-gfs-widget]'));
 assert.ok(card().querySelector('.live-neon'));
 assert.equal(card().querySelector('[data-gfs-briefing]'),null);
 assert.equal(w.RapliTeamUI.refreshLiveStatuses(now+1000),false,'no full rerender every second');
 assert.equal(course.status,'planned','live state is derived without overwriting stored classification status');
 assert.equal(saves,0,'no automatic database writes');
 dom.window.close();
});
test('timezone aware team departure transitions only after a valid start and never reopens finished races',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.eval(fs.readFileSync('regatta/timezone.js','utf8'));
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const winterStart=w.RapliRegattaTime.fromWall('2026-11-22','17:00','Europe/Paris');
 const summerStart=w.RapliRegattaTime.fromWall('2027-07-01','17:00','Europe/Paris');
 // Freeze the first render before the intended departure, regardless of CI time.
 w.Date.now=()=>winterStart-1000;
 assert.equal(new Date(winterStart).toISOString(),'2026-11-22T16:00:00.000Z');
 assert.equal(new Date(summerStart).toISOString(),'2027-07-01T15:00:00.000Z');
 const noClock=E.race({...r('no-clock','2027-01-01','vsr2','planned',[]),start:'2026-11-22',startTime:''});
 const finished=E.race({...r('done','2027-01-01','vsr2','finished',[rr('Alpha',1)]),start:'2026-11-22',startTime:'17:00'});
 const live=E.race({...r('already-live','2027-01-01','vsr2','live',[]),start:'2026-11-22',startTime:'17:00'});
 const past=E.race({...r('future','2027-01-01','vsr2','planned',[]),start:'2026-11-22',startTime:'17:00'});
 w.RapliTeamUI.init({get:()=>[m('Alpha'),noClock,finished,live,past],personal:()=>[],
  canEdit:()=>false,notify:()=>{},save:async()=>{},remove:async()=>{}});
 d.getElementById('team-races-panel').hidden=false;
 const card=id=>d.querySelector('[data-team-race="'+id+'"]');
 assert.equal(card(noClock.id).dataset.teamState,'planned');
 assert.equal(card(finished.id).dataset.teamState,'finished');
 assert.equal(card(live.id).dataset.teamState,'live');
 assert.equal(w.RapliTeamUI.refreshLiveStatuses(winterStart-1000),false);
 assert.equal(card(past.id).dataset.teamState,'planned');
 assert.equal(w.RapliTeamUI.refreshLiveStatuses(winterStart),true);
 assert.equal(card(past.id).dataset.teamState,'live');
 assert.equal(card(noClock.id).dataset.teamState,'planned');
 assert.equal(card(finished.id).dataset.teamState,'finished');
 assert.equal(card(live.id).dataset.teamState,'live');
 dom.window.close();
});
test('the shared clock ticker replaces expired DEPART IMMINENT with a running timer',()=>{
 const source=fs.readFileSync('regatta/app.js','utf8');
 const start=source.indexOf(' function updateRaceClocks(){');
 const end=source.indexOf(' function raceClockMarkup(row){',start);
 assert.ok(start>0&&end>start);
 const doc=new JSDOM('<div class="race-live-clock race-live-clock--countdown">'+
  '<span>⏱</span><span>DÉPART DANS</span><strong data-race-clock="countdown" data-start="1795363200000">DÉPART IMMINENT</strong></div>').window.document;
 const now=1795363200000+2100;
 const calls=[];
 const context={
  Date:{now:()=>now},document:doc,
  window:{RapliTeamUI:{refreshLiveStatuses:value=>calls.push(value)}},
  formatRaceClock:seconds=>Math.floor(seconds)+' s',
  updateGfsWidgets:()=>{},updateGfsBriefings:()=>{},updatePreStartRouting:()=>{}
 };
 const update=new Function('ctx','with(ctx){'+source.slice(start,end)+';return updateRaceClocks;}')(context);
 update();
 const clock=doc.querySelector('[data-race-clock]');
 assert.equal(clock.dataset.raceClock,'elapsed');
 assert.equal(clock.textContent,'2 s');
 assert.equal(clock.previousElementSibling.textContent,'EN COURSE DEPUIS');
 assert.equal(doc.querySelector('.race-live-clock').classList.contains('race-live-clock--countdown'),false);
 assert.deepEqual(calls,[now]);
});


test('a team race stores its own artwork and does not overwrite a linked Jules Verne visual',()=>{
 const img='data:image/png;base64,AAAA';
 const team=E.race({...r('artwork','2028-04-20','hc','planned',[]),icon:img});
 assert.equal(team.icon,img);
 const record={id:'personal-jules',kind:'record',name:'Trophée Jules Verne',boatClass:'ULTIM',
  start:'2028-04-01',startTime:'17:00',icon:'data:image/png;base64,BBBB'};
 const linked=E.fromPersonal(record,{...team,personalRaceId:record.id});
 assert.equal(linked.icon,img);
 const updated=E.resolveLinkedRace(linked,record);
 assert.equal(updated.icon,img,'an explicitly chosen team illustration takes priority');
 assert.equal(record.icon,'data:image/png;base64,BBBB','personal visual is unchanged');
 assert.equal(E.race({...team,icon:'https://invalid.example/evil.svg'}).icon,'','unsafe external URLs are excluded');
});
test('the team editor accepts a standalone image upload and preserves it for the course card',async()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document,stored=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.URL.createObjectURL=()=> 'blob:illustration';
 w.URL.revokeObjectURL=()=>{};
 w.Image=class{
  constructor(){this.naturalWidth=1600;this.naturalHeight=900;}
  set src(x){queueMicrotask(()=>this.onload?.());}
 };
 w.HTMLCanvasElement.prototype.getContext=function(){return {drawImage:()=>{}};};
 const image='data:image/webp;base64,AABBCCDDEE==';
 w.HTMLCanvasElement.prototype.toDataURL=function(){return image;};
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 w.RapliTeamUI.init({get:()=>stored,personal:()=>[],canEdit:()=>true,notify:()=>{},
  saveRaceBundle:async race=>stored.push(race),save:async()=>{},remove:async()=>{}});
 d.querySelector('[data-team-action="new-race"]').click();
 d.getElementById('team-race-name').value='The Imoca Race';
 d.getElementById('team-race-date').value='2028-04-22';
 d.getElementById('team-race-start').value='2028-04-01';
 d.getElementById('team-race-start-time').value='17:00';
 const picker=d.getElementById('team-race-illustration-file');
 const file=new w.File(['fake-image'],'race.png',{type:'image/png'});
 Object.defineProperty(picker,'files',{configurable:true,value:[file]});
 picker.dispatchEvent(new w.Event('change',{bubbles:true}));
 for(let i=0;i<15&&d.getElementById('team-illustration-preview').hidden;i++)await new Promise(done=>setTimeout(done,0));
 assert.equal(d.getElementById('team-illustration-preview').hidden,false);
 assert.equal(d.getElementById('team-illustration-preview').getAttribute('src'),image);
 d.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 for(let i=0;i<15&&!stored.length;i++)await new Promise(done=>setTimeout(done,0));
 assert.equal(stored.length,1);
 assert.equal(stored[0].icon,image);
 for(let i=0;i<15&&!d.querySelector('#team-races-panel .team-race-card');i++)await new Promise(done=>setTimeout(done,0));
 const tile=d.querySelector('#team-races-panel .team-race-card');
 assert.ok(tile,'the card is rerendered after the asynchronous save');
 assert.ok(tile.querySelector('[data-team-action^="change-photo-"]'),'the tile menu offers direct artwork replacement');
 assert.equal(tile.querySelector('.team-race-photo img').getAttribute('src'),image);
 dom.window.close();
});
test('LPDB theoretical podium uses historical finished race placements, VSR and recency without publishing points',()=>{
 const projection=require('../regatta/team-prediction.js');
 const roster=[m('Alpha'),m('Beta'),m('Charlie'),m('Delta')];
 const previous=[
  r('year-old','2028-01-02','hc','finished',[rr('Alpha',1),rr('Beta',2),rr('Charlie',3),rr('Delta',4)]),
  r('recent','2029-07-02','hc','finished',[rr('Alpha',1),rr('Charlie',2),rr('Beta',3),rr('Delta',4)]),
  r('invalid','2029-07-22','hc','finished',[rr('Delta',1),rr('Alpha',1)]),
  r('future','2030-05-22','hc','finished',[rr('Delta',1),rr('Alpha',2),rr('Beta',3),rr('Charlie',4)])
 ];
 const upcoming=E.race({...r('future-course','2030-02-22','hc','planned',
  roster.map(x=>({skipperId:x.id,status:'pending',position:null}))),name:'The Imoca Race',start:'2030-02-01'});
 const records=[...roster,...previous,upcoming];
 const result=projection.project(upcoming,records,E);
 assert.equal(result.entrants,4);
 assert.equal(result.represented,4);
 assert.equal(result.podium.length,3);
 assert.equal(result.podium[0].name,'Alpha');
 assert.ok(result.podium.every(x=>x.samples===2),'later course and invalid results must be excluded');
 assert.ok(result.podium[0].index>result.podium[1].index);
 assert.ok(result.podium.every(x=>x.confidence),'confidence labels must be exposed');
 assert.equal(E.scoredRace(upcoming,new Map(roster.map(x=>[x.id,x]))).length,0,'no provisional championship points');
 const one=projection.project({...upcoming,results:[{skipperId:roster[0].id,status:'pending'}]},records,E);
 assert.equal(one.sufficient,false);
 assert.equal(one.podium.length,1);
 const empty=projection.project({...upcoming,results:[{skipperId:'lpdb-member-unknown',status:'pending'}]},records,E);
 assert.equal(empty.sufficient,false);
 assert.equal(empty.podium.length,0);
});
test('upcoming LPDB cards show theoretical podium only for enrolled skippers with valid history',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.RapliTeamPrediction=require('../regatta/team-prediction.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=[m('Alpha'),m('Beta'),m('Charlie')];
 const old=E.race(r('last','2029-01-01','hc','finished',
  [rr('Alpha',1),rr('Beta',2),rr('Charlie',3)]));
 const upcoming=E.race({...r('forecast','2030-01-20','hc','planned',
  roster.map(x=>({skipperId:x.id,status:'pending',position:null}))),name:'The Imoca Race',start:'2030-01-05'});
 const live=E.race({...r('live-race','2030-01-20','hc','live',[]),name:'Now Sailing',start:'2030-01-05'});
 w.RapliTeamUI.init({get:()=>[...roster,old,upcoming,live],personal:()=>[],canEdit:()=>false,notify:()=>{},
  save:async()=>{},remove:async()=>{}});
 const upcomingTile=d.querySelector('[data-team-race="'+upcoming.id+'"]');
 assert.ok(upcomingTile.querySelector('.team-forecast'));
 assert.equal(upcomingTile.querySelectorAll('.team-forecast-row').length,3);
 assert.match(upcomingTile.querySelector('.team-forecast').textContent,/PODIUM TEAM THÉORIQUE/);
 assert.match(upcomingTile.querySelector('.team-forecast-footnote').textContent,/Aucune prédiction du classement VR réel/);
 assert.equal(upcomingTile.querySelector('.team-race-points'),null);
 assert.equal(d.querySelector('[data-team-race="'+live.id+'"] .team-forecast'),null);
 assert.equal(d.querySelector('[data-team-race="'+old.id+'"] .team-forecast'),null);
 dom.window.close();
});

test('LPDB validation reports every exact error with affected skipper(s) and a correction',()=>{
 const roster=[m('Alpha'),m('Beta')],known=new Map(roster.map(x=>[x.id,x]));
 const invalid=r('Errors','','vsr2','finished',[
  rr('Alpha',1),rr('Alpha',1),rr('Missing',3),rr('Beta',null,'pending')
 ]);
 const issues=E.diagnoseRace(invalid,known);
 const codes=issues.map(x=>x.code);
 for(const code of ['dateEnd','duplicate-skipper','unknown-skipper','duplicate-position','pending'])
  assert.ok(codes.includes(code),code+' absent from '+JSON.stringify(codes));
 assert.match(issues.find(x=>x.code==='duplicate-skipper').message,/Alpha.*lignes 1 et 2/);
 assert.match(issues.find(x=>x.code==='unknown-skipper').message,/ligne 3.*lpdb-member-Missing/);
 assert.match(issues.find(x=>x.code==='duplicate-position').message,/Alpha.*Alpha/);
 assert.match(issues.find(x=>x.code==='pending').message,/Beta.*Classé.*DNF/);
 assert.equal(E.verifyRace(invalid,known),issues[0].message,'verifyRace remains backwards-compatible');
 const valid=r('Valid','2026-12-02','vsr2','finished',[rr('Alpha',1),rr('Beta',2)]);
 assert.deepEqual(E.diagnoseRace(valid,known),[]);
});
test('LPDB validation explains inconsistent chrono and ranking values with named skippers',()=>{
 const members=[m('Alpha'),m('Beta')],known=new Map(members.map(x=>[x.id,x]));
 const invalid=r('Chronos','2026-12-02','hc','finished',[
  {...rr('Alpha',1),elapsedSeconds:1000,gapSeconds:0},
  {...rr('Beta',2),elapsedSeconds:800,gapSeconds:300,generalRank:100000001}
 ]);
 const issues=E.diagnoseRace(invalid,known);
 for(const code of ['generalRank','time-gap','faster-than-winner','chrono-order']){
  assert.ok(issues.some(x=>x.code===code),code);
 }
 assert.match(issues.find(x=>x.code==='time-gap').message,/Beta.*800 s.*1 000|Beta.*800 s.*1000/);
 assert.ok(issues.find(x=>x.code==='faster-than-winner').skipperIds.includes(id('member','Beta')));
});
test('LPDB editor exposes multiple actionable errors and marks the exact invalid row',()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document;
 w.structuredClone=global.structuredClone;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 const roster=[m('Alpha')],race=r('Errors','2026-12-02','vsr2','finished',[
  rr('Alpha',1),rr('Removed-skipper',2)
 ]);
 const saved=[];
 w.RapliTeamUI.init({get:()=>[...roster,race],personal:()=>[],canEdit:()=>true,notify:()=>{},
  saveRaceBundle:async(...a)=>saved.push(a),save:async()=>{},remove:async()=>{}});
 const edit=d.querySelector('[data-team-action="race-'+race.id+'"]');
 assert.ok(edit,'course edit action exists');edit.click();
 const summary=d.getElementById('team-race-validation');
 assert.match(summary.textContent,/Skipper introuvable/);
 assert.match(summary.textContent,/Removed-skipper/);
 const row=[...d.querySelectorAll('#team-result-rows .team-result-row')]
  .find(x=>x.dataset.teamRow===id('member','Removed-skipper'));
 assert.ok(row);
 assert.equal(row.dataset.error,'true');
 const rank=row.querySelector('[data-team-rank]');
 rank.value='';
 rank.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(summary.textContent,/Rang LPDB invalide/);
 assert.equal(rank.getAttribute('aria-invalid'),'true');
 d.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(saved.length,0,'invalid course is never saved');
 assert.ok(summary.querySelectorAll('li').length>=2);
 dom.window.close();
});

test('LPDB linked record preserves automatically imported skipper until the race and profile save together',async()=>{
 for(const linkFirst of [true,false]){
  const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
  const w=dom.window,d=w.document,saved=[];
  w.structuredClone=global.structuredClone;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
  w.eval(fs.readFileSync('regatta/score.js','utf8'));
  w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
  w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
  const record={id:'personal-jules',kind:'record',name:'Trophée Jules Verne',boatClass:'ULTIM',
   vsr:'hc',attempts:[{startDate:'2026-11-20',startTime:'17:00'}],timezone:'Europe/Paris'};
  const roster=[m('Rapli')];
  w.RapliTeamUI.init({
   get:()=>roster,personal:()=>[record],canEdit:()=>true,notify:()=>{},
   save:async()=>{throw Error('No separate skipper save should be needed');},
   saveRaceBundle:async(race,incoming)=>{saved.push({race,incoming});},
   remove:async()=>{}
  });
  d.querySelector('[data-team-action="new-race"]').click();
  const link=()=>{
   d.getElementById('team-race-personal').value=record.id;
   d.querySelector('[data-team-action="link-existing"]').click();
  };
  if(linkFirst)link();
  d.getElementById('team-race-date').value='2026-12-03';
  d.getElementById('team-race-status').value='finished';
  d.getElementById('team-race-status').dispatchEvent(new w.Event('change',{bubbles:true}));
  d.querySelector('[data-team-action="toggle-ranking-import"]').click();
  d.getElementById('team-ranking-paste').value='Rapli LPDB\n11j 16h 58m\nNouveau Marin - LPDB\n+ 01h 10m';
  d.querySelector('[data-team-action="analyze-ranking"]').click();
  assert.equal(d.getElementById('team-ranking-apply').disabled,false);
  d.querySelector('[data-team-action="apply-ranking"]').click();
  assert.match(d.getElementById('team-result-rows').textContent,/Nouveau Marin/);
  assert.match(d.getElementById('team-result-rows').textContent,/NOUVEAU/);
  if(!linkFirst)link();
  assert.doesNotMatch(d.getElementById('team-race-validation').textContent,/Skipper introuvable/);
  d.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<12&&!saved.length;i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(saved.length,1,'race must save whether linked before or after import');
  assert.equal(saved[0].incoming.length,1,'new skipper profile is saved along with race');
  assert.equal(saved[0].incoming[0].name,'Nouveau Marin');
  assert.equal(saved[0].race.personalRaceId,record.id);
  assert.ok(saved[0].race.results.some(row=>row.skipperId===saved[0].incoming[0].id));
  const members=new Map([...roster,...saved[0].incoming].map(member=>[member.id,member]));
  assert.equal(E.verifyRace(saved[0].race,members),'','the bundled race and roster validate together');
  dom.window.close();
 }
});
test('LPDB quick-create skipper stays provisional until course save and avoids duplicates',async()=>{
 const dom=new JSDOM(fs.readFileSync('regatta/index.html','utf8'),{runScripts:'outside-only',url:'https://example.org/regatta/'});
 const w=dom.window,d=w.document,saved=[],separate=[];
 w.structuredClone=global.structuredClone;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.RapliTeamEngine=E;w.RapliTeamTime=require('../regatta/team-time.js');
 w.eval(fs.readFileSync('regatta/score.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-rating.js','utf8'));
 w.eval(fs.readFileSync('regatta/team-app.js','utf8'));
 w.RapliTeamUI.init({get:()=>[],personal:()=>[],canEdit:()=>true,notify:()=>{},
  save:async(x)=>{separate.push(x);},saveRaceBundle:async(race,incoming)=>{saved.push({race,incoming});},remove:async()=>{}});
 d.querySelector('[data-team-action="new-race"]').click();
 d.getElementById('team-race-name').value='Course découverte';
 d.getElementById('team-race-date').value='2026-12-03';
 d.getElementById('team-race-status').value='finished';
 d.getElementById('team-race-status').dispatchEvent(new w.Event('change',{bubbles:true}));
 d.getElementById('team-create-member').value='Nouvelle Skipper';
 d.querySelector('[data-team-action="create-member"]').click();
 assert.equal(separate.length,0,'no orphan profile is saved before course is submitted');
 assert.equal(d.querySelectorAll('#team-result-rows .team-result-row').length,1);
 assert.match(d.getElementById('team-result-rows').textContent,/Nouvelle Skipper.*NOUVEAU/);
 const rank=d.querySelector('#team-result-rows [data-team-rank]');
 rank.value='1';
 rank.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.doesNotMatch(d.getElementById('team-race-validation').textContent,/Skipper introuvable/);
 d.getElementById('team-race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 for(let i=0;i<12&&!saved.length;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.length,1);
 assert.equal(saved[0].incoming.length,1);
 assert.equal(saved[0].incoming[0].name,'Nouvelle Skipper');
 assert.equal(saved[0].race.results[0].skipperId,saved[0].incoming[0].id);
 dom.window.close();
});

test('LPDB VSR foil badge always keeps VSR 1, VSR 2 and VSR 3 on one line',()=>{
 const css=fs.readFileSync('regatta/team.css','utf8');
 const start=css.indexOf('\n.lpdb-shell .team-race-tags .vsr-badge{');
 assert.ok(start!==-1,'LPDB VSR override exists');
 const rule=css.slice(start,css.indexOf('}',start));
 for(const condition of ['white-space:nowrap','min-width:max-content','flex:0 0 auto','overflow-wrap:normal']){
  assert.ok(rule.includes(condition),condition+' prevents VSR badge clipping or wrapping');
 }
 assert.match(css,/\.lpdb-shell \.team-race-tags \.team-race-vsr\{[^}]*white-space:nowrap/s);
 assert.match(css,/\.team-race-tags\{[^}]*flex-wrap:wrap/s,'long boat classes may move the entire VSR badge to the next row');
});
