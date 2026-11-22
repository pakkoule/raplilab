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
 const updated=E.resolveLinkedRace(linked,{...personal,name:'Route du Rhum 2027',end:'2026-12-03',vsr:'vsr1'});
 assert.equal(updated.name,'Route du Rhum 2027');
 assert.equal(updated.dateEnd,'2026-12-03');
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
 for(const id of ['team-race-personal','team-linked-help','team-race-class','team-race-start','team-race-equipment'])assert.ok(d.getElementById(id));
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
 assert.ok(code.includes("exportStandings"));
 assert.ok(code.includes("toBlob"));
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
 assert.equal(d.getElementById('team-races-panel').hidden,false,'last LPDB subsection is retained');
 methods.selectWorkspace('team-stats');
 assert.equal(d.getElementById('team-stats-panel').hidden,false);
 assert.equal(d.getElementById('team-races-panel').hidden,true);
 assert.equal(d.getElementById('lpdb-view-team-stats').getAttribute('aria-selected'),'true');
});
