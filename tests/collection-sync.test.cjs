const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {IDBFactory}=require('fake-indexeddb');
const Diff=require('../shared/collection-diff.js');
const owner='91a067ed-796a-45c0-b4b1-c04f3bfbe35e';
const ref='rapli-private://'+owner+'/sports/'+'a'.repeat(64)+'.png';
const dataUri='data:image/png;base64,aGVsbG8=';
const code=fs.readFileSync(require.resolve('../shared/shared-collection.js'),'utf8')
 .replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm')",'window.testSdk');
const hash=row=>createHash('md5').update(JSON.stringify(row)).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await wait(10);}throw Error('Timed out');}
function backend(){
 const api={state:{records:[{id:'a',player:'Maxey',photo:ref},{id:'b',player:'Karchaoui'}],logos:[]},revision:1,calls:[],offline:false,hold:null};
 api.delta=(known={})=>{
 const d={revision:api.revision,changed:{},deleted:{},hashes:{}};
 for(const kind of ['records','logos']){
 d.hashes[kind]=Object.fromEntries(api.state[kind].map(row=>[row.id,hash(row)]));
 d.changed[kind]=api.state[kind].filter(row=>known[kind]?.[row.id]!==hash(row));
 d.deleted[kind]=Object.keys(known[kind]||{}).filter(id=>!d.hashes[kind][id]);
 }return structuredClone(d);
 };
 api.call=async(name,args={})=>{
 api.calls.push({name,args:structuredClone(args)});
 if(api.offline)return {error:{message:'offline'}};
 if(name==='version')return {data:{state_revision:api.revision}};
 if(name==='image')return {data:new Blob(['hello'],{type:'image/png'})};
 if(name==='upload')return {data:{}};
 if(name==='rapli_collection_delta')return {data:api.delta(args.p_known)};
 if(name==='rapli_collection_patch'){
 for(const e of args.p_changes){const r=api.state[e.kind].find(x=>x.id===e.id);
 if(!Diff.equal(r||null,e.after)&&(r?hash(r):null)!==e.before)return {error:{code:'40001'}};}
 api.state=Diff.apply(api.state,args.p_changes);api.revision++;
 if(api.hold)await api.hold;
 return {data:api.delta(args.p_known)};
 }
 throw Error(name);
 };
 return api;
}
function device(api){
 const disk=new IDBFactory(),storage=new Map();let timers=new Set(),ctx,state;
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
 const sdk={createClient:()=>({from:()=>({select:()=>({eq(){return this},maybeSingle:()=>api.call('version')})}),
 rpc:(name,args)=>api.call(name,args),storage:{from:()=>({download:path=>api.call('image',{path}),upload:path=>api.call('upload',{path})})}})};
 const listeners={},elements={};
 const dev={errors:[],storage,disk,close(){for(const t of timers)clearTimeout(t);timers.clear();},
 boot(){dev.close();for(const k of Object.keys(listeners))delete listeners[k];
 state=JSON.parse(storage.get('local')||'{"records":[],"logos":[]}');
 const element=()=>({dataset:{},style:{},setAttribute(){},removeAttribute(){},after(){},addEventListener(){}});
 const document={documentElement:{dataset:{}},hidden:false,querySelector:()=>null,
 getElementById:id=>elements[id]||(elements[id]=element()),createElement:element,
 addEventListener:(name,fn)=>{(listeners[name]||=[]).push(fn)}};
 ctx={console:{warn:(...a)=>dev.errors.push(a[0]),info(){}},document,navigator:{onLine:true},
 indexedDB:disk,localStorage,Blob,Map,Set,structuredClone,crypto:require('node:crypto').webcrypto,fetch,
 FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload();});}},
 setTimeout:(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},[850,400,300].includes(ms)?10:ms);timers.add(t);return t;},
 clearTimeout:t=>{clearTimeout(t);timers.delete(t)},setInterval:()=>{throw Error('Polling forbidden');},
 location:{origin:'https://test.local'},Date,Error,Event,addEventListener:(name,fn)=>{(listeners[name]||=[]).push(fn)},
 RapliAdminAccess:{isEditor:()=>true,initialize:async()=>true},RapliCollectionDiff:Diff,testSdk:sdk,
 RapliModuleBridge:{module:'sports',ready:true,getState:()=>state,
 previewState:s=>{state=structuredClone(s);},replaceState:async s=>{state=structuredClone(s);storage.set('local',JSON.stringify(s));}}};
 ctx.window=ctx;ctx.parent=ctx;vm.runInNewContext(code,ctx);return dev;
 },status:()=>ctx.RapliSharedCollection?.getStatus(),state:()=>state,
 edit(id,player,photo){assert.ok(ctx.RapliSharedCollection.canEdit());state.records=state.records.filter(x=>x.id!==id);state.records.push({id,player,...(photo?{photo}:{})});storage.set('local',JSON.stringify(state));ctx.RapliSharedCollection.changed();},
 emit(name){for(const fn of listeners[name]||[])fn();},refresh(){return ctx.RapliSharedCollection.refresh();},
 sync:()=>until(()=>dev.status()?.initialized&&!dev.status().dirty&&!dev.status().busy)
 };return dev;
}
test('warm cache: one revision request, zero image downloads, no periodic polling',async()=>{
 const api=backend(),d=device(api).boot();try{
 await d.sync();assert.equal(api.calls.filter(c=>c.name==='image').length,1);
 api.calls=[];d.boot();await d.sync();await wait(40);
 assert.deepEqual(api.calls.map(c=>c.name),['version']);assert.equal(d.state().records[0].photo,dataUri);
 api.calls=[];for(let i=0;i<5;i++)d.emit('focus');await wait(40);assert.equal(api.calls.length,0);
 }finally{d.close();}
});
test('targeted edit and existing images reused after restart',async()=>{
 const api=backend(),d=device(api).boot();try{
 await d.sync();d.boot();await d.sync();await wait(30);api.calls=[];
 d.edit('a','Tyrese',dataUri);await d.sync();
 assert.deepEqual(api.calls.map(c=>c.name),['rapli_collection_patch']);
 assert.equal(api.calls[0].args.p_changes.length,1);
 assert.equal(api.calls[0].args.p_changes[0].after.photo,ref);
 }finally{d.close();}
});
test('offline edits survive restart and retry automatically',async()=>{
 const api=backend(),d=device(api).boot();try{
 await d.sync();api.offline=true;d.edit('c','Offline');await wait(50);d.boot();
 await until(()=>d.status()?.initialized);await wait(30);
 assert.equal(d.state().records.find(x=>x.id==='c').player,'Offline');
 api.offline=false;d.emit('online');await d.sync();
 assert.equal(api.state.records.filter(x=>x.id==='c').length,1);
 }finally{d.close();}
});
test('different-device changes merge, deletion propagates, same-card conflict is preserved',async()=>{
 const api=backend(),a=device(api).boot(),b=device(api).boot();try{
 await Promise.all([a.sync(),b.sync()]);a.edit('a','Device 1');await a.sync();b.edit('b','Device 2');await b.sync();
 assert.equal(api.state.records.find(x=>x.id==='a').player,'Device 1');
 assert.equal(b.state().records.find(x=>x.id==='a').player,'Device 1');
 api.state.records=api.state.records.filter(x=>x.id!=='a');api.revision++;await b.refresh();
 assert.ok(!b.state().records.some(x=>x.id==='a'));
 a.edit('b','Stale edit');await until(()=>a.status().blocked);
 assert.equal(api.state.records.find(x=>x.id==='b').player,'Device 2');
 assert.equal(a.state().records.find(x=>x.id==='b').player,'Stale edit');
 }finally{a.close();b.close();}
});
test('edits made during upload are kept for next batch',async()=>{
 const api=backend(),d=device(api).boot();try{
 await d.sync();let release;api.hold=new Promise(r=>release=r);
 d.edit('a','First');await until(()=>d.status().busy);d.edit('a','Second');api.hold=null;release();
 await until(()=>!d.status().busy);assert.equal(d.state().records.find(x=>x.id==='a').player,'Second');
 d.emit('online');await d.sync();assert.equal(api.state.records.find(x=>x.id==='a').player,'Second');
 }finally{d.close();}
});
