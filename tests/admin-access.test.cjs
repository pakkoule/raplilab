const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../shared/admin-access.js'),'utf8')
 .replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm')",'window.sdk');
function harness(signedIn=false){
 let session=signedIn?{access_token:'test-token',user:{email:'rapharcadium@pm.me'}}:null;
 let verified={email:'rapharcadium@pm.me',is_anonymous:false},callback;
 const counts={clients:0,users:0};
 const client={auth:{onAuthStateChange:fn=>{callback=fn;},
 getSession:async()=>({data:{session}}),getUser:async()=>{counts.users++;return {data:{user:verified}};}}};
 function windowFor(parent){
  const events=new Map();const win={console,setTimeout,Date,JSON,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
   document:{documentElement:{dataset:{}}},location:{hostname:'localhost'},
   addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},
   removeEventListener:(name,fn)=>events.get(name)?.delete(fn),
   dispatchEvent:e=>{for(const fn of events.get(e.type)||[])fn(e);},
   sdk:{createClient:()=>{counts.clients++;return client;}}};
  win.window=win;win.parent=parent||win;win.top=parent||win;vm.runInNewContext(source,win);return win;
 }
 return {counts,windowFor,signOut(){session=null;callback('SIGNED_OUT');},setVerified(user){verified=user;}};
}
test('anonymous portal and modules share one client without auth user requests',async()=>{
 const h=harness(),parent=h.windowFor();await parent.RapliAdminAccess.initialize();
 const child=h.windowFor(parent);await child.RapliAdminAccess.initialize();
 const [a,b]=await Promise.all([parent.RapliAdminAccess.getClient(),child.RapliAdminAccess.getClient()]);
 assert.equal(a,b);assert.equal(h.counts.clients,1);assert.equal(h.counts.users,0);
 assert.equal(child.RapliAdminAccess.isEditor(),false);
});
test('signed-in verification is coalesced and sign-out reaches embedded modules',async()=>{
 const h=harness(true),parent=h.windowFor(),child=h.windowFor(parent);
 await Promise.all([parent.RapliAdminAccess.initialize(),child.RapliAdminAccess.initialize(),parent.RapliAdminAccess.refresh()]);
 await Promise.all(Array.from({length:5},()=>child.RapliAdminAccess.refresh()));
 assert.equal(h.counts.clients,1);assert.equal(h.counts.users,1);
 assert.equal(child.RapliAdminAccess.isEditor(),true);
 h.signOut();assert.equal(child.RapliAdminAccess.isEditor(),false);
 assert.equal(child.document.documentElement.dataset.rapliRole,'viewer');
});
test('an editable local session never replaces server authorization',async()=>{
 const h=harness(true);h.setVerified({email:'someone-else@example.org',is_anonymous:false});
 const parent=h.windowFor();await parent.RapliAdminAccess.initialize();
 assert.equal(h.counts.users,1);assert.equal(parent.RapliAdminAccess.isEditor(),false);
});
