const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

const js=fs.readFileSync('regatta/app.js','utf8');
const html=fs.readFileSync('regatta/index.html','utf8');
const css=fs.readFileSync('regatta/style.css','utf8');
const first=js.indexOf('function raceClassHistory(r,history){');
const last=js.indexOf('function gfsBriefingMarkup(r){',first);
assert.ok(first>0&&last>first,'prestart history and routing helpers are present');
const now=Date.now();
const ctx={
 raceStatus:r=>r.mockStatus,
 gfsBriefingForRace:()=>({usableLocal:'10:40',consultation:now+1800000,departure:now+7200000}),
 formatRaceClock:()=> '00:30:00',
 clean:(x,n)=>String(x||'').trim().slice(0,n),
 safe:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
 document:null
};
const helpers=new Function('ctx','with(ctx){'+js.slice(first,last)+
 ';return {raceClassHistory,raceRankProjection,preStartInsightsMarkup,updatePreStartRouting};}')(ctx);
const {raceClassHistory,raceRankProjection,preStartInsightsMarkup,updatePreStartRouting}=helpers;
const race={id:'new',kind:'race',boatClass:'IMOCA',startParticipantCount:'12500',mockStatus:'planned'};
const history=[
 {id:'a',kind:'race',boatClass:'IMOCA',rank:'80',rankTotal:'2000',mockStatus:'finished'},
 {id:'b',kind:'race',boatClass:'IMOCA',rank:'200',rankTotal:'5000',mockStatus:'finished'},
 {id:'c',kind:'race',boatClass:'IMOCA',rank:'100',rankTotal:'10000',mockStatus:'finished'},
 {id:'d',kind:'race',boatClass:'IMOCA',rank:'750',rankTotal:'15000',mockStatus:'finished'},
 {id:'e',kind:'race',boatClass:'Class40',rank:'1',rankTotal:'1000',mockStatus:'finished'},
 {id:'f',kind:'race',boatClass:'IMOCA',rank:'1',rankTotal:'99999',mockStatus:'live'}
];

test('separate participants at the start are offered without modifying final participant counts',()=>{
 assert.match(html,/id="race-start-participant-count"/);
 assert.match(html,/id="race-participant-count"/);
 assert.match(js,/startParticipantCount:12/);
 assert.match(js,/startParticipantCount:'start-participant-count'/);
 assert.match(js,/Les participants au départ doivent être un entier positif/);
 assert.match(js,/r\.startParticipantCount/);
 assert.match(js,/participantCount:12/);
 assert.match(js,/participantCount:'participant-count'/);
});
test('historical reference includes only completed races of the same class',()=>{
 const sample=raceClassHistory(race,history);
 assert.equal(sample.finished.length,4);
 assert.equal(sample.best,80);
 assert.equal(sample.rates.length,4);
 assert.ok(Math.abs(sample.median-.04)<1e-9);
});
test('median historic top percent projects approximately rank 500 among 12500 starters',()=>{
 const forecast=raceRankProjection(race,history);
 assert.equal(forecast.estimated,500);
 assert.deepEqual(forecast.range,[406,531]);
 assert.equal(forecast.count,12500);
 const doubled=raceRankProjection({...race,startParticipantCount:'25000'},history);
 assert.equal(doubled.estimated,1000);
 assert.equal(raceRankProjection({...race,startParticipantCount:''},history).estimated,null);
 assert.equal(raceRankProjection({...race,startParticipantCount:'0'},history).estimated,null);
});
test('one historic finish yields a provisional rank without invented statistical range',()=>{
 const firstOnly=raceRankProjection(race,history.slice(0,1));
 assert.equal(firstOnly.estimated,500);
 assert.equal(firstOnly.range,null);
 assert.equal(raceRankProjection({...race,boatClass:'ULTIM'},history).estimated,null);
});
test('prestart insight tiles include routing, class history and theoretical ranking',()=>{
 const output=preStartInsightsMarkup(race,history);
 const doc=new JSDOM(output).window.document;
 assert.ok(doc.querySelector('.race-prestart-routing'));
 assert.ok(doc.querySelector('.race-prestart-history'));
 assert.ok(doc.querySelector('.race-prestart-projection'));
 assert.match(doc.querySelector('.race-prestart-projection').textContent,/#500/);
 assert.match(doc.querySelector('.race-prestart-range').textContent,/#406/);
 assert.match(output,/data-gfs-route-at/);
 assert.ok(css.includes('race-card-right .race-gfs-briefing'));
 assert.ok(css.includes('race-prestart-performance'));
});
test('the routing countdown refreshes in place and preserves the course image node',()=>{
 const markup=preStartInsightsMarkup(race,history);
 const dom=new JSDOM('<div id="cards"><img id="photo"><article>'+markup+'</article></div>');
 try{
  ctx.document=dom.window.document;
  const photo=ctx.document.querySelector('#photo');
  const widget=ctx.document.querySelector('[data-gfs-route-at]');
  const target=Number(widget.dataset.gfsRouteAt);
  updatePreStartRouting(target);
  assert.equal(widget.dataset.gfsRouteState,'ready');
  assert.equal(widget.querySelector('[data-gfs-route-countdown]').textContent,'À CONSULTER');
  updatePreStartRouting(target+7200000);
  assert.equal(widget.dataset.gfsRouteState,'expired');
  assert.equal(widget.querySelector('[data-gfs-route-countdown]').textContent,'DÉPART À VÉRIFIER');
  assert.equal(ctx.document.querySelector('#photo'),photo);
 }finally{ctx.document=null;dom.window.close();}
});
