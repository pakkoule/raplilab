const {test}=require('node:test');const assert=require('node:assert/strict');
const {defaults,clean,compile}=require('../sports/color-theme.js');
test('appearance rejects arbitrary selectors, conditions and CSS payloads',()=>{
 const value=clean({schema:1,base:{unknown:{},athlete:{color:'red;}body{display:none',start:'#123456',effect:'url(x)'}},rules:[{target:'body',scope:'all',when:'always'},{target:'athlete',scope:'all',when:'rookie',style:{color:'#abcdef'}}]});
 assert.deepEqual(Object.keys(value.base),['athlete']);assert.equal(value.base.athlete.color,'#284e69');assert.equal(value.base.athlete.start,'#123456');assert.equal(value.base.athlete.effect,'foil');assert.equal(value.rules.length,1);
 assert.ok(!compile(value).includes('url('));assert.ok(!compile(value).includes('display:none'));
});
test('conditional precedence follows user order, disabled/deleted rules stop applying',()=>{
 const config=defaults();const css=compile(config);
 assert.ok(css.indexOf('[data-appearance-oneofone="true"]')<css.indexOf('[data-appearance-status="wishlist"]'));
 assert.ok(css.includes('.rainbow-versions-dialog [data-appearance-card][data-appearance-status="own"]'));
 config.rules=config.rules.filter(r=>r.id!=='rainbow-own');config.rules.find(r=>r.id==='rainbow-wish').enabled=false;
 const updated=compile(config);assert.ok(!updated.includes('[data-appearance-status="own"]'));assert.ok(!updated.includes('[data-appearance-status="wishlist"]'));assert.ok(updated.includes('[data-appearance-card]{background:'));
});
test('rookie title rule uses a fixed card selector and does not inject arbitrary names',()=>{
 const cfg=defaults();cfg.rules.push({target:'athlete',when:'rookie',scope:'catalogue',name:'<script>bad</script>',style:{color:'#00aa44',effect:'solid'},enabled:true});
 const css=compile(cfg);assert.ok(css.includes('#cardGrid [data-appearance-card][data-appearance-rookie="true"] .player-primary-name'));assert.ok(css.includes('-webkit-text-fill-color:#00aa44'));assert.ok(!css.includes('<script>'));
 assert.deepEqual(clean(clean(cfg)),clean(cfg));
});
