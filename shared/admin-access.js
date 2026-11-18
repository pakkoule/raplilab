/* Rapli Lab — one verified email editor, all other sessions read-only.
 * This client-side state controls the interface only; Supabase RLS controls writes.
 */
(() => {
  'use strict';
  // Embedded modules share the portal's verified auth state and client.
  // Server-side RLS remains the authority for every write.
  try {
    const parentAccess=window.parent!==window && window.parent.RapliAdminAccess;
    if(parentAccess?.getClient){
      const sync=()=>{
        document.documentElement.dataset.rapliRole=parentAccess.isEditor()?'editor':'viewer';
        window.dispatchEvent(new CustomEvent('rapli-admin-access-change',{
          detail:{editor:parentAccess.isEditor(),ready:parentAccess.ready()}
        }));
      };
      window.RapliAdminAccess={...parentAccess,
        initialize:()=>parentAccess.initialize().then(value=>{sync();return value;}),
        refresh:()=>parentAccess.refresh().then(value=>{sync();return value;})};
      window.parent.addEventListener('rapli-admin-access-change',sync);
      window.addEventListener('pageshow',()=>{window.parent.addEventListener('rapli-admin-access-change',sync);sync();});
      window.addEventListener('pagehide',()=>window.parent.removeEventListener('rapli-admin-access-change',sync),{once:true});
      sync();void window.RapliAdminAccess.initialize();return;
    }
  }catch(_){ /* Standalone or cross-origin embedding: create our own client. */ }
  const ADMIN_EMAIL='rapharcadium@pm.me';
  const SUPABASE_URL='https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY='sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  let client=null,clientPromise=null,verification=null,verifiedToken=null,verifiedAt=0,editor=false,ready=false,loading=null,status='Vérification de la session…';
  let lastNotice='';
  const notify=()=>{
    const notice=JSON.stringify([editor,ready,status]);
    if(notice===lastNotice)return;
    lastNotice=notice;
    document.documentElement.dataset.rapliRole=editor?'editor':'viewer';
    window.dispatchEvent(new CustomEvent('rapli-admin-access-change',{detail:{editor,ready}}));
  };
  function supabase(){
    if(!clientPromise)clientPromise=(async()=>{
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client=sdk.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:window===window.top}});
      client.auth.onAuthStateChange((event)=>{
        // INITIAL_SESSION is already handled by initialize(). Never call auth APIs
        // from inside this callback (the SDK holds an auth lock).
        if(event==='INITIAL_SESSION')return;
        if(event==='SIGNED_OUT'){editor=false;verifiedToken=null;ready=true;status='Consultation uniquement';notify();}
        setTimeout(()=>{void refresh();},0);
      });
      return client;
    })().catch(error=>{clientPromise=null;throw error;});
    return clientPromise;
  }
  function refresh(){
    if(verification)return verification;
    verification=(async()=>{
      try{
        const sdk=await supabase();
        const sessionResult=await sdk.auth.getSession();
        if(sessionResult.error)throw sessionResult.error;
        const token=sessionResult.data?.session?.access_token;
        // Public browsing needs no /auth/v1/user request. A local session is only
        // used to decide whether verification is needed, never to grant editing.
        if(!token){editor=false;verifiedToken=null;status='Consultation uniquement';return false;}
        if(ready && token===verifiedToken && Date.now()-verifiedAt<60000)return editor;
        const {data,error}=await sdk.auth.getUser();
        if(error)throw error;
        // Do not publish a verification if sign-out/token replacement happened meanwhile.
        const current=await sdk.auth.getSession();
        if(current.data?.session?.access_token!==token){editor=false;verifiedToken=null;return false;}
        editor=Boolean(data?.user?.email)&&data.user.email.toLowerCase()===ADMIN_EMAIL&&!data.user.is_anonymous;
        verifiedToken=token;verifiedAt=Date.now();
        status=editor?'Mode édition actif':'Consultation uniquement';
      }catch(error){
        editor=false;verifiedToken=null;status='Consultation uniquement';
        console.warn('Rapli Lab : vérification des droits indisponible',error);
      }finally{ready=true;notify();}
      return editor;
    })().finally(()=>{verification=null;});
    return verification;
  }
  function initialize(){
    if(!loading)loading=refresh();
    return loading;
  }
  async function sendMagicLink(){
    const sdk=await supabase();
    // Return to the current Netlify Deploy Preview while testing the PR;
    // only the production host redirects to the official published site.
    // Never redirect the magic link back to localhost.
    const hostname=window.location.hostname.toLowerCase();
    const isPreview=/^deploy-preview-\d+--raplilab\.netlify\.app$/.test(hostname);
    const redirectTo=isPreview?window.location.origin+'/':'https://raplilab.netlify.app/';
    const {error}=await sdk.auth.signInWithOtp({
      email:ADMIN_EMAIL,
      options:{emailRedirectTo:redirectTo,shouldCreateUser:true}
    });
    if(error)throw error;
    return true;
  }
  async function logout(){
    const sdk=await supabase();
    const {error}=await sdk.auth.signOut();
    if(error)throw error;
    editor=false;ready=true;notify();
    // Logout must navigate the main portal, never load it nested inside a workspace iframe.
    if(window.top!==window)window.top.location.assign('/');
    else window.location.assign('/');
  }
  window.RapliAdminAccess={
    initialize,refresh,sendMagicLink,logout,getClient:supabase,
    isEditor:()=>editor,
    ready:()=>ready,
    status:()=>status,
    email:ADMIN_EMAIL
  };
  document.documentElement.dataset.rapliRole='viewer';
  void initialize();
})();