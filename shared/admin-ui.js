(() => {
 'use strict';
 const access=window.RapliAdminAccess;
 const login=document.getElementById('rapli-admin-login');
 const logout=document.getElementById('rapli-admin-logout');
 const message=document.getElementById('rapli-admin-message');
 if(!access||!login||!logout)return;
 function paint(){
   const isEditor=access.isEditor();
   login.hidden=isEditor;
   logout.hidden=!isEditor;
   if(message&&!message.dataset.pending)message.textContent=isEditor?'Administrateur connecté':'Consultation libre';
 }
 login.addEventListener('click',async()=>{
   const email=prompt('Adresse e-mail administrateur :');
   if(email===null)return;
   if(email.trim().toLowerCase()!==access.email){
     message.textContent='Cette adresse ne dispose pas des droits d’édition.';
     return;
   }
   login.disabled=true;message.dataset.pending='true';
   message.textContent='Envoi du lien de connexion…';
   try{
     await access.sendMagicLink();
     message.textContent='Lien envoyé à rapharcadium@pm.me. Ouvre-le sur cet appareil.';
   }catch(err){
     const code=String(err?.code||'').toLowerCase();
     const detail=String(err?.message||'').toLowerCase();
     const quota=err?.status===429||code==='over_email_send_rate_limit'||detail.includes('email rate limit exceeded');
     if(quota){
       message.textContent='Limite d’e-mails Supabase atteinte. Vérifie le dernier lien reçu ou réessaie après renouvellement du quota. Ne multiplie pas les demandes.';
     }else{
       message.textContent='Connexion indisponible : '+(err?.message||'réessaie plus tard');
     }
   }finally{login.disabled=false;}
 });
 logout.addEventListener('click',async()=>{
   logout.disabled=true;
   try{await access.logout();}
   catch(err){message.textContent='Déconnexion indisponible : '+(err?.message||'réessaie');logout.disabled=false;}
 });
 window.addEventListener('rapli-admin-access-change',()=>{
   delete message.dataset.pending;
   paint();
 });
 paint();
 void access.initialize().then(paint);
})();
