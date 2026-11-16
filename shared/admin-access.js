/* Rapli Lab — one verified email editor, all other sessions read-only.
 * This client-side state controls the interface only; Supabase RLS controls writes.
 */
(() => {
  'use strict';
  const ADMIN_EMAIL='rapharcadium@pm.me';
  const SUPABASE_URL='https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY='sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  let client=null,editor=false,ready=false,loading=null,status='Vérification de la session…';
  const notify=()=>{
    document.documentElement.dataset.rapliRole=editor?'editor':'viewer';
    window.dispatchEvent(new CustomEvent('rapli-admin-access-change',{detail:{editor,ready}}));
  };
  async function supabase(){
    if(!client){
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client=sdk.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:window===window.top}});
      client.auth.onAuthStateChange(()=>{
        // Avoid calling other auth APIs inside the onAuthStateChange callback.
        setTimeout(()=>{void refresh();},0);
      });
    }
    return client;
  }
  async function refresh(){
    try{
      const sdk=await supabase();
      const {data,error}=await sdk.auth.getUser();
      editor=!error&&Boolean(data?.user?.email)&&
        data.user.email.toLowerCase()===ADMIN_EMAIL&&!data.user.is_anonymous;
      status=editor?'Mode édition actif':'Consultation uniquement';
    }catch(error){
      editor=false;status='Consultation uniquement';
      console.warn('Rapli Lab : vérification des droits indisponible',error);
    }finally{ready=true;notify();}
    return editor;
  }
  function initialize(){
    if(!loading)loading=refresh();
    return loading;
  }
  async function sendMagicLink(){
    const sdk=await supabase();
    const redirectTo=window.location.origin+'/';
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
    window.location.assign('/');
  }
  window.RapliAdminAccess={
    initialize,refresh,sendMagicLink,logout,
    isEditor:()=>editor,
    ready:()=>ready,
    status:()=>status,
    email:ADMIN_EMAIL
  };
  document.documentElement.dataset.rapliRole='viewer';
  void initialize();
})();