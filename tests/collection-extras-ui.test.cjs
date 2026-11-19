const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
async function setup(editor=true){const html=fs.readFileSync('sports/index.html','utf8'),errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css parsing')errors.push(e.message);});const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://test.local/sports/',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;w.RapliAdminAccess={isEditor:()=>editor};w.RapliSharedCollection={canEdit:()=>editor,changed:()=>{}};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});for(const f of ['collection-extras.js','collection-stats.js','stats-visuals.js','rainbow.js','card-tools.js'])w.eval(fs.readFileSync('sports/'+f,'utf8'));const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('src='));for(const m of inline)w.eval(m[2]);for(const f of ['color-theme.js','collection-extras-ui.js'])w.eval(fs.readFileSync('sports/'+f,'utf8'));await new Promise(r=>setTimeout(r,20));const $=id=>w.document.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};return {w,dom,$,change,errors};}
const cards=[{id:'a',status:'own',player:'Tyrese Maxey',brand:'Topps',team:'Philadelphia 76ers',tags:['Topps Chrome','Orange Refractor'],reference:'#41',numbered:true,serial:'12',printRun:'99',season:'2025',rookie:true,graded:true,gradeScore:'10',gradeOrg:'PSA'},{id:'b',status:'wishlist',player:'Sakina Karchaoui',brand:'Topps',reference:'#12',tags:['Blue Refractor'],dream:true,wishStage:'ordered',legendary:true},{id:'c',status:'own',player:'James Harden',brand:'Panini',numbered:true,serial:'1',printRun:'1',uniqueKind:'plate'}];
test('full catalogue integration: views, search, editor fields, readonly and gold grading',async()=>{const s=await setup();try{s.w.RapliModuleBridge.previewState({records:cards,logos:[]});s.change('sportsViewSelect','plates');assert.match(s.$('resultsLabel').textContent,/1 carte/);s.change('sportsViewSelect','details');s.$('filterSearch').value='Topps Maxey 12/99';s.$('filterSearch').dispatchEvent(new s.w.Event('input',{bubbles:true}));assert.match(s.$('resultsLabel').textContent,/1 carte/);assert.ok(s.w.document.querySelector('.grading-perfect'));s.$('filterSearch').value='Maxey 2/99';s.$('filterSearch').dispatchEvent(new s.w.Event('input',{bubbles:true}));assert.match(s.$('resultsLabel').textContent,/0 carte/);s.w.RapliExtrasBridge.openCard(cards[0]);assert.ok(s.$('cardDialog').open);assert.equal(s.$('uniqueKind').disabled,true);s.w.RapliExtrasBridge.openCard(cards[1]);assert.equal(s.$('wishStage').value,'ordered');s.change('wishStage','shipping');assert.equal(s.w.RapliExtrasUI.cardFields().wishStage,'shipping');assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});
test('inbox import retains incomplete rows and retry does not duplicate cards',async()=>{const s=await setup();try{s.w.RapliModuleBridge.previewState({records:cards,logos:[]});[...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='ARRIVÉES').click();s.$('inboxChecklist').value='Tyrese Maxey - Topps Chrome - #41 - Orange Refractor /25\nSakina Karchaoui';s.$('inboxParse').click();await new Promise(r=>setTimeout(r,20));assert.equal(s.w.document.querySelectorAll('.inbox-row').length,2);s.w.document.querySelector('[data-import-one]').click();await new Promise(r=>setTimeout(r,20));const imported=s.w.RapliExtrasBridge.cards().filter(c=>c.id.startsWith('import:'));assert.equal(imported.length,1);assert.equal(imported[0].status,'wishlist');assert.equal(imported[0].printRun,'25');assert.equal(s.w.document.querySelectorAll('.inbox-row').length,1);s.w.document.querySelector('[data-import-one]').click();await new Promise(r=>setTimeout(r,20));assert.equal(s.w.RapliExtrasBridge.cards().length,4);assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});
test('visitors cannot write new settings or open the inbox',async()=>{const s=await setup(false);try{const b=[...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='ARRIVÉES');assert.equal(b.hidden,true);b.click();assert.equal(s.$('inboxList'),null);await assert.rejects(s.w.RapliExtrasBridge.saveCard({id:'bad'}));assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});
test('historical logos switch per season; editing preserves certification and provenance; rainbow simulation is read only',async()=>{const s=await setup();try{const png='data:image/png;base64,iVBORw0KGgo=';const record={...cards[0],gradePhoto:png,source:'Topps',sourceUrl:'https://www.topps.com/',customLegacyField:'keep'};const logo={id:'team:sixers',type:'team',name:'Philadelphia 76ers',image:png,historical:[{id:'old',from:'2025',to:'2025',image:png+'AA'}]};const rainbow={id:'rainbow:test',type:'rainbow',name:'Test',variants:[{label:'Base',cardId:'a'},{label:'Blue /99',cardId:'b'}]};s.w.RapliModuleBridge.previewState({records:[record,cards[1]],logos:[logo,rainbow]});assert.equal(s.w.document.querySelector('.team-identity img').getAttribute('src'),png+'AA');s.w.document.querySelector('[data-grade-photo]').click();assert.equal(s.w.document.querySelector('.extras-grade-zoom').getAttribute('src'),png);s.w.document.querySelector('.extras-dialog header button').click();s.w.RapliExtrasBridge.openCard(record);s.$('cardForm').dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));const saved=s.w.RapliExtrasBridge.cards().find(c=>c.id==='a');assert.equal(saved.gradePhoto,png);assert.equal(saved.source,'Topps');assert.equal(saved.customLegacyField,'keep');s.w.document.querySelector('[data-view="rainbow"]').click();const before=JSON.stringify(s.w.RapliModuleBridge.getState());s.w.document.querySelector('[data-rainbow-sim]').click();assert.match(s.w.document.querySelector('.simulation-result').textContent,/100 %/);assert.equal(JSON.stringify(s.w.RapliModuleBridge.getState()),before);assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});

test('historical logos and arrivals stay visible to a verified editor during temporary cloud hydration',async()=>{
 const s=await setup(true);
 try{
  // Mirrors Supabase's busyLoading period: editor identity is valid, writes are paused.
  s.w.RapliSharedCollection.canEdit=()=>false;
  s.w.RapliExtrasUI.refresh();
  const historic=s.w.document.querySelector('[data-history-open]');
  const arrivals=[...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='ARRIVÉES');
  assert.ok(historic,'historical logos entry must exist');
  assert.equal(historic.hidden,false);
  assert.equal(arrivals.hidden,false);
  assert.equal(historic.previousElementSibling.dataset.logoType,'team');
  historic.click();
  assert.ok(s.w.document.querySelector('.extras-dialog'),'history can be consulted before edits become available');
  s.$('historySave').click();
  assert.match(s.$('toast').textContent,/Synchronisation en cours/);
  s.w.RapliSharedCollection.canEdit=()=>true;
  s.w.RapliExtrasUI.refresh();
  assert.equal(historic.hidden,false);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}
});

test('historical logo library offers saved variants and searchable public previews without writing',async()=>{
 const s=await setup(true);
 try{
  const original='data:image/png;base64,iVBORw0KGgo=';
  s.w.RapliModuleBridge.previewState({records:cards,logos:[
   {id:'team:sixers',type:'team',name:'Philadelphia 76ers',image:original,
    historical:[{id:'old',from:'1977/1978',to:'1996/1997',image:original}]},
   {id:'team:france',type:'team',name:'Équipe de France',image:original}
  ]});
  const initial=JSON.stringify(s.w.RapliModuleBridge.getState());
  s.w.document.querySelector('[data-history-open]').click();
  assert.ok(s.$('historyLibraryForm'));
  assert.ok(s.$('historySavedAll'));
  assert.equal(s.w.document.querySelectorAll('.historical-saved-choice').length,1);
  assert.ok(s.w.document.querySelectorAll('#historyLibraryFeatured [data-history-use]').length>=1);
  assert.equal(s.$('historyLogo').value,'team:france');
  const calls=[];
  s.w.fetch=async url=>{
   calls.push(String(url));
   return {ok:true,json:async()=>({query:{pages:{'1':{pageid:1,title:'File:France national team logo.png',
     imageinfo:[{mime:'image/png',thumburl:'https://upload.wikimedia.org/example.png'}]}}}})};
  };
  s.$('historyLibraryQuery').value='France logo';
  s.$('historyLibraryForm').dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(calls.some(url=>url.includes('gsrnamespace=6')));
  assert.equal(s.w.document.querySelectorAll('#historyLibraryResults [data-history-use]').length,1);
  assert.equal(JSON.stringify(s.w.RapliModuleBridge.getState()),initial,
   'previewing and searching must not modify Supabase or local collection state');
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});
