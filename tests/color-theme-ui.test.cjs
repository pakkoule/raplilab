const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const fs=require('node:fs');
function setup(saved=null,editor=true){
 const dom=new JSDOM('<dialog id="logoDialog"><button id="appearanceSettingsBtn">Couleurs</button><section id="appearanceSettingsPanel" hidden></section></dialog><div id="cardGrid"><article class="card-item" data-card-id="a"><span class="player-primary-name">A</span></article></div>',{runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};let writes=0;
 w.RapliAppearanceBridge={load:()=>saved,card:()=>({status:'own',rookie:true}),canEdit:()=>editor,notify:()=>{},save:async config=>{saved=config;writes++;}};
 w.eval(fs.readFileSync('sports/color-theme.js','utf8'));const $=s=>w.document.querySelector(s);$('#appearanceSettingsBtn').addEventListener('click',()=>{if(editor)$('#appearanceSettingsPanel').hidden=false;w.RapliAppearance.open();});
 const change=(selector,value)=>{const el=$(selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {dom,w,$,change,read:()=>saved,writes:()=>writes};
}
test('draft changes preview immediately; cancel restores saved styles without writing',()=>{
 const s=setup();s.$('#appearanceSettingsBtn').click();s.change('#appearanceEnabled',true);s.change('#appearanceEffect','solid');
 assert.match(s.$('#rapli-appearance-overrides').textContent,/player-primary-name/);assert.equal(s.writes(),0);
 s.$('[data-theme-close]').click();assert.equal(s.$('#rapli-appearance-overrides').textContent,'');assert.equal(s.writes(),0);s.dom.window.close();
});
test('save and reload preserve added rookie rule, deletion and original reset',async()=>{
 const s=setup();s.$('#appearanceSettingsBtn').click();s.$('[data-theme-add]').click();s.change('#appearanceScope','rainbow');s.$('[data-theme-save]').click();await Promise.resolve();
 assert.equal(s.writes(),1);assert.equal(s.read().rules.at(-1).when,'rookie');assert.equal(s.read().rules.at(-1).scope,'rainbow');
 const next=setup(s.read());assert.match(next.$('#rapli-appearance-overrides').textContent,/data-appearance-rookie/);next.$('#appearanceSettingsBtn').click();next.change('#appearanceSelection','rule:4');next.$('[data-theme-delete]').click();next.$('[data-theme-save]').click();await Promise.resolve();assert.equal(next.read().rules.length,4);
 next.$('#appearanceSettingsBtn').click();next.$('[data-theme-reset]').click();next.$('[data-theme-save]').click();await Promise.resolve();assert.equal(next.read(),null);assert.equal(next.$('#rapli-appearance-overrides').textContent,'');s.dom.window.close();next.dom.window.close();
});
test('viewer receives saved colours but cannot open the settings editor',()=>{
 const {defaults}=require('../sports/color-theme.js');const s=setup(defaults(),false);assert.ok(s.$('#rapli-appearance-overrides').textContent.length>0);s.$('#appearanceSettingsBtn').click();assert.equal(s.$('#appearanceSettingsPanel').innerHTML,'');assert.equal(s.$('[data-card-id]').dataset.appearanceRookie,'true');s.dom.window.close();
});

test('appearance stays in the library; drafts survive tab switches and are discarded on library close',()=>{
 const s=setup();s.$('#appearanceSettingsBtn').click();
 assert.equal(s.w.document.querySelectorAll('dialog').length,1);
 assert.ok(s.$('#logoDialog #appearanceSelection'));
 s.change('#appearanceEnabled',true);s.change('#appearanceEffect','solid');
 s.w.RapliAppearance.leave();assert.equal(s.$('#rapli-appearance-overrides').textContent,'');
 s.w.RapliAppearance.open();assert.equal(s.$('#appearanceEnabled').checked,true);
 assert.ok(s.$('#rapli-appearance-overrides').textContent.length);
 s.$('#logoDialog').dispatchEvent(new s.w.Event('close'));
 assert.equal(s.$('#rapli-appearance-overrides').textContent,'');
 s.w.RapliAppearance.open();assert.equal(s.$('#appearanceEnabled').checked,false);
 assert.equal(s.writes(),0);s.dom.window.close();
});
