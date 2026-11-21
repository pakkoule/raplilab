const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const search=require('../regatta/search.js');

const base={
 id:'race-1',
 name:'Transat Jacques Vabre',
 boat:'Rapli LPDB',
 boatClass:'IMOCA',
 kind:'race',
 vsr:'hc',
 start:'2025-10-29',startTime:'12:45',
 end:'2025-11-10',endTime:'14:10',
 duration:'12 j 1 h 25 min 0 s',
 rank:'23',rankTotal:'125000',
 rankNational:'7',rankNationalTotal:'5000',
 rankDepartment:'2',rankDepartmentTotal:'600',
 rankCity:'1',rankCityTotal:'90',
 rankTeam:'11',rankTeamTotal:'200',
 equipment:'full-pack',gainPoints:'350',gainCredits:'250',
 routeType:'transatlantique'
};
const context={
 status:'TERMINÉE',routeType:'Transatlantique',
 vsr:'HORS CATÉGORIE',timezone:'Europe/Paris',
 equipment:'FULL PACK',score:94,
 capture:'CLASSEMENT FINAL TRACÉ',ranksVisible:true
};
test('search indexes every visible tile family: text, status, VSR, boat and route',()=>{
 for(const q of ['transat','JACQUES', 'IMOCA','Rapli','TERMINEE',
  'hors catégorie','transatlantique','Europe Paris','full pack']){
  assert.ok(search.matches(base,q,context),q);
 }
 assert.equal(search.matches(base,'DNF',context),false);
});
test('searches combinations of terms irrespective of accents, punctuation or case',()=>{
 assert.ok(search.matches(base,'îmôcâ 2025',context));
 assert.ok(search.matches(base,'imoca termineE',context));
 assert.ok(search.matches(base,'350 VSR',context));
 assert.ok(search.matches(base,'94 note',context));
 assert.ok(search.matches(base,'arrivee 10/11/2025',context));
 assert.ok(search.matches(base,'29-10-2025 depart',context));
 assert.ok(search.matches(base,'classement general 125000',context));
 assert.equal(search.matches(base,'imoca vendee globe',context),false);
 assert.ok(search.matches(base,'',context));
});
test('rank totals, gains, duration, date, note and equipment are searchable',()=>{
 for(const q of ['23','125 000','5000','départemental 600','ville 90',
   'team 11','duree 12 j','credits VR 250','points vsr 350',
   '10/11/2025','2025-11-10','score 94','capture du record tracé'.replace('capture du record','classement final')]){
  assert.ok(search.matches(base,q,context),q);
 }
});
test('record attempt details include starts, aborts and best recorded time',()=>{
 const record={name:'Record Atlantique',boatClass:'ULTIM',kind:'record',
  rank:'1',rankTotal:'1000'};
 const info={status:'RECORD CLÔTURÉ',kind:'course record',
  recordSummary:'3 tentatives 1 avortée meilleur temps 2 j 4 h',
  attempts:[
   {startDate:'2024-04-05',startTime:'08:15',aborted:true,timeText:'AVORTÉE'},
   {startDate:'2024-04-07',startTime:'10:00',aborted:false,timeText:'2 j 4 h'},
   {startDate:'2024-04-10',startTime:'10:00',aborted:false,timeText:'EN ATTENTE'}
  ],ranksVisible:true};
 for(const q of ['record cloture','tentative 1 avortee','05/04/2024',
   'tentative 2 2 j 4 h','meilleur temps','1000','ULTIM']){
   assert.ok(search.matches(record,q,info),q);
 }
});
test('no image binary content or hidden notes enter the search index',()=>{
 const race={...base,
  notes:'secret-unpublished-note',
  icon:'data:image/png;base64,IMGSECRET',
  result:'data:image/png;base64,IMGSECRET',
  route:'data:image/png;base64,IMGSECRET'};
 assert.equal(search.matches(race,'secret-unpublished-note',context),false);
 assert.equal(search.matches(race,'IMGSECRET',context),false);
});
test('Regatta only displays a universal search and keeps pagination / keyboard shortcut',()=>{
 const html=fs.readFileSync('regatta/index.html','utf8');
 const app=fs.readFileSync('regatta/app.js','utf8');
 const css=fs.readFileSync('regatta/style.css','utf8');
 const dom=new JSDOM(html);
 try{
  const d=dom.window.document;
  assert.ok(d.getElementById('search'));
  assert.ok(d.getElementById('regatta-search-clear'));
  assert.ok(d.querySelector('script[src="search.js"]'));
  assert.equal(d.querySelector('#regattaFilterDisclosure'),null);
  assert.equal(d.querySelectorAll('#filter-status,#filter-vsr,#filter-class,#sort').length,0);
  assert.equal(d.querySelectorAll('.filters').length,0);
  assert.ok(d.getElementById('regatta-pagination-top'));
  assert.ok(d.getElementById('regatta-pagination-bottom'));
  assert.ok(app.includes("searchEngine.matches(r,query,raceSearchContext(r))"));
  assert.ok(app.includes("regattaPage=1;clearSearch.hidden=!searchInput.value;"));
  assert.ok(app.includes("event.key.toLowerCase()==='k'"));
  assert.equal(/filter-status|filter-class|filter-vsr|\$\('sort'\)/.test(app),false);
  assert.ok(css.includes('.regatta-search-field'));
  assert.equal(css.includes('.regatta-filter-disclosure'),false);
 }finally{dom.window.close();}
});
