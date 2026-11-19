const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
async function setup(editor=true){const html=fs.readFileSync('sports/index.html','utf8'),errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css parsing')errors.push(e.message);});const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://test.local/sports/',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;w.RapliAdminAccess={isEditor:()=>editor};w.RapliSharedCollection={canEdit:()=>editor,changed:()=>{}};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});for(const f of ['collection-extras.js','collection-stats.js','stats-visuals.js','rainbow.js','card-tools.js'])w.eval(fs.readFileSync('sports/'+f,'utf8'));const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('src='));for(const m of inline)w.eval(m[2]);for(const f of ['color-theme.js','collection-extras-ui.js'])w.eval(fs.readFileSync('sports/'+f,'utf8'));await new Promise(r=>setTimeout(r,20));const $=id=>w.document.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};return {w,dom,$,change,errors};}
const cards=[{id:'a',status:'own',player:'Tyrese Maxey',brand:'Topps',team:'Philadelphia 76ers',tags:['Topps Chrome','Orange Refractor'],reference:'#41',numbered:true,serial:'12',printRun:'99',season:'2025',rookie:true,graded:true,gradeScore:'10',gradeOrg:'PSA'},{id:'b',status:'wishlist',player:'Sakina Karchaoui',brand:'Topps',reference:'#12',tags:['Blue Refractor'],dream:true,wishStage:'ordered',legendary:true},{id:'c',status:'own',player:'James Harden',brand:'Panini',numbered:true,serial:'1',printRun:'1',uniqueKind:'plate'}];
test('full catalogue integration: views, search, editor fields, readonly and gold grading',async()=>{const s=await setup();try{s.w.RapliModuleBridge.previewState({records:cards,logos:[]});s.change('sportsViewSelect','plates');assert.match(s.$('resultsLabel').textContent,/1 carte/);s.change('sportsViewSelect','details');s.$('filterSearch').value='Topps Maxey 12/99';s.$('filterSearch').dispatchEvent(new s.w.Event('input',{bubbles:true}));assert.match(s.$('resultsLabel').textContent,/1 carte/);assert.ok(s.w.document.querySelector('.grading-perfect'));s.$('filterSearch').value='Maxey 2/99';s.$('filterSearch').dispatchEvent(new s.w.Event('input',{bubbles:true}));assert.match(s.$('resultsLabel').textContent,/0 carte/);s.w.RapliExtrasBridge.openCard(cards[0]);assert.ok(s.$('cardDialog').open);assert.equal(s.$('uniqueKind').disabled,true);s.w.RapliExtrasBridge.openCard(cards[1]);assert.equal(s.$('wishStage').value,'ordered');s.change('wishStage','shipping');assert.equal(s.w.RapliExtrasUI.cardFields().wishStage,'shipping');assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});
test('visitors cannot write new settings',async()=>{const s=await setup(false);try{assert.equal(s.w.document.querySelector('[data-view="stats"]'),null);assert.equal([...s.w.document.querySelectorAll('.section-nav .tabs button')].some(b=>b.textContent==='ARRIVÉES'),false);await assert.rejects(s.w.RapliExtrasBridge.saveCard({id:'bad'}));assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});
test('historical logos switch per season; editing preserves certification and provenance; rainbow remains read only',async()=>{const s=await setup();try{const png='data:image/png;base64,iVBORw0KGgo=';const record={...cards[0],gradePhoto:png,source:'Topps',sourceUrl:'https://www.topps.com/',customLegacyField:'keep'};const logo={id:'team:sixers',type:'team',name:'Philadelphia 76ers',image:png,historical:[{id:'old',from:'2025',to:'2025',image:png+'AA'}]};const rainbow={id:'rainbow:test',type:'rainbow',name:'Test',variants:[{label:'Base',cardId:'a'},{label:'Blue /99',cardId:'b'}]};s.w.RapliModuleBridge.previewState({records:[record,cards[1]],logos:[logo,rainbow]});assert.equal(s.w.document.querySelector('.team-identity img').getAttribute('src'),png+'AA');s.w.document.querySelector('[data-grade-photo]').click();assert.equal(s.w.document.querySelector('.extras-grade-zoom').getAttribute('src'),png);s.w.document.querySelector('.extras-dialog header button').click();s.w.RapliExtrasBridge.openCard(record);s.$('cardForm').dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));const saved=s.w.RapliExtrasBridge.cards().find(c=>c.id==='a');assert.equal(saved.gradePhoto,png);assert.equal(saved.source,'Topps');assert.equal(saved.customLegacyField,'keep');s.change('sportsViewSelect','rainbows');const before=JSON.stringify(s.w.RapliModuleBridge.getState());assert.ok(s.w.document.querySelector('.sports-rainbow-variant'));assert.equal(s.w.document.querySelector('[data-rainbow-sim]'),null);assert.equal(s.w.document.querySelector('.simulation-result'),null);assert.equal(JSON.stringify(s.w.RapliModuleBridge.getState()),before);assert.deepEqual(s.errors,[]);}finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}});

test('historical editor remains visible when Supabase temporarily prevents writes',async()=>{
 const s=await setup(true);
 try{
  s.w.RapliSharedCollection.canEdit=()=>false;
  s.w.RapliExtrasUI.refresh();
  const historical=s.w.document.querySelector('[data-history-open]');
  assert.ok(historical);
  assert.equal(historical.hidden,false);
  assert.equal(historical.previousElementSibling.dataset.logoType,'team');
  historical.click();
  assert.ok(s.$('historyInlinePanel'));
  assert.equal(s.$('logoDialog').dataset.rapliHistoryMode,'true');
  s.$('historySave').click();
  assert.match(s.$('toast').textContent,/Synchronisation en cours/);
  s.w.RapliSharedCollection.canEdit=()=>true;
  s.w.RapliExtrasUI.refresh();
  assert.equal(historical.hidden,false);
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

test('historical logos use the same tab bar and switching tabs restores their panels',async()=>{
 const s=await setup(true);
 try{
  const modal=s.$('logoDialog'),tabs=modal.querySelector('.logo-tabs');
  s.w.document.querySelector('[data-history-open]').click();
  assert.ok(modal.querySelector('#historyInlinePanel'));
  assert.equal(modal.querySelectorAll('.logo-tabs .logo-tab.active').length,1);
  assert.equal(modal.querySelector('.logo-tab.active').textContent,'Logos historiques');
  assert.equal(modal.querySelector('#historyLibraryForm')!==null,true);
  assert.equal(tabs.contains(modal.querySelector('.logo-tab.active')),true);
  const team=modal.querySelector('[data-logo-type="team"]');
  team.click();
  assert.equal(modal.hasAttribute('data-rapli-history-mode'),false);
  assert.equal(modal.querySelector('#historyInlinePanel'),null);
  assert.equal(team.classList.contains('active'),true);
  assert.equal(s.$('logoCreatePanel').hidden,false);
  s.w.document.querySelector('[data-history-open]').click();
  assert.ok(modal.querySelector('#historyInlinePanel'));
  assert.equal(modal.querySelectorAll('#historyLibraryForm').length,1);
  modal.close();
  assert.equal(modal.hasAttribute('data-rapli-history-mode'),false);
  assert.equal(modal.querySelector('#historyInlinePanel'),null);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}
});

test('Printing Plate is a single silver two-line badge; settings override gold 1/1 and editor hides irrelevant fields',async()=>{
 const s=await setup();
 try{
  const plate={...cards[2],plateColor:'Black',photo:'data:image/png;base64,iVBORw0KGgo='};
  const real={...cards[2],id:'real',uniqueKind:'oneofone'};
  s.w.RapliModuleBridge.previewState({records:[plate,real],logos:[]});
  const plateTile=s.w.document.querySelector('[data-card-id="c"]');
  const realTile=s.w.document.querySelector('[data-card-id="real"]');
  assert.ok(plateTile?.querySelector('.collector-badge--plate'),'Printing Plate uses one combined serial badge');
  assert.match(plateTile.querySelector('.collector-badge--plate .collector-badge-caption').textContent,/PRINTING PLATE/);
  assert.equal(plateTile.querySelector('.extras-mini-badges'),null,'duplicate Printing Plate chip is removed');
  assert.ok(plateTile.classList.contains('card-foil-plate'));
  assert.ok(!plateTile.classList.contains('card-foil-gold'));
  assert.ok(realTile.classList.contains('card-foil-gold'));
  s.w.RapliExtrasBridge.openCard(plate);
  assert.ok(s.$('cardDialog').querySelector('.form-fields #wishStageWrap'),'options live in card form column');
  assert.equal(s.$('wishStageWrap').hidden,true);
  assert.equal(s.$('uniqueKindWrap').hidden,false);
  assert.equal(s.$('plateColorWrap').hidden,false);
  assert.equal(s.$('gradePhotoWrap').hidden,true);
  assert.equal(s.$('cardSource'),null);
  assert.equal(s.$('cardSourceUrl'),null);
  s.$('cardNumbered').checked=false;
  s.$('cardNumbered').dispatchEvent(new s.w.Event('change',{bubbles:true}));
  assert.equal(s.$('uniqueKindWrap').hidden,true);
  assert.equal(s.$('plateColorWrap').hidden,true);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});
test('Printing Plate foil colors are editable independently in collector settings',async()=>{
 const s=await setup();
 try{
  s.w.RapliModuleBridge.previewState({records:cards,logos:[]});
  s.$('logosBtn').click();
  s.w.document.querySelector('[data-logo-type="collector"]').click();
  assert.equal(s.$('collectorPlateFinish').value,'foil');
  assert.equal(s.$('collectorPlateBackground').value,'#c4d0dc');
  assert.ok(s.$('collectorPlatePreview').querySelector('.collector-badge--plate'));
  s.$('collectorPlateBackground').value='#536b82';
  s.$('collectorPlateBackground').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  s.$('collectorPlateFinish').value='solid';
  s.$('collectorPlateFinish').dispatchEvent(new s.w.Event('change',{bubbles:true}));
  assert.equal(s.$('collectorPlateGradient').hidden,true);
  assert.match(s.$('collectorPlatePreview').innerHTML,/#536b82/);
  assert.ok(s.$('collectorBadgePreview').querySelector('.collector-badge:not(.collector-badge--plate)'));
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});

test('search clear starts hidden, follows input value and does not alter tab navigation',async()=>{
 const s=await setup(true);
 try{
  const clear=s.w.document.querySelector('.sports-catalogue-search .extras-search-clear');
  const wrap=s.w.document.querySelector('.sports-catalogue-search .input-wrap');
  assert.ok(clear,'clear-search button exists');
  assert.equal(clear.parentElement,wrap,'button belongs to positioning wrapper');
  assert.equal(clear.hidden,true,'clear control does not appear when search is empty');
  s.$('filterSearch').value='Maxey';
  s.$('filterSearch').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  assert.equal(clear.hidden,false);
  clear.click();
  assert.equal(s.$('filterSearch').value,'');
  assert.equal(clear.hidden,true);
  const tabs=s.w.document.querySelectorAll('.section-nav .tabs .tab');
  assert.equal(tabs.length,2);
  assert.deepEqual([...tabs].map(tab=>tab.dataset.view),['own','wishlist']);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}
});

test('the existing Étiquettes tab edits seasonal and Wishlist shipment labels, without changing card records',async()=>{
 const s=await setup(true);
 try{
  const seasonCard={...cards[0],season:'2026/2027'};
  const orderedCard={...cards[1],wishStage:'ordered'};
  const shippingCard={...cards[1],id:'shipping-card',wishStage:'shipping'};
  s.w.RapliModuleBridge.previewState({records:[seasonCard,orderedCard,shippingCard],logos:[]});
  s.$('logosBtn').click();
  s.w.document.querySelector('[data-logo-type="labels"]').click();
  const seasonEditor=s.w.document.querySelector('[data-label-row="season:year"]');
  const orderedEditor=s.w.document.querySelector('[data-label-row="wishlist:ordered"]');
  const shippingEditor=s.w.document.querySelector('[data-label-row="wishlist:shipping"]');
  assert.ok(seasonEditor);
  assert.ok(orderedEditor);
  assert.ok(shippingEditor);
  assert.equal(seasonEditor.querySelector('[data-label-caption]').value,'{saison}');
  assert.equal(seasonEditor.querySelector('[data-label-preview]').textContent,'2026/2027');
  seasonEditor.querySelector('[data-label-caption]').value='SAISON {saison}';
  seasonEditor.querySelector('[data-label-caption]').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  assert.equal(seasonEditor.querySelector('[data-label-preview]').textContent,'SAISON 2026/2027');
  const initial=JSON.stringify(s.w.RapliModuleBridge.getState().records);
  orderedEditor.querySelector('[data-label-caption]').value='À expédier';
  orderedEditor.querySelector('[data-label-ink]').value='#ffffff';
  shippingEditor.querySelector('[data-label-caption]').value='En route';
  for(const row of [orderedEditor,shippingEditor]){
   row.querySelector('[data-label-caption]').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  }
  s.$('labelSaveBtn').click();
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(JSON.stringify(s.w.RapliModuleBridge.getState().records),initial,'customization must not rewrite cards');
  assert.match(s.w.document.querySelector('[data-card-id="a"] .card-season').textContent,/SAISON 2026\/2027/);
  assert.match(s.w.document.querySelector('[data-card-id="b"] .extras-mini-badge').textContent,/À expédier/);
  assert.match(s.w.document.querySelector('[data-card-id="shipping-card"] .extras-mini-badge').textContent,/En route/);
  assert.match(s.w.document.querySelector('[data-card-id="b"] .extras-mini-badge').getAttribute('style'),/#ffffff/);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});

test('manual team logo overrides season for only one card, keeps same team and restores automatic choice',async()=>{
 const ctx=await setup(true);
 try{
  const png='data:image/png;base64,iVBORw0KGgo=';
  const current=png+'AA',retro=png+'BB',other=png+'CC';
  const logo={id:'team:sixers',type:'team',name:'Philadelphia 76ers',image:current,
   historical:[
    {id:'retro90',from:'1997/1998',to:'2008/2009',image:retro},
    {id:'retro09',from:'2009/2010',to:'2014/2015',image:other}
   ]};
  const base={...cards[0],season:'2025',team:'Philadelphia 76ers'};
  const forced={...base,id:'force',teamLogoOverride:'history:retro90'};
  ctx.w.RapliModuleBridge.previewState({records:[base,forced],logos:[logo]});
  const images=()=>[...ctx.w.document.querySelectorAll('.card-item .team-identity img')].map(img=>img.getAttribute('src'));
  assert.equal(images()[0],current,'automatic card follows its season');
  assert.equal(images()[1],retro,'forced card uses historical jersey-era logo');
  ctx.w.RapliExtrasBridge.openCard(forced);
  assert.equal(ctx.$('cardTeamLogoOverrideWrap').hidden,false);
  assert.equal(ctx.$('cardTeamLogoOverride').value,'history:retro90');
  assert.equal(ctx.$('cardTeamLogoPreviewImage').getAttribute('src'),retro);
  ctx.change('cardSeason','2012/2013');
  assert.equal(ctx.$('cardTeamLogoPreviewImage').getAttribute('src'),retro,'manual choice stays fixed across seasons');
  ctx.change('cardTeamLogoOverride','');
  assert.equal(ctx.$('cardTeamLogoPreviewImage').getAttribute('src'),other,'automatic choice resumes');
  ctx.change('cardTeamLogoOverride','main');
  assert.equal(ctx.$('cardTeamLogoPreviewImage').getAttribute('src'),current,'principal logo can be forced');
  ctx.change('cardTeam','Autre équipe');
  assert.equal(ctx.$('cardTeamLogoOverrideWrap').hidden,true,'unknown teams hide the override');
  assert.equal(ctx.$('cardTeamLogoOverride').value,'');
  assert.deepEqual(ctx.errors,[]);
 }finally{await new Promise(done=>setTimeout(done,100));ctx.dom.window.close();}
});

test('alternative logos are manual only and historical periods keep working',async()=>{
 const ctx=await setup(true);
 try{
  const png='data:image/png;base64,iVBORw0KGgo=';
  const logo={id:'team:sixers',type:'team',name:'Philadelphia 76ers',image:png+'AA',
   historical:[{id:'old',from:'1997/1998',to:'2008/2009',image:png+'BB'},
    {id:'alt',kind:'alternative',name:'City Edition rétro',image:png+'CC'}]};
  const automatic={...cards[0],season:'2025/2026'};
  const forced={...automatic,id:'alt-card',teamLogoOverride:'alternative:alt'};
  ctx.w.RapliModuleBridge.previewState({records:[automatic,forced],logos:[logo]});
  const tiles=ctx.w.document.querySelectorAll('.card-item');
  assert.equal(tiles[0].querySelector('.team-identity img').getAttribute('src'),png+'AA');
  assert.equal(tiles[1].querySelector('.team-identity img').getAttribute('src'),png+'CC');
  ctx.w.RapliExtrasBridge.openCard(forced);
  const select=ctx.$('cardTeamLogoOverride');
  assert.equal(select.value,'alternative:alt');
  assert.match([...select.options].map(x=>x.textContent).join(' '),/Alternatif · City Edition rétro/);
  ctx.w.document.querySelector('[data-history-open]').click();
  const type=ctx.$('historyKind');
  assert.ok(type,'historical editor has a type selector');
  assert.equal(type.value,'historical');
  type.value='alternative';type.dispatchEvent(new ctx.w.Event('change',{bubbles:true}));
  assert.equal(ctx.$('historyDateFields').hidden,true);
  assert.equal(ctx.$('historyNameWrap').hidden,false);
  assert.equal(ctx.w.RapliExtras.validatePeriod(logo.historical,{id:'new-alt',kind:'alternative',from:'',to:''}),true);
  assert.equal(ctx.w.RapliExtras.historicalLogo(logo.historical,'2025/2026'),null);
  assert.deepEqual(ctx.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));ctx.dom.window.close();}
});

test('long athlete names can shrink independently of the card reference',async()=>{
 const s=await setup(true);
 try{
  const longCard={...cards[0],id:'long-athlete',player:'Victor Wembanyama',reference:'ARTBK-16C2S-27TN-0062'};
  s.w.RapliModuleBridge.previewState({records:[longCard],logos:[]});
  const row=s.w.document.querySelector('.card-item .player-name-reference');
  const player=row?.querySelector(':scope > .player');
  const ref=row?.querySelector(':scope > .card-reference-actions .card-ref-inline');
  assert.ok(player&&ref,'name and reference remain in separate cells');
  assert.equal(player.querySelector('.player-primary-name').textContent,'Victor Wembanyama');
  assert.equal(ref.textContent,'ARTBK-16C2S-27TN-0062');
  // JSDOM has no layout engine; the actual font fit runs in the browser.
  // Verify the helper is wired and gracefully ignores unavailable measurements.
  s.w.dispatchEvent(new s.w.Event('resize'));
  await new Promise(done=>setTimeout(done,25));
  assert.equal(ref.textContent,'ARTBK-16C2S-27TN-0062');
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(done=>setTimeout(done,100));s.dom.window.close();}
});


test('navigation keeps OWN and WISHLIST with Rainbows in the view selector and retains previous arrival records',async()=>{
 const s=await setup(true);
 try{
  const tabs=[...s.w.document.querySelectorAll('.section-nav .tabs .tab')];
  assert.deepEqual(tabs.map(t=>t.dataset.view),['own','wishlist']);
  assert.equal(s.w.document.querySelector('[data-view="stats"]'),null);
  assert.equal(s.$('inboxLink'),null);
  assert.equal([...s.w.document.querySelectorAll('button')].some(b=>b.textContent==='ARRIVÉES'),false);
  const previous={id:'inbox:old',type:'wishlist-inbox',source:'Vinted',completed:false};
  s.w.RapliModuleBridge.previewState({records:[],logos:[previous]});
  assert.ok(s.w.RapliExtrasBridge.logos().some(item=>item.id==='inbox:old'));
  s.change('sportsViewSelect','rainbows');
  assert.equal(s.$('statsPanel').hidden,true);
  assert.equal(s.$('rainbowPanel').hidden,false);
  assert.equal(s.$('collectionPanel').hidden,false);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(r=>setTimeout(r,100));s.dom.window.close();}
});

test('1/1 à vérifier is no longer a view; unclassified cards are preserved',async()=>{
 const s=await setup(true);
 try{
  const unclassified={...cards[2],id:'legacy-1of1',status:'own',numbered:true,printRun:'1',uniqueKind:''};
  s.w.RapliModuleBridge.previewState({records:[unclassified],logos:[]});
  const layouts=[...s.$('sportsViewSelect').options].map(o=>o.value);
  assert.equal(layouts.includes('unique-review'),false);
  assert.ok(layouts.includes('oneofone'));
  assert.ok(layouts.includes('plates'));
  assert.equal(s.w.RapliExtras.classification(unclassified),'review');
  assert.ok(s.w.document.querySelector('[data-card-id="legacy-1of1"]'));
  s.change('sportsViewSelect','cards');
  assert.match(s.$('resultsLabel').textContent,/1 carte/);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});

test('Rainbow manager lives inside the logo library and tile consultation stays accessible',async()=>{
 const s=await setup(true);
 try{
  const rainbow={id:'rainbow:test-manager',type:'rainbow',name:'Maxey Prizm Rainbow',
    athlete:'Tyrese Maxey',brand:'Panini',baseReferences:['#41'],
    variants:[{label:'Base NN',cardId:'a',isBase:true},
      {label:'Silver /99',cardId:'b',isBase:false}],updatedAt:1234567};
  s.w.RapliModuleBridge.previewState({records:cards,logos:[rainbow]});
  assert.deepEqual([...s.w.document.querySelectorAll('.section-nav .tabs .tab')]
    .map(n=>n.dataset.view),['own','wishlist']);
  const views=[...s.$('sportsViewSelect').options].map(n=>n.value);
  assert.ok(views.includes('rainbows'));
  s.$('logosBtn').click();
  s.w.document.querySelector('.logo-tab[data-logo-type="rainbow"]').click();
  assert.equal(s.$('rainbowLibraryPanel').hidden,false);
  assert.equal(s.$('logoCreatePanel').hidden,true);
  assert.equal(s.$('logoList').hidden,true);
  assert.match(s.$('rainbowManageOverview').textContent,/1 Rainbow/);
  const entry=s.w.document.querySelector('#rainbowManageList .rainbow-library-entry');
  assert.ok(entry);
  assert.match(entry.textContent,/Maxey Prizm Rainbow/);
  assert.ok(entry.querySelector('[data-rainbow-edit]'));
  assert.ok(entry.querySelector('[data-rainbow-delete]'));
  s.$('viewRainbowTilesBtn').click();
  assert.equal(s.$('logoDialog').open,false);
  assert.equal(s.$('sportsViewSelect').value,'rainbows');
  assert.equal(s.$('rainbowPanel').hidden,false);
  assert.equal(s.$('collectionPanel').hidden,false,
    'the view switch remains visible so viewers can leave Rainbow consultation');
  assert.ok(s.w.document.querySelector('#rainbowList .sports-rainbow-group'));
  assert.equal(s.w.document.querySelector('#rainbowList [data-rainbow-edit]'),null);
  assert.equal(s.w.document.querySelector('#rainbowList [data-rainbow-delete]'),null);
  s.w.document.querySelector('[data-view="wishlist"]').click();
  assert.equal(s.$('rainbowPanel').hidden,true);
  assert.equal(s.$('sportsViewSelect').value,'details');
  assert.equal(s.$('collectionPanel').hidden,false);
  assert.ok(s.w.RapliExtrasBridge.logos().some(row=>row.id===rainbow.id),
    'Rainbow records are never migrated or deleted by this navigation change');
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});

test('card three-dot menu replaces direct tile controls and duplicates without changing original',async()=>{
 const s=await setup(true);
 try{
  const source={...cards[0],id:'menu-original',customLegacyField:'preserved',
   photo:'data:image/png;base64,iVBORw0KGgo='};
  s.w.RapliModuleBridge.previewState({records:[source],logos:[]});
  const tile=s.w.document.querySelector('#cardGrid .card-item[data-card-id="menu-original"]');
  assert.ok(tile);
  assert.equal(tile.querySelector('.card-export-actions'),null);
  assert.equal(tile.querySelector('.move-card'),null);
  assert.equal(tile.querySelector('.card-controls'),null);
  const trigger=tile.querySelector('[data-card-menu-trigger]');
  assert.ok(trigger);
  trigger.click();
  const menu=s.$('cardActionsMenu');
  assert.equal(menu.hidden,false);
  assert.equal(trigger.getAttribute('aria-expanded'),'true');
  assert.equal(menu.querySelectorAll('[data-card-tool]').length,2);
  assert.match(menu.textContent,/Dupliquer la carte/);
  assert.match(menu.textContent,/Passer en WISHLIST/);
  assert.ok(menu.querySelector('[data-action="edit"]'));
  assert.ok(menu.querySelector('[data-action="delete"]'));
  const previous={...s.w.RapliExtrasBridge.cards().find(c=>c.id==='menu-original')};
  menu.querySelector('[data-action="duplicate"]').click();
  await new Promise(resolve=>setTimeout(resolve,40));
  const collection=s.w.RapliExtrasBridge.cards();
  assert.equal(collection.length,2);
  assert.deepEqual(collection.find(c=>c.id==='menu-original'),previous);
  const duplicate=collection.find(c=>c.id!=='menu-original');
  assert.equal(duplicate.status,'own');
  assert.equal(duplicate.photo,previous.photo);
  assert.equal(duplicate.customLegacyField,'preserved');
  assert.equal(duplicate.demo,false);
  assert.ok(duplicate.createdAt);
  assert.ok(duplicate.updatedAt);
  assert.equal(menu.hidden,true);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});
test('card action menu stays export-only for visitors and appears in vignette view',async()=>{
 const s=await setup(false);
 try{
  s.w.RapliModuleBridge.previewState({records:cards,logos:[]});
  s.w.document.querySelector('#cardGrid [data-card-menu-trigger]').click();
  const menu=s.$('cardActionsMenu');
  assert.equal(menu.hidden,false);
  assert.equal(menu.querySelectorAll('[data-card-tool]').length,2);
  assert.equal(menu.querySelector('[data-action]'),null);
  s.w.document.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(menu.hidden,true);
  s.change('sportsViewSelect','cards');
  const tile=s.w.document.querySelector('.sports-gallery-tile');
  assert.ok(tile?.querySelector('[data-card-menu-trigger]'));
  tile.querySelector('[data-card-menu-trigger]').click();
  assert.equal(menu.hidden,false);
  assert.equal(menu.querySelector('[data-action]'),null);
  assert.deepEqual(s.errors,[]);
 }finally{await new Promise(resolve=>setTimeout(resolve,100));s.dom.window.close();}
});
