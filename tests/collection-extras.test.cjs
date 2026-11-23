const {test}=require('node:test'),assert=require('node:assert/strict');const E=require('../sports/collection-extras.js'),T=require('../sports/color-theme.js');
test('exact serial search and combined print run never match partial numbers',()=>{const c={numbered:true,serial:'12',printRun:'99'};assert.ok(E.serialMatch('Maxey Topps 12/99',c));assert.ok(E.serialMatch('/99',c));assert.ok(!E.serialMatch('2/99',c));assert.ok(!E.serialMatch('/9',c));assert.ok(!E.serialMatch('/25',c));});
test('duplicate identity separates parallels and printing plate colours',()=>{const c={player:'Tyrese Maxey',brand:'Topps',reference:'#41',tags:['Orange Refractor'],season:'2025',numbered:true,printRun:'25'};assert.equal(E.identity(c),E.identity({...c,id:'another',serial:'2'}));assert.notEqual(E.identity(c),E.identity({...c,tags:['Blue Refractor']}));assert.notEqual(E.identity({...c,printRun:'1',uniqueKind:'plate',plateColor:'Cyan'}),E.identity({...c,printRun:'1',uniqueKind:'plate',plateColor:'Black'}));});
test('historical ranges reject overlap and use default outside matching season',()=>{const v={id:'a',from:'1997/1998',to:'2000/2001',image:'old'};assert.equal(E.historicalLogo([v],'1999/2000'),v);assert.equal(E.historicalLogo([v],'2025'),null);assert.ok(!E.validatePeriod([v],{id:'b',from:'2000',to:'2002'}));assert.ok(E.validatePeriod([v],{...v,to:'2001/2002'}));assert.ok(!E.validatePeriod([],{from:'2025/2027'}));assert.ok(!E.validatePeriod([],{from:'2025',to:'2020'}));});
test('old one of ones remain unclassified until explicitly reviewed',()=>{const c={numbered:true,printRun:'1'};assert.equal(E.classification(c),'review');assert.equal(E.classification({...c,uniqueKind:'plate'}),'plate');assert.equal(E.classification({...c,uniqueKind:'oneofone'}),'oneofone');assert.equal(E.classification({...c,printRun:'25',uniqueKind:'plate'}),'');});
test('checklist parser recognises fields and accepts incomplete lines without guessing',()=>{const c=E.parseLine('Tyrese Maxey - Topps Chrome - #41 - Orange Refractor /25');assert.equal(c.player,'Tyrese Maxey');assert.equal(c.brand,'Topps');assert.equal(c.reference,'#41');assert.deepEqual(c.tags,['Topps Chrome','Orange Refractor']);assert.equal(c.printRun,'25');assert.equal(E.parseLine('Sakina Karchaoui').player,'Sakina Karchaoui');assert.equal(E.parseLine('Sakina Karchaoui').brand,'');assert.equal(E.safeUrl('javascript:alert(1)'),'');});
test('foil controls clamp values, reject HEX injection and preserve favourites',()=>{const c=T.clean({schema:1,base:{tile:{angle:999,intensity:-10,borderWidth:999,third:true,middle:'#aabbcc',start:'#112233',end:'#445566',effect:'gradient'}},rules:[],favorites:['#ABCDEF','bad','#abcdef']});assert.equal(c.base.tile.angle,360);assert.equal(c.base.tile.intensity,0);assert.equal(c.base.tile.borderWidth,6);assert.deepEqual(c.favorites,['#abcdef']);assert.match(T.compile(c),/linear-gradient\(360deg,#112233,#aabbcc 50%,#445566\)/);});

test('listing links recognize Vinted, eBay and Cardhobby and remove tracking tokens',()=>{
 const a=E.listingLink('https://www.vinted.fr/items/123456789-2024-25-panini-prizm-tyrese-maxey-blue-ice-99?utm_source=share&fbclid=test');
 assert.equal(a.provider,'Vinted');assert.equal(a.listingId,'123456789');assert.equal(a.slug,'2024-25-panini-prizm-tyrese-maxey-blue-ice-99');
 assert.equal(a.url.includes('utm_source'),false);assert.equal(a.url.includes('fbclid'),false);
 const b=E.listingLink('https://www.ebay.com/itm/2025-26-Topps-Chrome-Tyrese-Maxey-Blue-Refractor/123456789012?itmmeta=tracking&var=111223344');
 assert.equal(b.provider,'eBay');assert.equal(b.listingId,'123456789012');
 assert.equal(b.url,'https://www.ebay.com/itm/123456789012?var=111223344');
 const c=E.listingLink('https://www.cardhobby.com/sale/tyrese-maxey-topps-chrome-41?utm_medium=email');
 assert.equal(c.provider,'Cardhobby');assert.equal(c.slug,'tyrese-maxey-topps-chrome-41');
 assert.equal(c.url.includes('utm_medium'),false);
 assert.equal(E.listingLink('javascript:alert(1)'),null);
 assert.equal(E.listingLink('https://user:password@www.ebay.com/itm/123456789012'),null);
});
test('listing metadata hints remain conservative and extract known card fields',()=>{
 const sample=E.listingCard('https://www.vinted.fr/items/123456789-2024-25-panini-prizm-tyrese-maxey-blue-ice-99',
  {players:['Tyrese Maxey'],brands:['Panini'],tags:['Prizm','Blue Ice']});
 assert.equal(sample.player,'Tyrese Maxey');assert.equal(sample.brand,'Panini');
 assert.equal(sample.season,'2024/2025');assert.equal(sample.source,'Vinted');
 assert.deepEqual(sample.tags,['Prizm','Blue Ice']);assert.equal(sample.reference,'');
 assert.equal(sample.price,'');assert.equal(sample.printRun,'');
 const explicit=E.listingCard('https://www.ebay.com/itm/123456789012',
  {players:['Tyrese Maxey'],brands:['Topps'],tags:['Chrome']},
  'Tyrese Maxey 2025-26 Topps Chrome #41 Orange Refractor /25');
 assert.equal(explicit.reference,'#41');assert.equal(explicit.printRun,'25');
 assert.equal(explicit.season,'2025/2026');assert.equal(explicit.player,'Tyrese Maxey');
 assert.equal(explicit.name.includes('Orange Refractor'),true);
 const links=E.extractListingUrls('Maxey rare https://vinted.fr/items/1234567-card\nhttps://ebay.com/itm/123456789012 (lien)');
 assert.equal(links.length,2);assert.equal(links[0].hint,'Maxey rare');
 assert.equal(links[1].url,'https://ebay.com/itm/123456789012');
});
